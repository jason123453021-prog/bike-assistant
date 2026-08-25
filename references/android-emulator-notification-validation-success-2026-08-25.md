# Android Emulator 通知與字體大小驗收成功紀錄（2026-08-25）

GitHub Actions run `32841510977`（head `ba2c494e`）成功完成 Android release APK、核心導覽、原生通知與多語系字體大小流程。

| 驗收項目 | JUnit 結果 | Artifact 視覺核實 |
| --- | --- | --- |
| 核心導覽 | 1／0 failures | 完成 |
| 本機通知排程 | 1／0 failures | 完成 |
| 背景通知本體回前景 | 1／0 failures | 通知點擊後顯示地圖頁的 **Refuel** 待確認 Modal，確認按鈕可見 |
| 130% 字體大小 | 3／0 failures | 德文、俄文、Arabic 截圖已產生 |
| 200% 字體大小 | 3／0 failures | 德文、俄文、Arabic 截圖已產生；已檢視 Arabic RTL 設定頁，文字換行與底部分頁對齊穩定 |

這是 Android Emulator 證據，不等同於實體 Android 裝置的 OEM 通知、字型與背景限制驗證。實體裝置項目仍須保持待完成。
