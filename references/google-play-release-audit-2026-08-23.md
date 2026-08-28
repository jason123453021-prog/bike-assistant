# Google Play 上架稽核（2026-08-23）

## 帳號與既有應用程式

已在 Google Play Console 的個人開發者帳號 `jason123453021` 登入，帳戶 ID 為 `6488126105445703939`。既有應用程式「單車助手」的套件名稱為 `com.jason123453021.bikeassistant`，目前標示為正式版；本文件不記錄或保存任何帳號憑證。

Play Console 顯示正式版 `bike-assistant-v1_0_89` 已於 2026-07-15 發布，活躍 App bundle 為 versionCode `10089`、versionName `1.0.89`、min SDK 24、target SDK 35。因此，新上傳 AAB 必須使用**高於 10089**的 versionCode；目前專案的 versionCode `10088` 不能直接上傳，需更新為至少 `10090`。Google Play 保護頁顯示發行保護服務已啟用；需在建立新版 AAB 前確認現有 upload key 或由帳號擁有者依官方流程重設 upload key。

本機沒有登入 Expo 帳號，無法從 EAS credential service 讀取既有 Android upload key；GitHub CLI 目前也沒有讀取 repository Actions secrets 的權限。因此，不得猜測、覆寫或以 debug key 取代既有 upload key。後續應由 Play Console 帳號擁有者確認仍持有既有 keystore，或依 Play App Signing 的官方 upload key reset 流程註冊新的受保護 upload key。

進一步盤點顯示 Git 歷史、專案根目錄、Expo 本機設定與 EAS 本機設定均未保存既有 `.jks`／`.keystore` 或 credentials 檔；唯一找到的是 Expo 自動產生的 `android/app/debug.keystore`，它不能簽署既有 Play 正式版更新。Play Console 的應用程式完整性設定已移至「由 Google Play 保護」頁面；既有私鑰不會且不應從該頁面匯出。故此階段的安全結論是：無法復原既有 upload key，必須在獲得帳號擁有者明確同意後使用 Google Play 的 upload key reset 流程。

## 已開啟的 upload key reset 表單

Play Console 的路徑為「由 Google Play 保護 → Play 商店防護措施 → 管理 Play 應用程式簽署」，其「上傳金鑰憑證」區塊提供「要求重設上傳金鑰」。表單現已開啟但尚未送出，需選擇重設原因、生成新的 RSA upload key、以 `keytool -export -rfc -keystore <keystore> -alias <alias> -file <certificate>.pem` 匯出公開 `.pem` 憑證、上傳該 `.pem`，最後才由帳號擁有者確認「申請」。Google Play 顯示的目前 upload key SHA-256 為 `61:AC:9A:5B:F8:08:01:42:35:B6:86:9D:A8:DB:2D:0B:62:02:5B:A8:34:E7:F1:0D:74:A7:76:98:BE:25:12:F2`，僅作為新 key 完成重設後的對照基準；不得將此公開指紋誤作可簽署的私鑰。

已在受限沙箱以 RSA 4096-bit 生成新的 upload key（alias `bike-assistant-upload`），有效至 2054-01-08。其公開憑證 SHA-256 為 `B1:A5:FB:BA:CF:83:2A:92:7A:61:3F:6A:FE:C2:91:FC:10:50:D9:46:01:EC:02:93:76:5A:DF:EA:D5:C1:8F:C3`，PEM 檔 SHA-256 為 `8591c8e85ed07f5e97520da1bf0fe744f53fec38f0821ecb4e2d6e453a8f4e2b`。

