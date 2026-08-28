# 完整功能地圖全自動 QC 矩陣

本矩陣以 `FEATURE_MAP_PRD_2026-08-24.md` 為驗收範圍。自動化結果只證明 TypeScript、靜態規則、單元／整合測試、Expo 設定與 Android bundle 可以通過；GPS、背景限制、亮度、通知、TTS、外部分享與實際道路導航仍需實機驗收。

| PRD 模組 | 自動化驗證項目 | 主要證據／測試範圍 | 通過準則 | 實機邊界 |
|---|---|---|---|---|
| 核心記錄與演算 | 型別、Lint、完整 Vitest、移動時間／正規化／統計／自動暫停 | `moving-time-gps-integrity`、`ride-record-normalizer`、`activity-statistics`、`background-auto-pause`、`auto-lap` | 不產生型別、Lint 或測試失敗；移動時間與零分母守門可回歸 | 真實 GPS 漂移、車速與長時背景追蹤 |
| 導航與地圖 | COG、左右轉、偏離回退、路口喚醒來源守門 | `cog-navigation`、`map-heading-stability-ui`、導航生命週期測試 | 不使用硬體羅盤；GPX 幾何閾值通過 | Leaflet 實際旋轉、TTS 音量、GPS 偏離情境 |
| 補給與提醒 | 智慧計畫、絕對時間、暫停補償、背景通知、逾時降級 | `smart-supply*`、`hydration*`、`background-supply*` | 倒數、確認與降級案例通過 | 系統通知權限、鎖屏／OEM 背景限制 |
| 活動、分享與匯出 | 活動統計、分享 SVG、GPX、FIT、分圈資料 | `local-share-card`、`gpx-export`、`fit-export`、`ride-session-recovery` | 路線時間戳、elapsed／timer 時間及防爆格式通過 | 第三方服務匯入與社群平台壓縮 |
| 設定與系統防護 | 設定正規化、移除功能守門、權限／品質靜態檢查 | `settings*`、`manual-lap-experience`、`daylight-removal`、`cog-navigation` | 已移除功能未回歸；設定型別與邊界安全 | 實機字體縮放與使用者權限拒絕流程 |
| Expo／Android | Expo Doctor、Android Hermes export、設定解析 | `npx expo-doctor`、production export | Doctor 無阻擋項、成功產生 Android bundle／assets | 真機安裝、前景服務與廠商省電策略 |
