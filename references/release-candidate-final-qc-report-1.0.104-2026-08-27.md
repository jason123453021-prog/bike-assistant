# 單車助手 1.0.104／10104 發布候選 QC 報告

> **結論：已完成正式 AAB 建置及封裝驗證，可在使用者明確確認後上傳 Google Play。** 本文件不代表 AAB 已上傳、送審或發布。

| 檢查項目 | 結果 | 證據 |
| --- | --- | --- |
| Android 無邊框相容 | 通過 | 保留 `edgeToEdgeEnabled: true`，移除 `expo-navigation-bar` 的背景色、邊框色、位置與行為設定。正式 profile Expo 設定與乾淨 Android 預建置均未含該外掛。 |
| POI 點陣圖記憶體 | 通過 | 資訊卡預覽圖使用 `expo-image` 的 `allowDownscaling`、`enforceEarlyResizing`、磁碟快取與 `recyclingKey`；新增靜態回歸測試。 |
| R8 與資源縮減 | 通過 | GitHub workflow 以 `EAS_BUILD_PROFILE=production` 執行，使 `enableMinifyInReleaseBuilds` 與 `enableShrinkResourcesInReleaseBuilds` 在正式 AAB 為啟用狀態。 |
| 程式品質 | 通過 | TypeScript、Expo Lint、Jest 與 Vitest 均通過；Vitest 為 131 files／464 tests。依使用者既定偏好未執行 E2E。 |
| 發布設定 | 通過 | package `com.jason123453021.bikeassistant`、version `1.0.104`、versionCode `10104`、target SDK 36。 |
| 正式受保護 AAB | 通過 | GitHub Actions [run 33067369663](https://github.com/jason123453021-prog/bike-assistant/actions/runs/33067369663) 成功，來源 `release/1.0.104`、commit `44d556a8d82c802f03ddfd91e940d46a5584d904`。 |
| 簽署憑證 | 已核對 | archive 具有 `BIKE-ASS.SF`／`BIKE-ASS.RSA`；`keytool` 顯示 `Bike Assistant Upload Key`、SHA-384 with RSA、4096-bit RSA。 |
| 封裝 manifest | 通過 | 驗證 package、versionCode `10104`、versionName `1.0.104`、定位權限；未發現 `BOOT_COMPLETED`、`REBOOT` 或 `QUICKBOOT_POWERON` action。 |
| AAB SHA-256 | 已記錄 | `b486f13933d76cff609a735aa89aaeff0d2b38a25f81eeb794f9ce5a21e78c5c`。 |

## 提交影響與範圍

本候選版本只處理 Google Play 對 10102 顯示的無邊框 API、點陣圖記憶體和 R8 優化建議；不變更 Data Safety、公開隱私權頁、商店文案或截圖。上傳至正式版草稿、儲存草稿及送交 Google 審查均為外部狀態變更，需先取得使用者對操作範圍的明確確認。
