# 免費補水點與拍照景點圖層驗證紀錄

> 本文件記錄 1.0.101／Android `versionCode` 10101 的 POI 圖層實作與驗證狀態。它不是 Android 實體裝置或 GitHub Emulator artifact 已完成的宣告。

## 已完成的 Local-first 功能

本版建立「免費補水點」與「拍照景點」兩個獨立圖層。補水點只接受帶有明確可飲用水標籤的公開地圖資料；警察局、車站、單車店、遊客中心與單車站等場所，只有在同時標明供水時才會列入，避免將未確認設施誤導為免費補水。景點則使用觀景台與單車相關山頂／地標語意分類。

使用者可於設定頁的地圖互動區獨立切換「顯示免費補水點」與「顯示拍照景點」。兩個偏好沿用既有本機設定持久化，地圖主畫面沒有新增控制按鈕。Leaflet 層以藍色水滴與橘黃色相機標記，縮放至遠景時以純 JavaScript 群組標記減少 Marker 壅塞；點擊點位後會顯示名稱、類別、直線距離、可用預覽與資料來源提示，並可帶入既有釘選導航流程。

## 本機品質驗證

| 項目 | 結果 |
|---|---|
| POI 資料分類、距離、圖層篩選與縮放群組 Vitest | 通過，5 項測試 |
| POI 全語系、設定開關、Leaflet 聚合、資訊卡與釘選導航 Jest | 通過，16 項測試／13 個 locale |
| 完整 Jest | 通過 |
| 完整 Vitest | 通過，129 個測試檔／456 項測試 |
| TypeScript、Expo Lint、Expo config、`git diff --check` | 通過 |

## Android 遠端驗收狀態

已建立專用 Maestro 設定頁流程 `e2e/maestro/poi-layers-settings.yaml`，驗證兩個開關可見、可切換，且結果會隨 Android E2E artifact 上傳。GitHub Actions 執行 `32984432667`（Android 原生 E2E）與 `32984433920`（Android 驗收 APK）針對提交 `902cfb3` 建立後，持續停在 GitHub runner 的 `queued` 狀態，尚未產生 job、JUnit、截圖或 APK artifact。

依使用者於本輪的選擇，先以已推送且完成本機 QA 的版本交付；當 GitHub runner 恢復時，仍須核對或重跑兩個遠端 workflow。不得將本文件解讀為 Android Emulator、實體 Android 或 OEM 行為已驗證。
