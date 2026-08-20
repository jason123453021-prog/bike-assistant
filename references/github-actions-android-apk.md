# GitHub Actions Android APK 建置說明

## 目的

`.github/workflows/android-apk.yml` 會在 GitHub 的 Ubuntu runner 上安裝固定版本的 Java、Node.js 與 pnpm，先執行型別、lint 與測試，再以 Expo prebuild 產生 Android 原生專案並執行 Gradle `assembleRelease`。此流程**不會呼叫 EAS Build**，因此不受 Expo 雲端建置額度影響。

## 第一次使用

請先透過專案管理介面的 GitHub 匯出／同步功能，將目前專案推送到您擁有的 GitHub repository。GitHub repository 收到這份 workflow 後，開啟該 repository 的 **Actions** 分頁，選取 **Android 驗收 APK**，按下 **Run workflow** 即可手動執行；後續推送到 `main` 分支的 App、設定或依賴變更，也會自動重新建置。

建置成功後，進入該次 workflow run 最下方的 **Artifacts** 區塊，下載 `bike-assistant-preview-apk`。解壓縮後的 APK 可安裝到 Android 裝置作為功能、GPS 與背景騎乘驗收使用。

## 簽署邊界

此工作流程的目的為產生**可安裝的驗收 APK**。Expo 預建置的 release variant 使用預設開發簽署，適合內部實機測試，但不應直接上傳 Google Play。Google Play 正式 AAB 需要由您控制的 upload keystore 簽署；keystore 不可提交至 Git，也不可貼在對話中。完成驗收後，可另行在 GitHub repository 的 Actions secrets 安全設定 keystore，再建立正式簽署的 AAB workflow。

## 失敗時的排查順序

首先開啟 Actions run 中第一個失敗步驟，保留 `Run gradlew` 的第一段 `FAILURE` 或 `Caused by` 文字。若失敗發生在安裝依賴，請確認 `pnpm-lock.yaml` 已隨程式同步；若發生在 prebuild，請先在本機執行 `npx expo config --json` 檢查設定；若發生在 Gradle，請保留完整錯誤片段，以便針對實際原生錯誤修正。
