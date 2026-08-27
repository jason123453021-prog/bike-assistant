# Release Candidate AAB 建置狀態（2026-08-27）

GitHub Actions 工作流程「Google Play 正式 AAB」已於 2026-08-27 01:21 以 `workflow_dispatch` 觸發，執行頁為 <https://github.com/jason123453021-prog/bike-assistant/actions/runs/33029848708>。

該 workflow 指向 `main` 的提交 `77bc9641d34f3361d2abb53822597798191ca018`，其中包含本輪背景定位顯眼告知與回歸守門。GitHub Actions run `33029848708` 已於 2026-08-27 01:38 成功完成，總時長 16 分鐘；原始碼、依賴、品質守門、Android prebuild、受保護 upload keystore 還原、release signing 與 `bundleRelease` 均已完成。唯一 annotation 是 GitHub Actions 所用 actions 的 Node.js 20 淘汰通知；這是執行環境警告，未使建置失敗。

Artifact `bike-assistant-google-play-aab` 已成功產生，GitHub 顯示大小 35.6 MB、SHA-256 digest `37293453ce18309324b716b5aabd7bceac425be6779bf4ba5eccdbd10e45ab6b`。下載 zip 後的 `app-release.aab` 為 37,806,185 bytes，SHA-256 `1528284bb89089f1776f2f1404250024fd0c95235e7c8478a91a11be77d49f5a`。從 artifact 的 `base/manifest/AndroidManifest.xml` 可直接驗證 package `com.jason123453021.bikeassistant`、`versionCode` `10102`、`versionName` `1.0.102`。JAR 簽署憑證為 `CN=Bike Assistant Upload Key, OU=Release, O=Bike Assistant, L=Taipei, ST=Taiwan, C=TW`，使用 4096-bit RSA 與 `SHA384withRSA`，憑證 SHA-256 指紋為 `B1:A5:FB:BA:CF:83:2A:92:7A:61:3F:6A:FE:C2:91:FC:10:50:D9:46:01:EC:02:93:76:5A:DF:EA:D5:C1:8F:C3`。

此紀錄僅證明 GitHub 已建置並以設定的 upload key 簽署 AAB；尚未證明 Google Play Console 接受該 upload key／bundle、任何商店表單或聲明完成，亦未送審或發布。
