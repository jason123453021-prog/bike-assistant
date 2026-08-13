# 本機騎乘分享長圖技術盤點

既有 `ShareCardModal` 僅在原生介面顯示摘要預覽，實際行為為 `Share.share` 的文字分享，下載圖片按鈕尚未實作。專案已內含 `expo-file-system` 與 `expo-sharing`，可先在裝置快取產生分享檔，再以系統分享介面傳遞。

為維持 Local-First 與零 NitroModules，分享卡需使用純 TypeScript 將騎乘資料和本機 GPS 軌跡繪製為 SVG 長圖檔；檔案只寫入快取，不上傳或建立帳號／社群關係。系統分享介面由 Expo 官方 Sharing 模組開啟。
