# 本機活動統計對齊準則

本文件定義「智慧單車騎乘助手」的本機活動統計語意。目標是依公開且可驗證的活動欄位定義建立一致資料鏈，**不存取、不反編譯、也不複製 Strava 的專有程式碼或伺服器演算法**。

| 指標 | 本機定義 | 顯示與儲存規則 |
|---|---|---|
| 距離 | 僅累加通過座標精度、時間戳、速度與中斷守門的 GPS 線段。 | 以公尺保存；活動頁以公里顯示。長時間定位中斷後開啟新段，不以直線補距離。 |
| 活動時間 | 從開始到結束的總經過時間。 | `elapsedTime = movingTime + pausedTime`。 |
| 移動時間 | 使用者未暫停、且經自動暫停與可靠移動判斷後的有效活動秒數。 | 所有平均速度、平均功率與 TSS 使用此欄位；明確顯示於活動頁。 |
| 暫停時間 | 手動暫停或自動暫停期間的累計秒數。 | 以開始／恢復時間戳計算，避免背景切換造成重複累加。 |
| 平均速度 | 距離除以移動時間。 | 不以活動總經過時間稀釋；儲存時重新計算，避免顯示與歷史資料不同步。 |
| 最大速度 | 通過 GPS 品質與不可能速度守門後的最快可靠速度。 | 不以低品質跳點寫入活動紀錄。 |
| 總爬升／總下降 | 經死區、最小距離與尖峰排除後的相鄰高度變化加總。 | 不因 GPS 垂直雜訊重複計入；最高／最低海拔採同一可信高度序列。 |
| 平均／最大功率 | 僅有效移動時間的時間加權功率平均與可靠樣本最大值。 | 明確標示量測或本機估算來源；滑行零功率保留在平均功率內。 |
| 機械工作量 | 有效移動樣本的功率對時間積分。 | 以千焦耳保存；與平均功率及移動時間可交叉驗算。 |
| 卡路里 | 以功率與時間積分推估，無可用功率時才以速度、坡度、體重與環境的 MET 模型回退。 | 儲存全程累計，與補給倒數的分段讀數分離；標示為估算值。 |
| NP／IF／TSS | 擁有足夠有效功率序列時才計算；短時或資料不足活動保持未知而非虛構。 | NP 以 30 秒滾動平均與四次方平均計算；IF 與 TSS 使用個人 FTP 與移動時間。 |

Strava 公開文件將 `moving_time` 與 `elapsed_time` 區分為有效活動時間與開始至結束的總時間，並一般以移動時間計算單車與跑步的速度／配速。[1] 其公開活動欄位亦包含距離、移動時間、總經過時間、總爬升、平均／最大速度、平均／加權／最大功率、機械工作量與卡路里。[2] [3]

> 海拔資料本質上是估算值；公開說明指出，活動高度應優先使用可靠的原始氣壓高度資料，並透過平滑與離群值排除減少雜訊。[4]

平均功率需包含滑行時的零功率，且在沒有功率計時可以由體重、車重、速度與高度變化進行估算。[5] 因此，本機活動會儲存功率來源並避免把估算功率誤標為量測功率。NP、IF 與 TSS 僅在功率樣本和活動長度足以支援計算時呈現；TrainingPeaks 公開說明指出，NP 從 30 秒滾動平均開始，過短資料段不宜解讀。[6]

## References

[1]: https://support.strava.com/hc/en-us/articles/15401804-moving-time-speed-and-pace-calculations "Strava — Moving Time, Speed, and Pace Calculations"
[2]: https://developers.strava.com/docs/reference/ "Strava API Reference — Detailed Activity"
[3]: https://developers.strava.com/docs/reference/ "Strava API Reference — Activity summary fields"
[4]: https://support.strava.com/hc/en-us/articles/15401909-elevation "Strava — Elevation"
[5]: https://support.strava.com/hc/en-us/articles/15401944-how-to-get-power-for-your-rides "Strava — How to Get Power for Your Rides"
[6]: https://help.trainingpeaks.com/hc/en-us/articles/204071804-Normalized-Power "TrainingPeaks — Normalized Power"
