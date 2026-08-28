# d477a664 效能與穩定性復檢報告

**檢驗日期：** 2026-08-19（GMT+8）  
**檢驗對象：** 單車助手版本 `d477a664` 及本輪修復後工作區。  
**範圍：** 型別與靜態品質、騎乘資料熱路徑、監聽與持久化、權限與離線回退、功能有效性、Android 發布設定與 Hermes bundle 預檢。

> 本輪結論：已修復三個可重現的功能有效性問題；最終靜態、回歸、Expo 相容性與 Android Hermes bundle 預檢均通過。實體 Android 的長時間背景 GPS、飛航模式地圖快取及剪貼簿仍應在正式 APK 安裝後進行現場驗收。

## 檢驗結果摘要

| 面向 | 結果 | 佐證 |
|---|---:|---|
| TypeScript | 通過 | `pnpm check`：0 errors。[1] |
| ESLint | 通過 | `pnpm lint`：0 warnings／0 errors。[1] |
| 完整回歸 | 通過 | 87 個測試檔通過、1 個樣板登入檔跳過；281 passed／1 skipped。[1] |
| Expo 相容性 | 通過 | Expo Doctor：18/18 checks passed。[2] |
| Android bundle 預檢 | 通過 | Hermes Android bundle 成功匯出，約 5.8 MB。[3] |
| 原生風險 | 通過 | 未偵測到 NitroModules、C++ 原生模組、PiP 或 `SYSTEM_ALERT_WINDOW` 正式設定殘留。[4] |

## 騎乘熱路徑與資源生命週期

靜態稽核與既有回歸確認定位訂閱、背景定位任務、AppState、計時器、補給倒數及活動生命週期都有停止／清理路徑；本機活動快照與歷史保存維持既有批次與上限策略。核心統計、GPS 點品質、背景復原、騎乘生命週期、持久化批次與活動統計測試均納入完整回歸結果。[1] [5]

此結論代表程式碼層面沒有發現會使資料每秒無限寫入、停止後仍累加，或設定頁重設後被舊載入資料覆寫的可重現問題；它不取代實體裝置上的長時間騎乘壓力測試。

## 本輪修復的功能有效性問題

| 發現 | 修復 | 影響 |
|---|---|---|
| 分享卡「複製分享文字」僅顯示成功提示，實際沒有寫入剪貼簿。 | 加入官方 `expo-clipboard`，以 `Clipboard.setStringAsync` 寫入文字並處理失敗回饋。 | 分享文字可貼到其他 App；不再有假性成功提示。 |
| Android 權限管理器有永遠回報未授權的懸浮窗項目，設定亦保留相關字串。 | 移除 `overlay` 型別、檢查與設定跳轉，並從 Android 發布設定移除 `SYSTEM_ALERT_WINDOW`。 | 不再要求無實際用途的特殊權限或顯示無法完成的引導。 |
| 觸控鎖定覆蓋層包含空白 `onPress`。 | 移除空白處理器，保留既有的長按解除鎖定流程。 | 控制項行為與畫面語意一致。 |

## 離線、權限與發布邊界

騎乘紀錄、設定、統計、補給倒數與既有活動資料由裝置端處理；路由與地圖瓦片則屬按需外部資料。離線或路由端點失敗時，現有路由服務維持安全回退，不應清除本機騎乘資料。定位、通知與電池最佳化仍由既有權限準備畫面引導，未保留 PiP 或系統級懸浮窗需求。[4] [6]

開發服務日誌中可見較早期的套件安裝／快取錯誤記錄；在本輪安裝官方剪貼簿模組後已重啟服務，最新 bundle 與 Android 匯出成功。這些歷史日誌不構成正式 APK 的執行時錯誤。

## 實機驗收重點

| 情境 | 驗收條件 |
|---|---|
| 分享卡 | 點選「複製分享文字」後，在記事本或通訊軟體貼上，內容必須相同。 |
| 權限 | 拒絕定位／通知後，確認畫面仍顯示中文引導且不白屏；重新授予後可開始騎乘。 |
| 背景騎乘 | 螢幕關閉、切換 App、回到前景後，軌跡、距離、活動時間與補給待確認狀態應連續。 |
| 飛航模式 | 查看既有紀錄與設定時不出現請求失敗彈窗；已載入資料與本機統計仍可使用。 |

## 參考佐證

[1]: d477-review-evidence/final-vitest.txt "最終 TypeScript、Lint 與 Vitest 輸出"
[2]: d477-review-evidence/final-expo-doctor.txt "Expo Doctor 最終輸出"
[3]: d477-review-evidence/final-android-export.txt "Android Hermes bundle 匯出輸出"
[4]: d477-review-evidence/functionality-offline-audit.txt "功能、離線與權限稽核"
[5]: d477-review-evidence/hot-path-audit.txt "熱路徑、監聽與本機持久化稽核"
[6]: d477-review-evidence/release-health-audit.txt "套件與正式發布健康度稽核"
