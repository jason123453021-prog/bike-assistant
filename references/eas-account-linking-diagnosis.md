# EAS 帳戶與專案關聯診斷

診斷日期：2026-08-15

## 已確認狀態

- Expo 網頁登入帳戶：`jason123453021`。
- Expo 帳戶總覽顯示目前沒有可見專案（Projects 清單為空）。
- 本機 EAS CLI `whoami` 回傳 `Not logged in`，因此 CLI 無法代表此帳戶執行 `project:init`。
- App 動態設定輸出中沒有 `extra.eas.projectId`。

## 結論

雲端 Android 發佈失敗與缺少可用的 Expo EAS 專案關聯相符。下一步需要在使用者已登入的 Expo 帳戶中建立或連結一個 EAS 專案，取得服務端簽發的 UUID，並寫入 `app.config.ts` 的 `extra.eas.projectId`。這會建立遠端帳戶資源，需使用者確認後再進行。