在 Play Console 表單中已選取「我的上傳金鑰遺失了」。新 upload key 的公開 PEM `bike-assistant-upload.pem` 已由可見且作用中的表單欄位接受，畫面顯示該檔名與可用的移除控制，表示附檔已持久化至目前的重設申請草稿。帳號擁有者於 2026-08-23 明確確認後，已按下「申請」。Console 的通知中心顯示「我們收到了重設上傳金鑰的要求」，並且「上傳金鑰憑證」區塊現已顯示新憑證 SHA-256 `B1:A5:FB:BA:CF:83:2A:92:7A:61:3F:6A:FE:C2:91:FC:10:50:D9:46:01:EC:02:93:76:5A:DF:EA:D5:C1:8F:C3`（取代原先 `61:AC:...:12:F2`）。因此，新 upload key 已在 Play Console 顯示為目前憑證，可進入受保護簽署 AAB 的憑證配置階段；仍不得把 keystore 或密碼加入 Git、訊息或任何公開欄位。

## 專案設定盤點

`app.config.ts` 已使用固定 Android package `com.jason123453021.bikeassistant`、version `1.0.90`、versionCode `10090`、min SDK 24、target／compile SDK 36。`eas.json` 已有 production profile，類型為 `app-bundle`。既有 GitHub workflow 只以 preview profile 建置 `assembleRelease` APK artifact；該 APK 不應作為 Play Console 正式上傳產物。新增的 `Google Play 正式 AAB` workflow 僅能手動觸發，會先執行 TypeScript、Lint、Vitest 品質守門，再以受保護 upload key 建置並上傳 `.aab` artifact。

隱私權政策已設定為 <https://bikeassist-bdbkimdc.manus.space/privacy>。App 宣告精確／概略／背景位置、location foreground service、通知與喚醒鎖；背景位置為核心騎乘追蹤功能，Google Play 上架需完成相應聲明與審查資料。

## 本輪無憑證驗證（2026-08-23）

完整品質守門已通過：TypeScript 0 errors、Expo Lint 0 warnings/errors、Vitest `115` 個測試檔／`384` 項測試全數通過、Expo Doctor `18/18` 項檢查通過。以 `EAS_BUILD_PROFILE=production` 執行 Android Hermes 匯出成功，產生 `1` 個 Android Hermes bundle 與 `26` 項 assets。

已對 Expo 實際 prebuild 產生的 `android/app/build.gradle` 套用 release signing script，使用無效示範環境值驗證：release buildType 唯一指向 `signingConfigs.release`，其 keystore 路徑、alias 與密碼均由 `PLAY_UPLOAD_*` 環境變數取得；debug buildType 唯一維持 `signingConfigs.debug`。未使用 debug key 建立正式 AAB。

新的 upload keystore、公開 PEM 與所有暫存密碼現由 `.play-signing-temp/` 全目錄 Git 忽略規則保護。GitHub CLI 可讀取儲存庫與 Actions workflow，但目前對 Actions secrets public-key API 回覆 `403 Resource not accessible by integration`；若此權限未由瀏覽器帳號補足，後續需改由 GitHub 網頁的 repository／environment secrets 介面安全設定四個 `PLAY_UPLOAD_*` secrets，絕不在訊息、原始碼或命令列揭露其值。

GitHub 網頁帳號 `jason123453021-prog` 已確認可管理 `jason123453021-prog/bike-assistant`。已建立 deployment environment `play-production`，目前未啟用 reviewer、wait timer 或 branch restriction，且尚未含任何 environment secrets。此 environment 對應正式 AAB workflow 的 `environment: play-production`，後續只可在其加密 secrets 介面設定四個 `PLAY_UPLOAD_*` 值。

嘗試以 GitHub 官方 device authorization 刷新本機 CLI 的 Actions secrets 權限時，因裝置碼輸入元件的分段格式未正確解析而回覆 not-found。未完成授權、未取得新權杖，亦未建立或修改任何 secret；後續若需 CLI 寫入 secrets，必須建立新的裝置授權請求並讓頁面使用正確的八碼分段格式，或改用已登入的 environment secrets 網頁介面。

