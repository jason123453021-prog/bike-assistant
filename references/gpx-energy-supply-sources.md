# GPX 路線能量補給份數估算：科學依據與設計原則

本功能僅提供**保守的騎乘規劃估算**，不是個人醫療或營養處方。使用者仍應依既有腸胃耐受度、醫囑、實際氣候與可取得補給調整。

## 來源摘要

| 主題 | 可轉換為 App 規則的重點 | 來源 |
| --- | --- | --- |
| 耐力運動碳水補給 | 運動超過約 60 分鐘時，建議依持續時間與強度安排碳水；較長耐力運動通常使用每小時 30–60 g 的範圍。 | Jeukendrup, *Sports Medicine* (2014) [PMC4008807](https://pmc.ncbi.nlm.nih.gov/articles/PMC4008807/) |
| 高強度耐力運動 | 延長的高強度運動可採每小時約 30–60 g 碳水並分次攝取；短時低強度不強制規劃攜帶能量。 | ISSN Position Stand (2017) [PMC5596471](https://pmc.ncbi.nlm.nih.gov/articles/PMC5596471/) |
| 長程單車與高溫 | 高溫、長時間與較高強度會增加碳水依賴；超過約 2.5 小時、高耐受且使用複合碳水者可能需要更高補給量，但必須依個人腸胃訓練保守調整。 | GSSI, *Hydration and Nutrition Considerations for Endurance Cycling Exercise in the Heat* (2025) [來源](https://www.gssiweb.org/en/sports-science-exchange/article/hydration-and-nutrition-considerations-forendurance-cycling-exercise-in-the-heat) |

## App 轉換規則

1. 對預估 **≤ 60 分鐘** 的路線，預設不強制攜帶能量補給，最少與最多皆為 0 份。
2. 對較長路線，估算每小時碳水需求；FTP 導出的強度、爬升／坡度、環境熱負荷、逆風與降雨會在安全上限內調整區間。
3. 以一份標準能量補給約 **25 g 碳水** 換算份數。最低值採較保守攝取目標；最高值包含高強度、延遲與環境情境的備援，但不假設未經腸胃訓練即可承受極高碳水率。
4. 顯示為「最少 X 份／建議最多攜帶 Y 份」，不要求使用者手動輸入補給量。
