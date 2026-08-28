# Strava 公開活動統計對齊依據

> 本文件僅整理 Strava 公開說明，不聲稱取得、重製或使用其未公開的專有程式碼。單車助手採用可驗證的資料品質原則，並在缺乏量測或環境資料時明確標示估算或資料不足。

## 可採用的公開原則

| 指標 | 公開原則 | 單車助手採用方式 |
|---|---|---|
| 移動時間與均速 | Strava 以 GPS 位置、距離與速度判定騎乘活動，並通常以移動時間作為騎乘平均速度的基準。 | 僅使用連續、可信的移動 GPS 樣本累積移動時間；停止、室內漂移與資料中斷不累積距離、時間、功率或熱量。 |
| 海拔與爬升 | Strava 優先採用氣壓高度資料；GPS 高度則依高程資料校正，並平滑、剔除離群值。無強氣壓資料時，累計爬升需持續跨過 10 m 閾值。 | 沒有氣壓計與本機高程資料庫時，以保守高度死區、連續移動距離與持續坡度視窗抑制 GPS 垂直雜訊；不把瞬時高度跳動當成爬升或最大坡度。 |
| 平均功率 | Strava 可在體重、自行車重量、速度與可信高程資料俱備時估算功率；平均功率包含滑行時的 0 W。 | 僅在具備足夠個人設定與可信移動／高程樣本時提供「本機估算」平均功率；否則顯示「資料不足」，不以 0 W 假裝有效。 |
| 卡路里 | Strava 活動頁將卡路里列為活動統計；公開文件未提供可重製的專有熱量公式。 | 使用可解釋的功率機械功／MET 本機估算，依資料來源標記功率或 MET 估算，不宣稱與 Strava 專有熱量公式完全相同。 |

## 參考資料

1. [Strava：Moving Time, Speed, and Pace Calculations](https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations)
2. [Strava：Elevation on Strava FAQs](https://support.strava.com/en-us/articles/15402093-elevation-on-strava-faqs)
3. [Strava：How to Get Power for Your Rides](https://support.strava.com/en-us/articles/15401944-how-to-get-power-for-your-rides)
4. [Strava：Elevation](https://support.strava.com/en-us/articles/15401909-elevation)
