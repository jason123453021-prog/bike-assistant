# Strava 活動統計對齊稽核（2026-08-24）

## 本次實測差異

| 指標 | Strava 截圖 | 單車助手截圖 | 差異 |
| --- | ---: | ---: | ---: |
| 距離 | 7.41 km | 7.35 km | -0.06 km（-0.8%） |
| 移動時間 | 19:14 | 16:48 | -2:26（-12.6%） |
| 平均速度 | 23.1 km/h | 26.2 km/h | +3.1 km/h（+13.4%） |
| 爬升 | 30 m | 35 m | +5 m（+16.7%） |
| 平均功率 | 166 W | 230 W | +64 W（+38.6%） |
| 熱量 | 213 kcal | 298 kcal | +85 kcal（+39.9%） |

## 公開對齊原則

Strava 公開文件表示，上傳後會從距離資料流計算總距離、平均速度與最大速度；GPS 點品質與連線方式可能造成小幅差異。平均速度則由距離與移動時間導出。[1]

Strava 的移動時間會依 GPS 位置、距離與速度推導；若活動檔具有明確暫停事件，則尊重裝置記錄的移動時間。GPS 漂移、訊號遺失與自動暫停閾值差異，都可能放大移動時間與平均速度落差。[2]

Strava 也公開說明其海拔資料會先平滑去除雜訊，再以持續爬升門檻累計；沒有可靠氣壓高度資料的活動需有超過 10 m 的連續爬升，具有氣壓高度資料時門檻較低。[3]

本輪不宣稱取得或複製 Strava 專有程式碼；修正目標為遵循其公開原則，使本機 GPS 品質閘門、移動時間、平均速度、功率與熱量的資料鏈一致且可驗證。

## 來源

[1] Strava Help Center, [How Distance is Calculated](https://support.strava.com/en-us/articles/15401893-how-distance-is-calculated)

[2] Strava Help Center, [Moving Time, Speed, and Pace Calculations](https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations)

[3] Strava Help Center, [Elevation on Strava FAQs](https://support.strava.com/en-us/articles/15402093-elevation-on-strava-faqs)
