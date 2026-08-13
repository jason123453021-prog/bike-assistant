# Google Play Android 16（API 36）上傳指引

目前專案設定已固定為：**compile SDK 36、target SDK 36、min SDK 24、version 1.0.3、versionCode 10087**。暫時 Android 預建置所生成的 `gradle.properties` 已確認為 `android.compileSdkVersion=36` 與 `android.targetSdkVersion=36`。

## 上傳步驟

1. 在此版本的專案檢查點確認後，於管理介面點擊 **Publish** 產生新的受管理 Android 產物。請勿重新上傳舊版 1.0.2／versionCode 10086 的 AAB，因為 Google Play 畫面中的 API 35 判定來自舊產物。
2. 完成建置後，先在 Android App Bundle Explorer 或建置詳細資料核對套件名稱 `com.jason123453021.bikeassistant`、versionCode **10087** 與 target SDK **36**。
3. 將這個新的 AAB 上傳至內部測試、封閉測試或正式軌道，再儲存並送出變更。Google Play 只會在新產物完成處理後重新評估 API 級別。
4. 若 Play Console 仍顯示 API 35，請確認是否選到了舊版產物；若新的 versionCode 10087 仍被解析為 35，請提供 Build 詳細頁或 Bundle Explorer 的 Android manifest 完整內容以比對。

> 本次驗證確認專案設定與預建置 Gradle 輸出正確；實際 APK/AAB 的最終 manifest 只能由受管理 Android 建置完成後的產物確認。
