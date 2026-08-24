# Strava 公開自動暫停原則對齊紀錄

更新日期：2026-08-24

## 可驗證的公開行為

Strava 官方說明指出，單車自動暫停以 GPS 移動來判斷休息，重新移動時解除暫停；跑步則採加速度計動作判定。[1] [2] 其移動時間會使用 GPS 位置、距離與速度推算，且公開說明也明確表示實作上存在速度閾值與停止時間的取捨，而非單一通用的「正確」秒數。[3]

Strava Engineering 公開文章進一步描述其單車即時策略：伺服器端把低於某速度閾值且持續超過 15 秒的區間視為休息；手機端則在超過 10 秒未收到正速度定位時自動暫停，並於新的定位同時滿足最小距離與最小速度時快速恢復。[4]

## 本機採用規則

本 App 不宣稱取得或重製 Strava 的專有程式碼。單車模式改採其公開的保守方向：以 GPS 移動與正速度樣本辨識、以約 10 秒級的固定防抖避免短暫紅燈誤暫停、無 GPS 定位時以牆鐘時間保護、恢復時採速度與位移可信度。跑步與越野跑維持既有加速度計靜止條件；登山保留提示模式，避免慢速步行頻繁切換。

為降低設定負擔，設定頁只保留自動暫停總開關；單車門檻與延遲改由已驗證的本機運動策略決定。舊版自訂值僅作相容讀取，不再影響新的自動判定。

## 來源

1. [Strava Help Center — Auto-Pause](https://support.strava.com/en-us/articles/15402141-auto-pause)
2. [Strava Help Center — How to Fix Autopause Issues](https://support.strava.com/en-us/articles/15401874-how-to-fix-autopause-issues)
3. [Strava Help Center — Moving Time, Speed, and Pace Calculations](https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations)
4. [Strava Engineering — Improving Auto-Pause for Everyone](https://medium.com/strava-engineering/improving-auto-pause-for-everyone-13f253c66f9e)
