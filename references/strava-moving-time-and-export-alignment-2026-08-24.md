# Strava 公開移動時間與匯出對齊依據

更新日期：2026-08-24

## 可公開驗證的原則

Strava 將 elapsed time 定義為從開始到結束的完整經過時間，包含停等、休息與拍照；moving time 則嘗試依活動 GPS 位置、距離與速度判定實際活動時間。對騎乘上傳資料，Strava 會以記錄到的 GPS 資料重新計算其 moving time，因此來源裝置的算法可能不同。[1]

Strava 的活動 API 將 `moving_time` 與 `elapsed_time` 視為不同欄位；範例活動同時保留距離、爬升、平均／最大速度、平均／最大功率與機械工作量等資料。[2]

Strava 接受含實際運動資料的 GPX、TCX 與 FIT 檔案；因此本機匯出必須保留連續可信 GPS 點及其原始時間戳，不能僅以自動暫停狀態刪除座標。[3]

## 本機對齊策略

本專案採取「原始點優先、可信區間統計」：活動未手動停止前保留可接受的 GPS 時間戳座標；距離、moving time、功率積分與卡路里只使用連續、精度與位移通過品質閘門的 GPS 區間。`elapsed time` 由活動開始到停止的牆鐘時間保存，`moving time` 不再依前景 timer 或自動暫停狀態單獨決定。

為避免不實對齊聲明，本專案**不宣稱**使用或重製 Strava 未公開的速度門檻、濾波參數、伺服器端 GPS 分段或專有原始碼；數值與呈現僅對齊上述公開語意與標準檔案欄位。

## 參考資料

[1]: https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations
[2]: https://developers.strava.com/docs/reference/
[3]: https://support.strava.com/en-us/articles/15402066-how-to-get-your-activities-to-strava
