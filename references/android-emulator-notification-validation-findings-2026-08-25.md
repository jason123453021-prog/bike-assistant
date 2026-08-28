# Android Emulator 本機通知回前景驗收發現（2026-08-25）

GitHub Actions run `32839876046`（head `5f0033f4`）已確認 E2E harness 可建立 `supply` 通知 channel、取得通知權限，並以明確的 `TIME_INTERVAL` trigger 成功排程本機通知。`maestro-notification-schedule.xml` 顯示 1 test／0 failures。

但通知欄點擊 `E2E Fuel reminder` 後，Emulator 回到先前的 **Routes / Route Analysis** 分頁，而不是根布局預期的 `/navigate`；因此未顯示補給待確認 Modal。`maestro-notification-open.xml` 目前為 1 test／1 failure，且 artifact 截圖保留此實際畫面。下一步需將冷啟動／回前景的通知 response 處理與 Router 就緒狀態同步，確保 `onOpen` 導向 `/navigate` 後再由 Map 消費持久化 pending action。
