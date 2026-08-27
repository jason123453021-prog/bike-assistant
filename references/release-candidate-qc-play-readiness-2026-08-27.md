# 單車助手 Release Candidate QC 與 Google Play 上架準備紀錄

> 本文件依使用者於 2026-08-27 提供的驗收清單建立。它區分可由程式碼與自動化測試驗證的內容，及必須由實體裝置、法律專業人員或 Play Console 帳號擁有者確認的內容。未完成項目不得視為已上架或已合規。

## 官方提交基準（2026-08-27 查核）

| 項目 | 官方基準 | 對本專案的初步判定 |
|---|---|---|
| Target SDK | 2026-08-31 起，新應用與更新提交 Google Play 必須 target Android 16（API 36）以上。 | `app.config.ts` 現設定 `targetSdkVersion: 36`；仍須由 release bundle 產物驗證。 |
| 商店預覽資產 | Play Console 的 Main store listing 管理 icon、短說明、Feature Graphic、截圖與可選預覽影片；所有資產及文字須符合 Developer Program Policies。 | 專案內有 launcher icon；Feature Graphic、商店截圖、短說明與商店 metadata 是否已在 Console 填寫待確認。 |
| 對外提交 | 上架會使版本／商店資訊成為對外可見或可供審核的內容。 | 需在 bundle、商店資料、安全性表單、隱私政策與發布軌道均確認後，由使用者明確核准才可提交。 |

## 來源

1. [Meet Google Play's target API level requirement](https://developer.android.com/google/play/requirements/target-sdk)
2. [Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)
