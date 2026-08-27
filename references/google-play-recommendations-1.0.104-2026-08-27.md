# Google Play 建議行動修正紀錄：1.0.104／10104

Google Play 對 `1.0.102／10102` 顯示三項建議：Android 無邊框 API／參數、點陣圖記憶體與 R8 最佳化。本版將能由原始碼與正式 AAB 自動驗證的項目納入下一個更新候選版本；本文件不代表新版本已上傳、送審或發布。

| 建議 | 1.0.104 的對應處理 | 驗證方式 |
| --- | --- | --- |
| 淘汰的無邊框 API／參數 | 保留 Expo SDK 54 與 Android 16 所需的 `edgeToEdgeEnabled`，移除 `expo-navigation-bar` config plugin 的背景色、邊框色、位置與互動行為設定。這些自訂在 Android 15 的 edge-to-edge 環境中已受限或淘汰。 | Expo 設定解析、靜態回歸守門與重建 AAB 後的 Play pre-check。 |
| 點陣圖記憶體 | POI 資訊卡的遠端預覽圖改用現有 `expo-image`，以 126 px 高顯示尺寸提前縮放，使用磁碟快取及 `recyclingKey`，避免在切換點位時保留不必要的高解析記憶體影像。 | 回歸測試確認元件、早期縮放、磁碟快取與資源重用鍵。 |
| R8 最佳化 | GitHub 正式 AAB 工作流程已設定 `EAS_BUILD_PROFILE=production`，使 `enableMinifyInReleaseBuilds` 與 `enableShrinkResourcesInReleaseBuilds` 為真；預覽 APK 仍維持保守設定以縮短開發回圈。 | GitHub 正式 AAB 工作流程與 Android release config 測試。 |

> Android 15 以上在 target SDK 35 以上時強制 edge-to-edge，Android 16 不再支援 opt-out；因此本版選擇維持 edge-to-edge 與 Safe Area／insets 佈局，而非回退至淘汰的系統列色彩與位置覆寫。[1] [2]

## 版本與提交邊界

預計上傳版本為 `1.0.104／10104`，package 維持 `com.jason123453021.bikeassistant`。新版本只涵蓋上述相容性與記憶體改善，不修改 Data Safety、公開隱私權頁、商店文案、截圖或既有正式版。上傳後仍需要讀取 Google Play pre-check，才能確認 Play 是否不再針對前版的三個建議顯示提醒。

## References

[1]: https://developer.android.com/develop/ui/views/layout/edge-to-edge "Android Developers: Display content edge-to-edge in views"
[2]: https://expo.dev/blog/edge-to-edge-display-now-streamlined-for-android "Expo: Edge-to-edge display streamlined for Android"
