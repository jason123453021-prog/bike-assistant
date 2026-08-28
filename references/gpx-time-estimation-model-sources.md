# GPX 完成時間本機估算模型

本機模型以 GPX 逐段距離與坡度、騎手體重、預設單車／裝備重量、空氣密度及 App 自動推定 FTP 計算。模型以 FTP 乘上保守的長距離強度係數，透過既有的阻力、重力與空氣阻力公式反解每段速度，合計移動時間；不需要帳號、網路或感測器。

| 採用原則 | 本機實作 |
|---|---|
| 功率與速度由重力、滾阻及空阻共同決定 | 重用 `lib/power-calc.ts` 的逐段功率模型，反解可維持速度 |
| FTP 是約一小時可持續的平均功率基準 | 根據路線預估時長降低強度係數，避免長距離直接套用 FTP |
| 坡度、風與騎姿可造成較大偏差 | 預設顯示為「移動時間預估」，並以區間與影響因素說明，不含休息、路口、交通或天候突變 |

> 完成時間是規劃參考而非保證；沒有實測功率、實際風況與路況時，應保守看待長距離或高爬升路線的預估。

## 參考資料

1. [Cycling power and speed — Steve Gribble](https://www.gribble.org/cycling/power_v_speed.html)：說明重力、滾動阻力、空氣阻力與功率—速度關係。
2. [What is FTP — TrainerRoad](https://www.trainerroad.com/blog/is-my-ftp-too-low/)：FTP 為約一小時可持續的平均功率基準。
3. [Bike Pace Calculator — Best Bike Split](https://www.bestbikesplit.com/bike-pace-calculator)：說明 FTP × 強度、坡度、重量、空阻與完成時間之關係，以及路線與風況的不確定性。
