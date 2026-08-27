# 單車助手 Release Candidate QC 與 Google Play 上架準備紀錄

> 本文件依使用者於 2026-08-27 提供的驗收清單建立。它區分可由程式碼與自動化測試驗證的內容，及必須由實體裝置、法律專業人員或 Play Console 帳號擁有者確認的內容。未完成項目不得視為已上架或已合規。

## 官方提交基準（2026-08-27 查核）

| 項目 | 官方基準 | 對本專案的初步判定 |
|---|---|---|
| Target SDK | 2026-08-31 起，新應用與更新提交 Google Play 必須 target Android 16（API 36）以上。 | `app.config.ts` 現設定 `targetSdkVersion: 36`；仍須由 release bundle 產物驗證。 |
| 商店預覽資產 | Play Console 的 Main store listing 管理 icon、短說明、Feature Graphic、截圖與可選預覽影片；所有資產及文字須符合 Developer Program Policies。 | 專案內有 launcher icon；Feature Graphic、商店截圖、短說明與商店 metadata 是否已在 Console 填寫待確認。 |
| 對外提交 | 上架會使版本／商店資訊成為對外可見或可供審核的內容。 | 需在 bundle、商店資料、安全性表單、隱私政策與發布軌道均確認後，由使用者明確核准才可提交。 |

| Android 15 開機 receiver 與前景服務 | Target Android 15 以上時，`BOOT_COMPLETED` receiver 不得啟動 `dataSync`、`camera`、`mediaPlayback`、`phoneCall`、`mediaProjection` 或 `microphone` 類型前景服務；違反時系統會拋出 `ForegroundServiceStartNotAllowedException`。 | 初輪 1.0.102 AAB 的 manifest 仍可見 Expo Notifications／Task Manager 的 BOOT_COMPLETED action，且 Play Console 舊版 1.0.89 已顯示該風險。已新增最終 manifest plugin，僅移除這些 receiver 的開機 action、保留 app 內事件；本機 `expo prebuild` 產物已確認不存在四種 boot action，仍保有 location FGS 必要權限。下一輪正式 AAB 與 Play 預先檢查仍須再驗證。 |

## Play Console 唯讀預檢（2026-08-27）

已確認個人開發者帳戶 `jason123453021` 可管理 package `com.jason123453021.bikeassistant`（Console app ID `4973516244048350089`）。正式版目前活躍版本為 `bike-assistant-v1_0_89`（versionCode `10089`），並存在一份尚未命名的正式版草稿，範圍為 172 個國家／地區；草稿未顯示附帶的 AAB 或版本碼，不能視為本輪 1.0.102 已上傳。商店設定已選「地圖與導航」類別，預設繁中商店資訊為即時狀態，並已具備一張 app icon、一張 Feature Graphic 與五張手機截圖；但公開商店文案仍包含「隊友遙測」及自動重算敘述，尚未按現行 Local-first 功能邊界和法務審閱完成更新。

Console 的「測試及發布」頁另列出三項舊版 1.0.89 的待處理問題：受限制前景服務類型、已淘汰的無邊框 API／參數，以及 Android 16 大型螢幕方向與大小調整提醒。這些訊息尚未套用到 1.0.102，不能直接視為新版本接受或拒絕結果。Data Safety、Sensitive app permissions 與 Console 的隱私權政策欄位尚未在本輪成功讀取或驗證。所有 Console 操作目前均為唯讀檢視，未上傳、儲存、送審或發布。

## 來源

1. [Meet Google Play's target API level requirement](https://developer.android.com/google/play/requirements/target-sdk)
2. [Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)
3. [Android 15 behavior changes: BOOT_COMPLETED foreground service restrictions](https://developer.android.com/about/versions/15/behavior-changes-15)
4. [Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types)
