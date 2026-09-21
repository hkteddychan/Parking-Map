/* ============================================================
   HK Urban Map — Service Worker (PWA offline support)
   Strategy:
   - App shell (index.html, css, js, icons, manifest): cache-first
   - Data JSON: network-first with cache fallback (offline support)
   ============================================================ */
var VERSION = 'v1';
var SHELL_CACHE = 'hkmap-shell-' + VERSION;
var DATA_CACHE = 'hkmap-data-' + VERSION;

var SHELL_URLS = [
  './',
  './index.html',
  './assets/hkmap.css',
  './assets/hkmap.js',
  './assets/icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL_URLS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== SHELL_CACHE && k !== DATA_CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Skip cross-origin requests (tiles, CDN) — let network handle them.
  if (url.origin !== self.location.origin) return;

  // Data JSON files: network-first, fall back to cache (offline).
  if (/\.(json|geojson)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(DATA_CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('./'); });
      })
    );
    return;
  }

  // Everything else same-origin: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then(function (cached) {
      var fetchPromise = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || fetchPromise;
    })
  );
});
