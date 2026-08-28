# Google Play 正式版與資訊主頁唯讀觀察

**核對時間：** 2026-08-27 11:05 GMT+8  
**應用程式：** 單車助手（`com.jason123453021.bikeassistant`）  
**操作範圍：** 僅讀取；未上傳 AAB、未儲存、未送審、未修改發布或政策設定。

## 正式版與版本資訊

| 位置 | 可觀察到的事實 | 意義 |
| --- | --- | --- |
| [正式版頁](https://play.google.com/console/u/0/developers/6488126105445703939/app/4973516244048350089/tracks/production) | 目前有效的最新正式版為 `10102 (1.0.102)`；覆蓋 172 個國家／地區；正式頁顯示「已在 Google Play 上架」，發布日期為 8 月 27 日上午 4:43。 | 現行 production 已公開，沒有待推出的正式版草稿。 |
| [最新版本和套件](https://play.google.com/console/u/0/developers/6488126105445703939/app/4973516244048350089/releases/overview) | 套件清單目前最新上傳者仍為 `10102 / 1.0.102`；新建置的 `10103 / 1.0.103` 尚未上傳至 Play。 | 下一個可採取的正式版動作是上傳已完成的 `10103` AAB，非重複操作 10102。 |
| [發布總覽](https://play.google.com/console/u/0/developers/6488126105445703939/app/4973516244048350089/publishing) | 顯示沒有取消發布的變更。 | 沒有需要撤回或補按的發布動作。 |

## 資訊主頁建議行動與處理判斷

| Google Play 通知／指標 | 畫面內容 | 可行優化與邊界 |
| --- | --- | --- |
| 目標 API 級別期限 | 通知稱已獲延期，必須在 **2026-11-01** 前依部分目標 API 級別規定更新；逾期後，目標 API 不是 Android 最新版本發布後一年內者將無法更新。 | `1.0.103 / 10103` 的 Expo 設定已明確使用 Android compile／target SDK 36，且受保護 upload key AAB 建置成功。上傳到 Play 後再以 Console pre-check 取得此通知是否解除的實際結果；此處尚未寫入。 |
| Android 開發人員驗證 | 通知要求在 **2026-09-30** 前完成 Android 開發人員驗證註冊。 | 此為帳戶層級、非程式碼可自動修復事項。需由帳戶擁有者在 Play Console 依官方流程完成，不可由本次 app 版本上傳替代。 |
| 當機率、ANR、安裝、安裝數與平均評分 | 資訊主頁目前顯示「尚無資料，很快就會準備就緒」。 | 新版推出後應觀察 Android Vitals 與安裝資料；現階段不能把空白指標解讀為零問題或成效。 |
| 每月使用中裝置數量 | 顯示 1，較前 28 天減少 67%。 | 屬觀察指標而非發布阻擋。可待新版穩定後，以已送審的 Local-first 商店資訊、更新內容與使用者回饋改善自然發現；不應捏造成效。 |
| 定價最佳化 | 顯示一般性的定價策略推廣通知。 | 本 app 目前不需因該一般推廣訊息變更免費／付費或新增 SKU；任何定價調整需另行產品決策。 |

## 對 1.0.103／10103 的下一個可逆步驟

已完成的 Google Play AAB artifact 對應 GitHub Actions [run 33064135669](https://github.com/jason123453021-prog/bike-assistant/actions/runs/33064135669)。下一個可逆動作是：在使用者確認後，將 AAB 上傳至正式版草稿並讀取 pre-check。該動作不會立即替換公開中的 `1.0.102 / 10102`；是否送交 Google 審查，必須在 pre-check 結果顯示後另按使用者已選定的範圍處理。


### 12:27 — 1.0.104 正式版 AAB 上傳進度

Google Play 正式版建立新版本頁顯示正在上傳 `bike-assistant-1.0.104-10104.aab`，畫面曾顯示 `19.2 MB of 37.8 MB`，尚未完成 bundle 驗證，因此目前仍不能填寫版本資訊、執行 pre-check 或送交審查。Google Play「從程式庫新增應用程式套件」彈窗目前只列出舊構件 `10089 / 1.0.89` 至 `10081 / 1.0.81`，尚未出現 `10104`。本次上傳來源為已核對 SHA-256 `b486f13933d76cff609a735aa89aaeff0d2b38a25f81eeb794f9ce5a21e78c5c` 的候選 AAB；目前未有送審或發布結果。


### 12:28 — AAB 上傳完成、等待 Play 草稿刷新

頁面已不再顯示上傳進度，改顯示「上傳的 bike-assistant-1.0.104-10104.aab 會經過最佳化處理再發布」，代表瀏覽器端檔案傳輸完成。可是「成果」列仍顯示既有 `10102 (1.0.102)`，版本名稱與版本資訊仍未填寫；因此目前只可說 AAB 已完成傳輸，尚不能說 1.0.104 已加入正式版草稿、已通過 pre-check 或已送審。下一步需重新整理／等待 Play 後端解析，再以畫面核對版本代碼與阻擋訊息。


### 12:29 — 重新上傳後的即時狀態

重新載入正式版草稿頁後，第一次上傳狀態已清除且成果列仍為 `10102 (1.0.102)`；重新開啟「上傳」並填入同一個已驗證 AAB 後，頁面再次顯示 `正在上傳 bike-assistant-1.0.104-10104.aab`，進度曾為 `819 KB of 37.8 MB`。此時尚未完成後端解析，仍未出現 `10104` 成果列，也尚未開始 pre-check 或送審。


### 12:30 — 第二次上傳持續中

Google Play 頁面目前顯示 `正在上傳 bike-assistant-1.0.104-10104.aab`，進度為 `22.7 MB of 37.8 MB`。成果列仍暫時顯示既有 `10102 (1.0.102)`，所以 1.0.104 尚未完成 Play 端解析、尚未可執行 pre-check，亦未送交審查或發布。


### 16:29 — 1.0.105／10105 重新上傳嘗試

受控暫存端點已確認可回傳正確的 `bike-assistant-1.0.105-10105.aab`（HTTP 200、Content-Length 37,795,395、SHA-256 已於 1.0.105 發布 QC 報告記錄）。Google Play 正式版頁目前仍只顯示成果列 `10102 (1.0.102)`；重新建立上傳欄位後，瀏覽器檔案上傳控制仍回報無法定位 input，故 1.0.105 尚未加入成果列、尚未進入 pre-check，也尚未送審。不得將本次端點可取得誤判為 Play 已接受 bundle。

### 16:36 — 1.0.105／10105 AAB 已進入 Google Play 上傳

已將 `/home/ubuntu/play-upload-10105/bike-assistant-1.0.105-10105.aab` 選入 Google Play 正式版草稿；頁面明確顯示「正在上傳 bike-assistant-1.0.105-10105.aab」及 `0 B of 37.8 MB`，代表 Play 已接受檔案並開始傳輸。此時成果列仍暫時只有 `10102 (1.0.102)`，需等待傳輸與後端 bundle 解析完成；尚未輸入版本資訊、尚未執行 pre-check、尚未送審。

### 16:37 — 1.0.105／10105 AAB 傳輸完成，等待後端解析

Google Play 頁面已由「0 B of 37.8 MB」轉為「上傳的 bike-assistant-1.0.105-10105.aab 會經過最佳化處理再發布，你可以離開這個頁面。」檔案傳輸已完成並進入 Play 後端最佳化／解析階段；成果列暫時仍只有 `10102 (1.0.102)`，尚未可執行 pre-check、尚未送審。

### 16:38 — 1.0.105／10105 已解析並通過可發布 pre-check

Google Play「檢查版本」頁已顯示「已可發布」。新成果列為 `10105 (1.0.105)`，API 24 以上、目標 SDK 36、螢幕版面配置 4、ABI 2、必要功能 4；相較公開中的 `10102 (1.0.102)`，支援裝置摘要顯示手機 12,224、平板 6,360、電視 2、車內裝置 1、Chromebook 10、Android XR 1，停止支援與新支援皆為 0。推出比例為 `100.0%`，適用於所有指定國家／地區。頁面未顯示新的發布阻擋；版本資訊仍未另行填寫。下一步為儲存此發布設定，並到發布總覽按「送交審查」。

### 16:39 — 1.0.105／10105 已儲存至發布總覽

已在「檢查版本」頁儲存 100% 全面推出設定；Google Play 導向「發布總覽」，顯示「送審 1 項變更」，變更內容為正式版 `10105 (1.0.105)`、開始全面推出。Play 正在快速檢查常見問題，頁面顯示最多還剩 14 分鐘；送審按鈕已存在，但應待檢查結果明確後再執行。

### 16:40 — 發布總覽快速檢查尚未完成

發布總覽仍顯示 `送審 1 項變更`，變更為正式版 `10105 (1.0.105)`、全面推出；Play 的「正在快速檢查常見問題」尚未結束，剩餘時間從 14 分鐘降至 13 分鐘。頁面未顯示新的錯誤或阻擋，但在快速檢查完成前不把送審按鈕視為最終通過。

### 2026-08-28 00:54 — 1.0.105／10105 已成功送交 Google Play 審查

Google Play「發布總覽」已由「尚未送審的變更」改為「審查中的變更」，唯一列出的正式版變更為 `10105 (1.0.105)`、開始全面推出。這確認先前的最終確認已成功送出；目前尚未公開推出或取代 `1.0.102／10102`，必須等待 Google Play 審查通過後才會依已儲存的 100% 設定發布。Data Safety 未包含在本次送審變更中，也未被修改或提交。

### 2026-08-28 01:xx — 1.0.105 Play 建議的原生建置事實稽核

使用官方 Bundletool 解析已上傳的 `bike-assistant-1.0.105-10105.aab`（SHA-256 `130dd15ca66623f509aa9c7d803e55bb3f3a37364a468c10d831257163aeb8f8`），確認 base manifest 為 `compileSdkVersion="36"`、`targetSdkVersion="36"`、`versionCode="10105"`、`versionName="1.0.105"`；因此 Play 顯示「最高 API 35」與檔案內容不一致，應視為 Console 分析資料延遲或快取，不能據此把 AAB 誤判為 target 35。GitHub Actions run `33091212744` 同時記錄 compile／target SDK 36，並執行 `:app:minifyReleaseWithR8`。

Google Play 所列 Edge-to-Edge 起點是 Media3、Fresco 與 APNG 的原生類別，並非 App 程式直接呼叫 `Window.getStatusBarColor`／`setStatusBarColor`／`setNavigationBarColor`。App 使用 `expo-image` 顯示 POI 預覽，既有程式已採用磁碟快取、native downscaling、early resizing 與 recycling key；本輪另以 RGB decode 與低優先序載入非必要照片，降低顯示預覽時的解碼與記憶體壓力。

Android 官方指出 AGP 8.12 起，在 release 已啟用 minify 與 shrinkResources 的前提下，可用 `android.r8.optimizedResourceShrinking=true` 啟用整合式資源縮減；AGP 9 才預設開啟，但涉及 Kotlin 與 DSL 的重大相容性遷移。原專案的 SDK 54／React Native 0.81 原生模板使用 AGP 8.11；本輪升級至相容的 Expo SDK 57／React Native 0.86 原生組合，使用 AGP 8.12 並明確寫入最佳化資源縮減。參考：https://developer.android.com/topic/performance/app-optimization/enable-app-optimization；https://developer.android.com/build/releases/agp-9-0-0-release-notes；https://docs.expo.dev/router/migrate/sdk-55-to-56/。

啟動圖示 `icon.png`、`splash-icon.png` 與 `android-icon-foreground.png` 均由 1,024×1,024 全色 PNG 重新編碼為 256 色索引 PNG；每一檔案由 708,819 bytes 降至 30,229 bytes，總共減少 2,035,770 bytes，維持 PNG、1,024×1,024 與原有圖樣。視覺檢視確認輪框、閃電與黑白高對比細節保持清晰；不改用 WebP，以維持 Expo launcher／adaptive icon 與 splash 設定的跨裝置相容性。
