# 每小時碳水上限：模型依據與實作邊界

本功能將 App 的每小時碳水目標視為**補給提醒節奏與規劃上限**，而非醫療處方。科學建議模式採運動時長、強度、運動類型與使用者體重作保守限幅；手動模式讓使用者在 20–90 g/h 內指定自身已練習且可耐受的上限。

| 實作原則 | 對應證據與 App 行為 |
|---|---|
| 超過 60 分鐘才開始主動補碳水 | 耐力運動期間常見建議為 30–90 g/h；較短活動不應因單一數字強制補給。[1][2] |
| 保守上限為 90 g/h | 中高劑量 60–90 g/h 需要考量多重可運輸碳水與腸胃耐受；App 不把研究中的較高實驗攝取值當作一般預設。[1][2] |
| 體重只作限幅，不單獨決定目標 | 文獻指出運動中碳水策略應與時長、強度、形式和個人耐受共同調整；App 使用約 0.7 g/kg/h 的保守參考上緣，再以 90 g/h 封頂。[1] |
| 單次份量決定倒數 | 倒數以 `單次碳水克數 ÷ 有效每小時碳水目標 × 3600` 推導，並保留提醒間隔護欄，讓重複確認後的長期平均不超過設定或科學建議的上限。 |

使用者若有糖尿病、腸胃吸收困難、需限制飲食或已接受個別醫囑，應採專業人員建議，而非使用自動計算值。

## 參考資料

[1] Jeukendrup, A. *A Step Towards Personalized Sports Nutrition: Carbohydrate Intake During Exercise* (2014). https://pmc.ncbi.nlm.nih.gov/articles/PMC4008807/

[2] Wallis, G. A., & Podlogar, T. *Dietary Carbohydrate and the Endurance Athlete: Contemporary Perspectives* (2022). https://www.gssiweb.org/sports-science-exchange/article/dietary-carbohydrate-and-the-endurance-athlete-contemporary-perspectives
