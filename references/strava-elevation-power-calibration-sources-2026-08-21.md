# Strava 公開活動校正依據（2026-08-21）

> 本文件保存公開來源，不宣稱可取得 Strava 的私有或專有底層程式碼。單車助手將依可公開驗證的資料處理原則改善本機統計。

## 海拔處理

Strava 表示，具備氣壓計的裝置會優先使用原始檔中的氣壓海拔，並進行平滑與離群值剔除；手機 App 或沒有氣壓計的來源，會把 GPS 軌跡與高程底圖交叉比對，再進行更強的平滑與雜訊剔除。[1] [2]

其 FAQ 說明，在缺乏強氣壓資料時，爬升需持續超過約 10 m 才加進總爬升；具備氣壓資料時約為 2 m。此門檻用於避免把高度雜訊累積成爬升。[2]

| 可採用原則 | 單車助手對應處置 |
|---|---|
| 不直接逐點累加 GPS 高度差 | 使用位置品質、移動距離與高度死區共同篩選 |
| 中斷後不跨段相連 | `segmentStart` 重置海拔參考點 |
| 以平滑／離群剔除限制雜訊 | 前景、背景與恢復流程共用相同的海拔濾波規則 |

## 功率與熱量

Strava 說明，沒有功率計時可根據騎士體重、車重、速度與海拔變化估算功率，且平均功率包含整段騎乘中的滑行零功率樣本。[3]

單車助手會保留本機可解釋的功率工作量與積分時間，僅對有效移動樣本累積熱量；靜止／室內漂移或自動暫停期間不增加距離、爬升、功率工作量或熱量。這不是對 Strava 私有演算法的逐行複製，而是對公開輸入原則與活動統計邊界的對齊。

## References

[1]: https://support.strava.com/en-us/articles/15401909-elevation "Strava Support — Elevation"
[2]: https://support.strava.com/en-us/articles/15402093-elevation-on-strava-faqs "Strava Support — Elevation on Strava FAQs"
[3]: https://support.strava.com/en-us/articles/15401944-how-to-get-power-for-your-rides "Strava Support — How to Get Power for Your Rides"
