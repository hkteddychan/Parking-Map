# 🅿️ 香港泊位地圖

實時顯示香港停車場及街上感應泊位的空置情況。

## 🚗 即時數據來源

| 數據類型 | 來源 | 更新頻率 | 取得方式 |
|----------|------|----------|----------|
| 🅿️ 停車場 | 運輸署 TD API (`resource.data.one.gov.hk`) | 每分鐘 | 瀏覽器直接 fetch（CORS: *） |
| 📍 街上泊位 | NMOSPIOT 感應器 CSV (`data.nmospiot.gov.hk`) | 每 5 分鐘 | GitHub Actions 自動更新 |

## 📂 檔案結構

```
├── index.html              # 地圖頁面（Leaflet）
├── parking-data.json        # 合併後的泊位數據（含停車場 + 街上泊位）
├── update_parking_data.py   # Python 更新腳本
└── .github/workflows/
    └── update-parking.yml   # GitHub Actions（每5分鐘自動執行）
```

## 🏗️ 架構

```
┌─────────────────────────────────────────────────────────┐
│  瀏覽器（用戶）                                            │
│                                                          │
│  🅿️ fetch() → TD API (CORS:*) ✅ 實時！每次load最新        │
│  📍 fetch() → parking-data.json (GitHub Pages)           │
│     ↑ 呢個檔案由 GitHub Actions 每5分鐘更新                 │
└─────────────────────────────────────────────────────────┘

GitHub Actions (每5分鐘):
  update_parking_data.py
    ├── fetch TD carpark basic JSON
    ├── fetch TD carpark vacancy JSON
    ├── fetch NMOSPIOT parkingspace CSV
    ├── fetch NMOSPIOT occupancystatus CSV
    ├── 合併數據
    └── commit + push → parking-data.json
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

### 街上泊位（onstreet）

| 欄位 | 說明 |
|------|------|
| `park_id` | 泊位 ID |
| `name_tc` / `name_en` | 街道名稱 |
| `latitude` / `longitude` | 坐標 |
| `status` | `V` = 空置，`O` = 已被佔用 |
| `district_tc` | 分區 |
| `last_change` | 上次狀態變更時間 |

## 🗺️ 地圖功能

- **地圖類型**：CartoDB 底圖（清晰展示停車設施）
- **Marker 顏色**：
  - 🟢 綠色 = 有空位
  - 🔴 紅色 = 已滿
  - ⚪ 灰色 = 無數據
- **Marker 大小**：停車場大，街上泊位小（菱形）
- **篩選**：可按類型（全部/停車場/街上）或狀態顯示
- **點擊 Popup**：顯示詳細資訊（空位數、地址、狀態等）
- **🔄 刷新按鈕**：即時重新抓取 TD API 最新數據

## 📡 API 端點

### TD API（運輸署）
- 基本資訊：`https://resource.data.one.gov.hk/td/carpark/basic_info_all.json`
- 空位數據：`https://resource.data.one.gov.hk/td/carpark/vacancy_all.json`

### NMOSPIOT API
- 泊位空間：`https://data.nmospiot.gov.hk/api/pvds/Download/parkingspace`
- 佔用狀態：`https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus`

## ⚠️ 限制與已知問題

1. **街上泊位非真正實時**：由 GitHub Actions 每 5 分鐘更新一次，而非真正感應器即時數據
2. **NMOSPIOT 無 CORS**：街上泊位無法像停車場那样由瀏覽器直接 fetch
3. **部分停車場無空位數據**：顯示為灰色

## 🔄 更新日誌

- **2026-04-29**：停車場改為瀏覽器直接 fetch TD API（真正實時）
- **2026-04-29**：加入 GitHub Actions，每 5 分鐘自動更新泊位數據
- **2026-04-29**：地圖由 Hermes Agent 生成，包含停車場及街上泊位
