# Google Play 上架稽核（2026-08-23）

## 帳號與既有應用程式

已在 Google Play Console 的個人開發者帳號 `jason123453021` 登入，帳戶 ID 為 `6488126105445703939`。既有應用程式「單車助手」的套件名稱為 `com.jason123453021.bikeassistant`，目前標示為正式版；本文件不記錄或保存任何帳號憑證。

Play Console 顯示正式版 `bike-assistant-v1_0_89` 已於 2026-07-15 發布，活躍 App bundle 為 versionCode `10089`、versionName `1.0.89`、min SDK 24、target SDK 35。因此，新上傳 AAB 必須使用**高於 10089**的 versionCode；目前專案的 versionCode `10088` 不能直接上傳，需更新為至少 `10090`。Google Play 保護頁顯示發行保護服務已啟用；需在建立新版 AAB 前確認現有 upload key 或由帳號擁有者依官方流程重設 upload key。

本機沒有登入 Expo 帳號，無法從 EAS credential service 讀取既有 Android upload key；GitHub CLI 目前也沒有讀取 repository Actions secrets 的權限。因此，不得猜測、覆寫或以 debug key 取代既有 upload key。後續應由 Play Console 帳號擁有者確認仍持有既有 keystore，或依 Play App Signing 的官方 upload key reset 流程註冊新的受保護 upload key。

進一步盤點顯示 Git 歷史、專案根目錄、Expo 本機設定與 EAS 本機設定均未保存既有 `.jks`／`.keystore` 或 credentials 檔；唯一找到的是 Expo 自動產生的 `android/app/debug.keystore`，它不能簽署既有 Play 正式版更新。Play Console 的應用程式完整性設定已移至「由 Google Play 保護」頁面；既有私鑰不會且不應從該頁面匯出。故此階段的安全結論是：無法復原既有 upload key，必須在獲得帳號擁有者明確同意後使用 Google Play 的 upload key reset 流程。

## 已開啟的 upload key reset 表單

Play Console 的路徑為「由 Google Play 保護 → Play 商店防護措施 → 管理 Play 應用程式簽署」，其「上傳金鑰憑證」區塊提供「要求重設上傳金鑰」。表單現已開啟但尚未送出，需選擇重設原因、生成新的 RSA upload key、以 `keytool -export -rfc -keystore <keystore> -alias <alias> -file <certificate>.pem` 匯出公開 `.pem` 憑證、上傳該 `.pem`，最後才由帳號擁有者確認「申請」。Google Play 顯示的目前 upload key SHA-256 為 `61:AC:9A:5B:F8:08:01:42:35:B6:86:9D:A8:DB:2D:0B:62:02:5B:A8:34:E7:F1:0D:74:A7:76:98:BE:25:12:F2`，僅作為新 key 完成重設後的對照基準；不得將此公開指紋誤作可簽署的私鑰。

已在受限沙箱以 RSA 4096-bit 生成新的 upload key（alias `bike-assistant-upload`），有效至 2054-01-08。其公開憑證 SHA-256 為 `B1:A5:FB:BA:CF:83:2A:92:7A:61:3F:6A:FE:C2:91:FC:10:50:D9:46:01:EC:02:93:76:5A:DF:EA:D5:C1:8F:C3`，PEM 檔 SHA-256 為 `8591c8e85ed07f5e97520da1bf0fe744f53fec38f0821ecb4e2d6e453a8f4e2b`。

在 Play Console 表單中已選取「我的上傳金鑰遺失了」。新 upload key 的公開 PEM `bike-assistant-upload.pem` 已由可見且作用中的表單欄位接受，畫面顯示該檔名與可用的移除控制，表示附檔已持久化至目前的重設申請草稿。帳號擁有者於 2026-08-23 明確確認後，已按下「申請」。Play Console 現顯示「尚未處理重設這個應用程式上傳金鑰的要求」與「取消要求」，表示申請已被接受為待處理狀態；尚未顯示新憑證生效，故在確認前不得使用新 upload key 建立或上傳 AAB。

## 專案設定盤點

`app.config.ts` 已使用固定 Android package `com.jason123453021.bikeassistant`、version `1.0.90`、versionCode `10090`、min SDK 24、target／compile SDK 36。`eas.json` 已有 production profile，類型為 `app-bundle`。既有 GitHub workflow 只以 preview profile 建置 `assembleRelease` APK artifact；該 APK 不應作為 Play Console 正式上傳產物。新增的 `Google Play 正式 AAB` workflow 僅能手動觸發，會先執行 TypeScript、Lint、Vitest 品質守門，再以受保護 upload key 建置並上傳 `.aab` artifact。

隱私權政策已設定為 <https://bikeassist-bdbkimdc.manus.space/privacy>。App 宣告精確／概略／背景位置、location foreground service、通知與喚醒鎖；背景位置為核心騎乘追蹤功能，Google Play 上架需完成相應聲明與審查資料。

## 本輪無憑證驗證（2026-08-23）

完整品質守門已通過：TypeScript 0 errors、Expo Lint 0 warnings/errors、Vitest `115` 個測試檔／`384` 項測試全數通過、Expo Doctor `18/18` 項檢查通過。以 `EAS_BUILD_PROFILE=production` 執行 Android Hermes 匯出成功，產生 `1` 個 Android Hermes bundle 與 `26` 項 assets。

已對 Expo 實際 prebuild 產生的 `android/app/build.gradle` 套用 release signing script，使用無效示範環境值驗證：release buildType 唯一指向 `signingConfigs.release`，其 keystore 路徑、alias 與密碼均由 `PLAY_UPLOAD_*` 環境變數取得；debug buildType 唯一維持 `signingConfigs.debug`。未使用 debug key 建立正式 AAB。

新的 upload keystore、公開 PEM 與所有暫存密碼現由 `.play-signing-temp/` 全目錄 Git 忽略規則保護。GitHub CLI 可讀取儲存庫與 Actions workflow，但目前對 Actions secrets public-key API 回覆 `403 Resource not accessible by integration`；若此權限未由瀏覽器帳號補足，後續需改由 GitHub 網頁的 repository／environment secrets 介面安全設定四個 `PLAY_UPLOAD_*` secrets，絕不在訊息、原始碼或命令列揭露其值。

## 官方上架要求與對應行動

| 要求 | 對本 App 的處理 |
|---|---|
| 新 app 以 Android App Bundle 上傳並啟用 Play App Signing | 建立正式簽署 AAB；使用者在 Play Console 設定 Play App Signing。 |
| Upload key 應與 Google 管理的 app signing key 分離 | 產生 RSA 2048-bit 以上 upload key，僅以受保護的 CI secret 使用，不寫入 Git。 |
| Data safety 表單 | 依實際 Local-First 行為、位置、相片選取與所有第三方 SDK 實際資料處理完成宣告。 |
| 背景位置 | 在 App content 的 Sensitive app permissions 提交聲明、短影片、醒目 app 內揭露與隱私權政策連結。騎乘中由使用者主動開始的背景 GPS 前景服務是唯一應主張的核心用途。 |
| 個人帳號新 app 的 production access（若帳戶條件適用） | 先建立 closed test，最少 12 名測試者持續 opt-in 14 天，之後才申請正式版存取權。 |

## 官方來源

1. Android Developers, [Upload your app to the Play Console](https://developer.android.com/studio/publish/upload-bundle).
2. Android Developers, [About Android App Bundles](https://developer.android.com/guide/app-bundle).
3. Google Play Console Help, [Use Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en).
4. Google Play Console Help, [Understanding location in the background permissions](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en-GB).
5. Google Play Console Help, [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-GB).
6. Google Play Console Help, [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
