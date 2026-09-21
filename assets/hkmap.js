/* ============================================================
   HK Urban Map Design System — shared runtime
   - Service Worker registration (PWA offline + installable)
   - Theme manager (light/dark + toggle button)
   - Error banner + toast helpers
   Shared across all hkteddychan map repos (GitHub Pages).
   ============================================================ */
(function () {
  var HKMap = window.HKMap = window.HKMap || {};

  /* ---------- Service Worker (PWA) ---------- */
  HKMap.registerSW = function (swUrl) {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register(swUrl || 'sw.js')
          .catch(function (err) {
            // Non-fatal — app still works online.
            console.warn('[HKMap] SW registration failed:', err);
          });
      });
    }
  };

  /* ---------- Theme ---------- */
  function currentTheme() {
    var saved = null;
    try { saved = localStorage.getItem('hkmap-theme'); } catch (e) {}
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('hkmap-theme', theme); } catch (e) {}
    var t = HKMap.themeButton;
    if (t) t.textContent = theme === 'dark' ? '☀️' : '🌙';
    t && t.setAttribute('aria-label', theme === 'dark' ? '切換至淺色模式' : '切換至深色模式');
    if (typeof HKMap.onThemeChange === 'function') HKMap.onThemeChange(theme === 'dark');
  }
  HKMap.theme = function () { return document.documentElement.getAttribute('data-theme') || 'light'; };
  HKMap.setTheme = function (theme) { applyTheme(theme); return HKMap; };
  HKMap.toggleTheme = function () {
    applyTheme(HKMap.theme() === 'dark' ? 'light' : 'dark');
    return HKMap;
  };

  /* Mount a small theme toggle button into a positioned parent.
     Pass the container element (e.g. map container) — button is absolute. */
  HKMap.mountThemeButton = function (container) {
    if (!container || HKMap.themeButton) return;
    if (container.querySelector('.hk-theme-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'hk-theme-btn';
    btn.setAttribute('aria-label', '切換深色/淺色模式');
    btn.title = '切換深色/淺色模式';
    container.appendChild(btn);
    HKMap.themeButton = btn;
    btn.addEventListener('click', HKMap.toggleTheme);
    applyTheme(currentTheme());
  };

  /* ---------- Error banner ---------- */
  HKMap.showError = function (message, onRetry) {
    var existing = document.querySelector('.hk-error');
    if (existing) existing.remove();
    var bar = document.createElement('div');
    bar.className = 'hk-error';
    bar.setAttribute('role', 'alert');
    var text = document.createElement('span');
    text.textContent = message || '⚠️ 載入數據失敗';
    bar.appendChild(text);
    if (typeof onRetry === 'function') {
      var retry = document.createElement('button');
      retry.textContent = '重試';
      retry.addEventListener('click', function () { bar.remove(); onRetry(); });
      bar.appendChild(retry);
    } else {
      var close = document.createElement('button');
      close.textContent = '✕';
      close.addEventListener('click', function () { bar.remove(); });
      bar.appendChild(close);
    }
    document.body.appendChild(bar);
    return bar;
  };

  /* ---------- Toast (fallback if app has none) ---------- */
  HKMap.toast = function (msg, ms) {
    var el = document.getElementById('toast');
    ms = ms || 2600;
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(function () { el.classList.remove('show'); }, ms);
      return;
    }
    // Fallback toast
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(20,22,28,.92);color:#fff;padding:10px 18px;border-radius:12px;font-size:13px;z-index:99999;font-family:inherit;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:90vw;text-align:center';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms);
  };

  /* ---------- Generic fetch with timeout + JSON ---------- */
  HKMap.fetchJSON = function (url, opts) {
    opts = opts || {};
    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, opts.timeout || 20000) : null;
    var p = fetch(url, {
      signal: controller ? controller.signal : undefined,
      cache: opts.cache || 'no-cache'
    });
    p.then(function () { if (timer) clearTimeout(timer); },
           function () { if (timer) clearTimeout(timer); });
    return p;
  };

  /* ---------- Mobile collapsible controls ---------- */
  /* Any element with class .hk-controls-collapse: tapping its first
     child (the header) toggles .open, revealing the rest on mobile. */
  function initCollapse() {
    document.querySelectorAll('.hk-controls-collapse').forEach(function (box) {
      var header = box.firstElementChild;
      if (!header) return;
      header.setAttribute('role', 'button');
      header.setAttribute('aria-expanded', 'false');
      header.style.cursor = 'pointer';
      header.addEventListener('click', function (e) {
        if (e.target.closest('button, a, input, select, .pill, .type-pill')) return;
        var open = box.classList.toggle('open');
        header.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    applyTheme(currentTheme());
    initCollapse();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
