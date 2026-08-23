# 自動記圈、均速與 Strava 公開統計原則稽核

**稽核日期：** 2026-08-23  
**範圍：** Android 單車活動的前景／背景 GPS、距離、移動時間、自動暫停、固定距離自動分圈、活動摘要與虛擬功率。

## 結論

本專案**沒有自訂 Kotlin 服務**；自動記圈與均速並非遺漏在原生層。它們由 `app/(tabs)/map.tsx` 的前景定位回呼及 `lib/background-location.ts` 的 Expo `TaskManager.defineTask` 背景任務執行，兩者共用 `lib/auto-lap-milestones.ts` 的固定里程邊界工具。Expo 原生層只負責系統提供的定位與前景服務承載；演算法與持久化位於 TypeScript／AsyncStorage。

Strava 未公開其活動計算的原始碼或所有門檻，因此無法誠實宣稱「與 Strava 程式碼完全相同」。Strava 官方也說明會在上傳後獨立解析紀錄資料，裝置端與平台端的數值可因各自的資料處理而有小幅差異。[1] 本次採用的驗收標準是**依 Strava 公開原則對齊資料來源與統計定義，並以可測試的固定門檻消除前景／背景的不一致**。

## 執行層確認

| 功能 | 前景執行層 | 鎖屏／背景執行層 | 共用資料／演算法 | Kotlin 狀態 |
|---|---|---|---|---|
| 使用者自訂距離自動記圈 | `map.tsx` | `background-location.ts` | `auto-lap-milestones.ts` | 無自訂服務 |
| 單圈均速 | 固定邊界距離 ÷ 單圈移動時間 | 同上 | `buildAutoLap` | 無自訂服務 |
| GPS 距離與移動時間 | `Location.watchPositionAsync` | `TaskManager.defineTask` | `track-point-quality.ts`、`activity-statistics.ts` | 無自訂服務 |
| 活動摘要平均速度 | `RideContext` | 背景快照回前景後同步 | `buildActivityStatistics` | 無自訂服務 |

## 公開原則與本機實作對照

| 項目 | Strava 公開說明 | 本機目前規則 | 稽核結果 |
|---|---|---|---|
| 距離 | 以活動檔中的距離資料流或 GPS 點連線形成距離，GPS 點之間以直線連接並可能產生小差異。[1] | Haversine 計算；精度超過 30 m、重複／倒退時間戳、75 秒以上中斷跨段、或隱含速度超過 110 km/h 的點不累計。 | 對齊「GPS 資料流＋離群值抑制」；Strava 未公開相同數值門檻。 |
| 移動時間 | 以 GPS 位置、距離與速度判定；其休息速度與秒數門檻未公開，裝置與 Strava 可不同。[2] | 單車低於 1.08 km/h 且無連續可靠位移時累積低速；滿 8 秒才暫停，可靠移動且達 1.8 km/h 立即恢復。 | 已修正背景原先過早凍結的差異，前後景採同一防抖與恢復語意。 |
| 平均速度 | 距離 ÷ 移動時間。[1] [2] | `buildActivityStatistics` 與每一圈均以已接受距離 ÷ 移動時間計算。 | 對齊定義。 |
| 固定距離自動記圈 | Strava 未公開本 App 同類的分圈演算法。 | 前一筆與目前累計值線性插值到 1／5／10 km 等使用者設定的固定邊界，支援單次跨多個里程碑。 | 避免 GPS overshoot、0 km Lap 與異常均速。 |
| 海拔 | 使用原檔氣壓高度或道路／路徑對照資料庫，並平滑且排除離群值。[3] | 11 點移動平均、5 m 門檻與最少移動距離；僅累加已接受高度。 | 對齊「平滑＋排除噪訊」；未具備 Strava 社群海拔底圖，不能承諾數值相同。 |
| 最大速度／功率 | Strava 表示 GPS 誤差可造成最大速度偏高。[2] | 速度拒絕不合理隱含速度；最大虛擬功率只採平滑、有效移動且未碰到模型飽和值的樣本。 | 已避免單點 GPS／坡度尖峰主導峰值；虛擬功率不是功率計實測值。 |

## 本次修正

背景 TaskManager 先前會在首筆不可靠低速樣本立即停止累積移動時間與補給倒數，與前景的 8 秒防抖不一致。現在新增 `background-auto-pause.ts`：背景每個 GPS 時段先判斷是否仍在防抖，僅將門檻前的秒數加到移動時間；真正進入暫停後，才凍結距離、功率、熱量、自動分圈與補給倒數。恢復時要求可靠位移與至少 1.8 km/h，與前景單車設定一致。

固定里程分圈與背景統計已有下列回歸守門：1 km 邊界準確插值、單筆跨多里程碑補齊、沒有 0 km 分圈、單圈移動時間必須為正且均速小於 100 km/h；此外新增背景 8 秒防抖、1.8 km/h 恢復與停用自動暫停行為測試。

## 仍需實機驗收的差異來源

即使統計定義與品質閘門對齊，與 Strava 上傳後結果仍可能有差異，原因包括手機 GNSS 晶片、系統省電策略、背景位置批次頻率、Strava 未公開的移動判定門檻，以及 Strava 專有海拔底圖。Strava 官方亦指出 GPS 漂移、訊號中斷與跳點會影響距離及平均速度。[2] 建議用相同手機、同一原始 GPX／FIT 與相同騎乘路段進行三次以上對照，並保留原始匯出檔作為校正依據。

## References

[1]: https://support.strava.com/en-us/articles/15401893-how-distance-is-calculated "Strava Support — How Distance is Calculated"
[2]: https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations "Strava Support — Moving Time, Speed, and Pace Calculations"
[3]: https://support.strava.com/en-us/articles/15401909-elevation "Strava Support — Elevation"
