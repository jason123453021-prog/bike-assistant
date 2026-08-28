# Strava 對照與本機物理模型校正依據

## 專有程式碼邊界

本專案不宣稱取得、重製或使用 Strava 的專有底層程式碼。本輪只採用其公開說明中可驗證的資料處理原則，並實作可離線執行、可測試的本機演算法。

## 活動時間與 GPS 統計

Strava 公開說明指出，騎乘活動的移動時間會從 GPS 位置、距離與速度推算；若來源檔已有暫停事件，則會尊重該裝置記錄的移動時間。其亦明確說明速度門檻與靜止秒數屬實作選擇，GPS 漂移、訊號遺失或跳點都可能導致距離、時間與均速和其他裝置不同。[1]

本機實作因此保留連續樣本、可驗證時間差、精度與最高合理速度的防護，避免以過嚴門檻誤刪低速爬坡或彎道路段；同時不接受不合理跳點造成的假距離或假最高速度。

## 海拔

Strava 公開說明將活動爬升視為估算；其優先採用原始氣壓高度資料，無氣壓高度時以 GPS 與高程資料查詢，並在計算前平滑與剔除離群值。其也說明沒有氣壓高度資料時需要更強的平滑處理。[2]

本機離線模式無法存取 Strava 高程底圖，因此使用活動內的高度樣本進行短視窗平滑、離群保護與有效爬升門檻；畫面文案會維持「本機估算」，而非聲稱與 Strava 高程資料庫完全相同。

## 虛擬功率與熱量

本機虛擬功率採用公開的自行車阻力平衡模型，而非把 GPS 速度直接套上固定倍率。外部阻力包含滾動阻力 `m·g·Crr·cos(θ)`、重力 `m·g·sin(θ)`、空氣阻力 `0.5·ρ·CdA·v_air²`，以及必要時的加速度項；將合力乘以地速後，再以傳動效率換算為騎士端功率。公開文獻也以總質量、重力、坡度、Crr、CdA 和空氣密度作為主要模型參數。[3] [4]

本輪預設維持可調且明確標示的本機基準：使用者體重加上預設 9 kg 公路車、`CdA = 0.40 m²`、`Crr = 0.005`、`ρ = 1.225 kg/m³`、傳動效率 `0.97`。沒有可靠速度、坡度或位置時間差時不輸出假精確功率。

卡路里以累計騎士端機械作功除以預設 22% 總機械效率後換算為 kcal；研究與回顧將總機械效率定義為外部機械作功率與代謝能量消耗率之比，且效率會隨功率、騎乘者與方法而變化，因此本機結果只能作為估算。[5]

## 參考資料

[1]: https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations "Strava：Moving Time, Speed, and Pace Calculations"
[2]: https://support.strava.com/en-us/articles/15401909-elevation "Strava：Elevation"
[3]: https://arxiv.org/abs/2005.04691 "On modelling bicycle power for velodromes: Part I: Formulation for individual pursuits"
[4]: https://journals.humankinetics.com/view/journals/jab/14/3/article-p276.xml "Validation of a mathematical model for road cycling power"
[5]: https://pmc.ncbi.nlm.nih.gov/articles/PMC6557926/ "A Comparison of Methodological Approaches to Measuring Cycling Mechanical Efficiency"
