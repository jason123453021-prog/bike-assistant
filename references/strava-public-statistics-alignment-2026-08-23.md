# Strava 公開統計原則對照（2026-08-23）

本專案無法存取 Strava 的專有原始碼；本輪僅依其官方公開說明，對齊可驗證的資料處理原則。

| 指標 | Strava 公開原則 | 本機採用方向 |
| --- | --- | --- |
| 移動時間 | 以 GPS 位置、距離與速度推定；若檔案含明確暫停事件則尊重裝置 timer time。 | 維持騎乘開始／暫停狀態機，避免背景回復或短暫低速重複／過早扣除移動時間。 |
| 平均速度 | 總距離除以總移動時間。 | 分圈與全程皆採相同的距離／移動時間分子分母；分圈需在固定里程邊界插值。 |
| GPS 距離 | GPS 檔以座標串接或裝置累計 distance stream 取得距離；GPS 跳點會造成差異。 | 使用已通過品質閘門的 Haversine 區間距離，拒絕不可信跳點，並保留完整距離累計。 |
| 海拔 | GPS 海拔會平滑並施加累積門檻；無氣壓資料時可用高程資料庫修正。 | 保留現有 11 點平滑與 5 m 累積門檻，並明確標示為裝置 GPS 估算而非 Strava 地圖高程重算。 |
| 最大速度／功率 | GPS 的單點誤差可造成不合理峰值，Strava 亦說明最大速度會受相鄰 GPS 座標影響。 | 虛擬功率使用經速度品質閘門與短窗平滑的樣本，不將單一 GPS 尖峰直接寫入最大功率。 |

## 官方來源

1. Strava Support, [Moving Time, Speed, and Pace Calculations](https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations)。
2. Strava Support, [How Distance is Calculated](https://support.strava.com/en-us/articles/15401893-how-distance-is-calculated)。
3. Strava Support, [Elevation on Strava FAQs](https://support.strava.com/en-us/articles/15402093-elevation-on-strava-faqs)。
