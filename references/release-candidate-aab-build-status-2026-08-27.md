# Release Candidate AAB 建置狀態（2026-08-27）

GitHub Actions 工作流程「Google Play 正式 AAB」已於 2026-08-27 01:21 以 `workflow_dispatch` 觸發，執行頁為 <https://github.com/jason123453021-prog/bike-assistant/actions/runs/33029848708>。

該 workflow 指向 `main` 的提交 `77bc9641d34f3361d2abb53822597798191ca018`，其中包含本輪背景定位顯眼告知與回歸守門。GitHub Actions run `33029848708` 已於 2026-08-27 01:38 成功完成，總時長 16 分鐘；原始碼、依賴、品質守門、Android prebuild、受保護 upload keystore 還原、release signing 與 `bundleRelease` 均已完成。唯一 annotation 是 GitHub Actions 所用 actions 的 Node.js 20 淘汰通知；這是執行環境警告，未使建置失敗。

Artifact `bike-assistant-google-play-aab` 已成功產生，GitHub 顯示大小 35.6 MB、SHA-256 digest `37293453ce18309324b716b5aabd7bceac425be6779bf4ba5eccdbd10e45ab6b`。下載 zip 後的 `app-release.aab` 為 37,806,185 bytes，SHA-256 `1528284bb89089f1776f2f1404250024fd0c95235e7c8478a91a11be77d49f5a`。從 artifact 的 `base/manifest/AndroidManifest.xml` 可直接驗證 package `com.jason123453021.bikeassistant`、`versionCode` `10102`、`versionName` `1.0.102`。JAR 簽署憑證為 `CN=Bike Assistant Upload Key, OU=Release, O=Bike Assistant, L=Taipei, ST=Taiwan, C=TW`，使用 4096-bit RSA 與 `SHA384withRSA`，憑證 SHA-256 指紋為 `B1:A5:FB:BA:CF:83:2A:92:7A:61:3F:6A:FE:C2:91:FC:10:50:D9:46:01:EC:02:93:76:5A:DF:EA:D5:C1:8F:C3`。

此紀錄僅證明 GitHub 已建置並以設定的 upload key 簽署 AAB；尚未證明 Google Play Console 接受該 upload key／bundle、任何商店表單或聲明完成，亦未送審或發布。

第二次 workflow `33035522005` 於 2026-08-27 03:26 成功完成，指向提交 `68998304254e255664704bd2b701125289f73cdc`。它已通過 workflow 中的 prebuild manifest 防線、還原受保護 upload key、正式簽署與 artifact 上傳；artifact ID 為 `9632133328`、GitHub 顯示大小 `37,329,631` bytes、到期時間為 2026-09-10 03:26 UTC。透過瀏覽器下載後，AAB 為 `37,806,185` bytes，SHA-256 為 `1528284bb89089f1776f2f1404250024fd0c95235e7c8478a91a11be77d49f5a`，package、versionCode `10102`、versionName `1.0.102` 及 upload key 憑證均與前述結果相符。

不過，直接從第二次 AAB 的 binary manifest 擷取字串時，仍見 `BOOT_COMPLETED`、`REBOOT`、`QUICKBOOT_POWERON` 及 HTC quick boot action。此結果**不符合**本輪 Android 15 release guard，不能作為提交 Play Console 的最終 AAB。根因是 Android Manifest Merger 對 library 的 `intent-filter` 一律視為獨立元素而加入；先前 plugin 只修改 Expo prebuild 的 app manifest，未能阻止 Gradle 合併 library intent filters。依 Android 官方 manifest merger 的高優先級 `tools:node="replace"` 規則，修正已改為以 app receiver 取代 Expo Notifications 與 Task Manager 的同名 library receiver，同時保留 app 內事件及 `MY_PACKAGE_REPLACED`。

更新後的本機 `expo prebuild` manifest 已確認兩個 receiver 含 `tools:node="replace"`，不含四種開機 action，且仍有 `ACCESS_BACKGROUND_LOCATION` 及 `FOREGROUND_SERVICE_LOCATION`。正式 workflow 也已補上封裝後 AAB binary manifest 的檢查。仍須重新跑完整 QC、重新建置並核對新的 AAB，才可把 BOOT_COMPLETED 問題標記為解除。
