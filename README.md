# 🅿️ 香港泊位地圖

實時顯示香港停車場及街上感應泊位的空置情況。

## 🚗 即時數據來源

| 數據類型 | 來源 | 更新頻率 | 取得方式 |
|----------|------|----------|----------|
| 🅿️ 停車場 | 運輸署 TD API (`resource.data.one.gov.hk`) | 每 10 分鐘 | GitHub Actions 合併 → `parking-data.json` |
| 📍 街上泊位 | NMOSPIOT 感應器 CSV (`data.nmospiot.gov.hk`) | 每 10 分鐘 | GitHub Actions 合併 → `parking-data.json` |

> ⚠️ 瀏覽器**唔再直接 fetch TD API**（CORS 403）。全部數據由 GitHub Actions 合併成 `parking-data.json`，GitHub Pages 直接 serve。APK 版會直連 GitHub Pages 攞最新數據。

## 📂 檔案結構

```
├── index.html              # 地圖頁面（Leaflet + MarkerCluster）
├── parking-data.json        # 合併後的泊位數據（含停車場 + 街上泊位）
├── update_parking_data.py   # Python 更新腳本
└── .github/workflows/
    ├── update-data.yml      # GitHub Actions（每 30 分鐘更新數據 + dispatch APK build）
    └── build-apk.yml        # Android APK build
```

## 🏗️ 架構

```
┌─────────────────────────────────────────────────────────┐
│  瀏覽器 / Android APK                                     │
│                                                          │
│  fetch() → parking-data.json (GitHub Pages) ✅           │
│     ↑ 合併檔（停車場 + 街上泊位）                          │
└─────────────────────────────────────────────────────────┘

GitHub Actions (每 30 分鐘):
  update_parking_data.py
    ├── fetch TD carpark basic JSON
    ├── fetch TD carpark vacancy JSON
    ├── fetch NMOSPIOT parkingspace CSV
    ├── fetch NMOSPIOT occupancystatus CSV
    ├── 合併數據
    ├── commit + push → parking-data.json
    └── dispatch build-apk.yml（數據變更時重建 APK）
```

## 🔧 數據欄位

### 停車場（car_parks）

| 欄位 | 說明 |
|------|------|
| `park_id` | 停車場 ID |
| `name_tc` / `name_en` | 名稱（中文/英文） |
| `displayAddress_tc` | 地址 |
| `latitude` / `longitude` | 坐標 |
| `vacancy` | 空位數（null = 無數據） |
| `district_tc` | 分區 |
| `height` | 高度限制（m） |

### 街上泊位（onstreet）

| 欄位 | 說明 |
|------|------|
| `park_id` | 泊位 ID |
| `name_tc` / `name_en` | 街道名稱 |
| `latitude` / `longitude` | 坐標 |
| `status` | `V` = 空置，`O` = 已被佔用，`NU` = 無數據 |
| `district_tc` | 分區 |
| `last_change` | 上次狀態變更時間 |

## 🗺️ 地圖功能

- **地圖類型**：CartoDB 底圖（清晰展示停車設施）
- **Marker 顏色**：
  - 🟢 綠色 = 有空位
  - 🔴 紅色 = 已滿
  - ⚪ 灰色 = 無數據
  - 🟡 黃色 = 未知（感應器無數據 NU）
- **Marker Cluster**：市區 zoom out 自動聚合，唔會一 pat 色
- **篩選**：
  - 泊位類型（全部 / 停車場 / 街上）
  - 狀態（有空位 / 已滿 / 無數據 / 未知）
  - 地區（全港 / 香港島 / 九龍 / 新界 / ⭐ 收藏）
  - 車輛類型（全部 / 🏍️ 電單車位）
- **點擊 Popup**：顯示空位數、地址、狀態、高度限制、收費、**30 分鐘空位趨勢**、Google Maps 導航按鈕、⭐ 收藏按鈕
- **收藏**：⭐ 儲存常用停車場（localStorage），可單獨篩選顯示
- **數據新鮮度**：角落顯示「數據更新於 X 分鐘前」，超過 30 分鐘自動警示
- **🔄 刷新按鈕**：重新 fetch 最新 park-data.json
- **📍 定位 + 🎯 最近泊位**：FAB 按鈕

## 📡 API 端點

### TD API（運輸署）
- 基本資訊：`https://resource.data.one.gov.hk/td/carpark/basic_info_all.json`
- 空位數據：`https://resource.data.one.gov.hk/td/carpark/vacancy_all.json`

### NMOSPIOT API
- 泊位空間：`https://data.nmospiot.gov.hk/api/pvds/Download/parkingspace`
- 佔用狀態：`https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus`

## 📱 Android APK

- Capacitor 7 包裝，webDir = `www/`
- **Live fetch**：APK 每次開啟會直連 GitHub Pages 攞最新 `parking-data.json`（唔會用 build 時 snapshot）
- Build：`npm run build && npx cap sync android && cd android && ./gradlew assembleDebug`
- CI：GitHub Actions 每次數據更新後自動重建 APK

## ⚠️ 限制與已知問題

1. **街上泊位非真正即時**：GitHub Actions 每 30 分鐘更新（實際受 GitHub 排程延遲影響），感應器狀態可能過時
2. **街上泊位 ~54% 係 NU（無數據）**：顯示為 🟡 未知，唔好誤當「冇位」
3. **部分停車場無空位數據**：顯示為灰色
4. **MarkerCluster 需要 CDN**：APK 離線模式會冇 cluster（地圖 tile 本身都要網絡）

## 🔄 更新日誌

- **2026-10-25**：Capacitor 5 → 7（31 個 Dependabot alerts → 0）
- **2026-10-25**：APK build pipeline 修復（actions:write + curl --fail-with-body）
- **2026-10-25**：新增 MarkerCluster、地區/車型/收藏篩選、30 分鐘趨勢、數據新鮮度、🟡 未知狀態、收藏功能、APK live fetch
- **2026-04-29**：加入 GitHub Actions 自動更新泊位數據
- **2026-04-29**：地圖由 Hermes Agent 生成，包含停車場及街上泊位