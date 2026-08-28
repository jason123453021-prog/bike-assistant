# Strava 公開統計對齊追蹤（2026-08-23）

本輪使用者提供的同趟實測截圖顯示：本機紀錄為 6.77 km、12:10、33.4 km/h、10 m、283 W、258 kcal；Strava 顯示 6.86 km、13:50、29.8 km/h、13 m、221 W、204 kcal。此差異用於定位本機資料鏈的回歸情境，不代表可取得或重現 Strava 的專有程式碼。

Strava 官方說明指出，單車的移動時間會依 GPS 位置、距離與速度推算；上傳後會以記錄的 GPS 資料重新計算，且速度門檻與其他裝置可能不同。平均速度以距離除以移動時間；GPS 間的連線、訊號流失與資料處理會造成差異。[1][2]

Strava 亦說明：沒有氣壓高度計的 GPS 活動會交叉比對高程資料庫並進行較強的平滑與離群值排除；海拔累積本質上是估計值。[3]

本輪修正方向為保留有效但較稀疏的連續 GPS 區間、以已接受的 Haversine 距離／時間衍生速度進行虛擬功率與卡路里積分，並維持 GPS 品質、超速與漂移防護。此目標是改善可解釋的一致性，不能保證與 Strava 每一筆結果完全相同。

## 來源

[1] [Strava — Moving Time, Speed, and Pace Calculations](https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations)

[2] [Strava — How Distance is Calculated](https://support.strava.com/en-us/articles/15401893-how-distance-is-calculated)

[3] [Strava — Elevation](https://support.strava.com/en-us/articles/15401909-elevation)
