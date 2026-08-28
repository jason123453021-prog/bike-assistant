# Android 背景補給提醒介面邊界（2026-08-23）

## 結論

補給或補水到期時，App 應以已授權、高重要性 Android 通知提示使用者，並將待確認狀態保存於本機；使用者點擊通知後，才透過系統提供的 `PendingIntent` 回到導航頁並立即顯示待確認的補給／補水彈窗。

Android 對背景 Activity 啟動有限制。一般補給提醒不能強制把使用者正在使用的其他 App 切換到單車助手，也不應以懸浮窗權限規避此限制。Android 官方將從系統通知點擊送出的 `PendingIntent` 視為允許例外。[1]

全螢幕意圖只適用於最緊急、時間敏感的訊息，且 Android 10 以上需 `USE_FULL_SCREEN_INTENT` 權限；補給與補水提醒不屬來電、鬧鐘等級的緊急事件，因此不使用此機制。[2]

## 本機實作要求

| 情境 | 合規行為 |
| --- | --- |
| 騎乘前景 | 顯示 App 內待確認彈窗，並同時保存／更新本機通知狀態。 |
| App 在背景或螢幕鎖定 | 維持定位前台服務，透過最高重要性補給通知頻道呈現 heads-up 提醒與可操作通知。 |
| 使用者點擊通知 | 由通知 `PendingIntent` 開啟既有導航頁；App 前景恢復時從本機待確認狀態立刻顯示補給／補水彈窗。 |
| 通知權限被拒絕或頻道被使用者關閉 | 保存待確認狀態、提供設定引導；不能保證系統視覺提醒。 |

## 已實作驗證點

目前實作將 `supply` 設為 Android `MAX` 重要性頻道；智慧倒數、即時補給與稍後提醒通知均明確指定此頻道，正式 APK 亦透過 `expo-notifications` 原生設定指定同一 fallback channel。開始騎乘後會請求通知權限，背景定位則由 `expo-location` 的 location 前景服務維持。

通知回應會先保存到本機動作佇列。使用者點擊通知本體時，系統才開啟 App，根布局導向既有導航頁；導航頁將 `open` 動作轉為相對應的待確認彈窗，並保留原有到期旗標，不會將點擊誤當成「已補給」或重設倒數。通知上的「已補給」與「稍後提醒」仍保留各自的既有語意。

本流程未使用 `SYSTEM_ALERT_WINDOW`、Picture-in-Picture、全螢幕意圖或背景強制啟動 Activity。系統可能因使用者關閉頻道、拒絕通知權限或廠商省電策略限制提醒可見性；在這些情境下，下一次回到 App 時仍會依本機待確認狀態顯示彈窗。

## 參考資料

[1] [Android Developers — Background activity launch restrictions](https://developer.android.com/guide/components/activities/secure-bal)

[2] [Android Developers — Create a notification: full-screen intents](https://developer.android.com/develop/ui/compose/notifications/create-notification)
