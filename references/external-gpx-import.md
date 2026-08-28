# 外部 GPX 開啟與離線匯入

本功能使用 Expo 官方 `expo-document-picker` 保留 App 內手動選取，並以 Android `VIEW` intent filter 宣告 `.gpx` MIME 類型，讓檔案管理員、瀏覽器下載項目或其他騎乘 App 的系統「開啟方式」可列出單車助手。

根布局同時處理冷啟動的 `getInitialURL()` 與 App 已在前景時的 `url` 事件。外部 URI 僅在本機讀取，解析前後會檢查 URI 類型、10 MB 上限、GPX XML 結構與至少兩個路線點；成功後載入共享路線並切換至導航頁。

> Expo 文件指出，`getInitialURL()` 只處理冷啟動；App 已開啟時需訂閱 `url` 事件。自訂方案與檔案 intent 需要重新建置的 Android App 才能在實機測試，Expo Go 不適用於這類自訂外部開啟流程。

| 項目 | 來源 |
|---|---|
| 檔案選取、`copyToCacheDirectory` 與取消處理 | [Expo DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/) |
| 冷啟動 URL 與前景 URL 事件處理 | [Expo Linking](https://docs.expo.dev/versions/latest/sdk/linking/) |
| Android intent filter 宣告模式 | [Expo Android App Links](https://docs.expo.dev/linking/android-app-links/) |
| Expo 管理工作流的檔案「開啟方式」相關討論與 MIME／path filter 提示 | [expo/expo#25451](https://github.com/expo/expo/issues/25451) |
