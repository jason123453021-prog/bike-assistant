# Strava／Garmin 活動詳情與手動 Lap 對照依據

## 資料處理邊界

本專案不宣稱或複製 Strava、Garmin 的私有底層程式碼。以下僅依兩者公開文件，採用可驗證的資料處理原則，並以本機保存的 GPS、時間、海拔與功率取樣為唯一資料來源。

| 主題 | 公開行為 | 本機實作原則 |
| --- | --- | --- |
| 活動／移動時間 | Strava 將活動時間視為開始至結束，移動時間則依 GPS 位置、距離與速度判定；若檔案已有暫停事件則尊重裝置時間。 | 保存明確暫停時間；在無暫停事件時，以品質過濾後的 GPS 移動樣本重建移動時間。 |
| 平均與最高速度 | Strava 由檔案 GPS 流計算距離、平均與最高速度，並說明任兩 GPS 點誤差可能造成虛高最高速度。 | 最高速度採品質過濾後的相鄰有效取樣，不以缺少速度樣本時的 0 取代資料不足。 |
| 每公里分段 | Strava 將整體平均速度與每公里／自訂分段分開呈現。 | 每公里分段用同一份已正規化的活動軌跡建構；功率只有有效感測或保守本機估算樣本時才顯示。 |
| 手動 Lap | Garmin 的 Lap Key 可在活動中記錄一個 lap 或 rest，並可關閉以避免誤觸。 | 提供騎乘中明確的「標記 Lap」動作；每次標記封存上個 Lap 的時間、距離、爬升、平均／最大速度與可用平均功率，並開始下一段。 |

## 使用者可見資料狀態

任何需要原始取樣卻未保存的欄位都應顯示「資料不足」，而不是顯示 0、假定天氣數值或虛假的訓練值。使用者可見的「本機環境基準」僅表示沒有保存可用環境樣本時採保守本機估算，並非網路或同步失敗。

## 參考資料

1. Strava Help Center, [Moving Time, Speed, and Pace Calculations](https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations)。
2. Garmin, [Instinct Owner's Manual: Turning On and Off the Lap Key](https://www8.garmin.com/manuals/webhelp/instinct/EN-US/GUID-1F13C9AE-E185-4B78-9170-C3D9B187DEF2.html)。