後續以新的 GitHub 官方 device authorization 成功完成 CLI 授權後，已在 `play-production` environment 設定 `PLAY_UPLOAD_KEYSTORE_BASE64`、`PLAY_UPLOAD_KEYSTORE_PASSWORD`、`PLAY_UPLOAD_KEY_ALIAS` 及 `PLAY_UPLOAD_KEY_PASSWORD` 四個加密 secret。僅透過 GitHub API 核對名稱與更新時間，未讀取或輸出任何 secret 值。

## 正式簽署 AAB 驗證（2026-08-23）

GitHub Actions run [32632772836](https://github.com/jason123453021-prog/bike-assistant/actions/runs/32632772836) 已成功完成 `Google Play 正式 AAB` workflow。品質守門、Android prebuild、受保護 upload keystore 還原、release signing patch、`bundleRelease` 與 artifact 上傳均成功。artifact `bike-assistant-google-play-aab` 未過期，GitHub API 回報大小為 37,053,977 bytes；下載後的 `app-release.aab` 大小為 37,530,966 bytes。

使用 JDK `keytool` 驗證 AAB 的 JAR 簽署憑證 SHA-256 為 `B1:A5:FB:BA:CF:83:2A:92:7A:61:3F:6A:FE:C2:91:FC:10:50:D9:46:01:EC:02:93:76:5A:DF:EA:D5:C1:8F:C3`，與 Play Console 目前 upload key 憑證相符。再依 Android 開發人員官方 bundletool 文件，以 bundletool `dump manifest` 直接驗證 bundle package 為 `com.jason123453021.bikeassistant`、versionCode 為 `10090`、versionName 為 `1.0.90`。該 AAB 尚未上傳、建立測試版本或提交至 Google Play。

帳號擁有者已確認將 AAB 上傳至正式版草稿。Play Console 已建立新的正式版草稿（prepare route 的 release id `7`），但尚未附加新 AAB。瀏覽器自動上傳第一次因檔案位於 `/tmp` 而被安全路徑限制拒絕；複製至 `/home/ubuntu/Downloads/google-play-aab/` 後，第二次因 Play Console 的動態檔案輸入欄位未被上傳介面定位而失敗。兩次皆未傳送任何檔案到 Google Play，草稿仍為空。

後續已將作用中的 `.aab` input 暫時賦予受控瀏覽器可辨識的標籤，並成功從 `/home/ubuntu/Downloads/google-play-aab/bike-assistant-1.0.90-10090.aab` 上傳。Console 顯示檔案已完整傳送，狀態為「會經過最佳化處理再發布」，表示 Google Play 已接收 AAB 並在處理中；截至此紀錄，表格尚未顯示新的 versionCode，且未填入版本名稱、版本資訊、未儲存草稿、未進入預覽、未送交審查或推出。

Google Play 完成處理後拒絕該 AAB，原因並非簽署或版本號錯誤，而是新 upload key 的重設尚未生效。Console 顯示原文：新上傳憑證「在世界標準時間 2026年8月25日 上午9:23:29之後」才可重新上傳。這表示 Play Console 的憑證頁雖已顯示新公開憑證，但新私鑰實際可用仍有延遲。已保留空白的正式版草稿，未填任何版本資料、未儲存為有效草稿、未送審或推出；必須在指定 UTC 時間後重新上傳同一個已驗證的 AAB。

使用者選擇於生效時間後重新嘗試。已嘗試建立一次性自動重試排程，但目前為 collaboration session，平台拒絕建立排程。由於預設 sandbox 不保證跨工作階段持續執行，不能以本機等待程序替代可靠排程。待生效時間後，應由使用者在此對話重新通知或開啟續作，使用既有草稿與已保留 AAB 重試；在此之前不得聲稱將自動執行。

正式版頁面仍列出舊版 `10089` 的三項技術品質訊息：expo-audio 的 `BOOT_COMPLETED` 前景服務限制、無邊框 API 淘汰提示與 Android 16 大螢幕方向／大小調整提示。新 1.0.90 AAB 的預先檢查、target SDK 36 與設定需在成功附加 bundle 後重新檢視；這些訊息本身尚未證明會阻擋草稿建立。

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
