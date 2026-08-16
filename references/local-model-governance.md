# 本機運動模型治理

本應用程式的**虛擬功率、配速、GAP、VAM、MET 卡路里，以及能量／補水提醒**均在裝置上計算。模型輸出僅供一般運動與騎乘規劃參考，不是醫療、營養或安全診斷；使用者如有疾病、用藥、熱傷害病史或特殊營養需求，應優先諮詢合格醫療或運動營養專業人員。

## 版本與更新流程

目前內建模型版本為 **2026.08.16**。未來更新必須是隨應用程式版本交付的離線資料更新，不會在騎乘期間連線下載或改寫模型。每次更新必須同時完成來源審核、來源網址與適用範圍登錄、保守邊界檢查、四種運動模式測試與完整回歸測試；若研究結論不足或相互矛盾，保留現行保守值。

| 模型區域 | 本機做法 | 主要依據 |
|---|---|---|
| 單車虛擬功率 | 空阻、滾阻、重力、加速與傳動效率的透明物理模型；GPS 異常值受限幅保護 | 道路單車功率模型驗證 [1] |
| 跑步／越野 GAP | 依坡度調整能耗，產生透明的平地等效配速近似，非任何平台的專有演算法 | 坡度走跑能耗實驗 [2] |
| 卡路里 | 以 2024 Adult Compendium 的 MET 框架為基準，再以速度、坡度與 VAM 做保守校正 | Adult Compendium [3] |
| 補水 | 以個人汗率、運動強度、環境熱負荷與時長排定小量提醒節奏；不以 App 估算取代個人臨床評估 | ACSM 補液立場聲明 [4] |
| 能量 | 依時長與相對強度建立保守碳水提醒節奏，長時間與高強度才提高頻率；使用者應先在訓練中驗證腸胃耐受度 | 耐力碳水綜述 [5] |

## 跨運動模式參數

單車維持 5 m GPS 採樣與低速自動暫停；跑步採 3 m 與加速度計靜止確認；登山採 1.5 m，僅在極低速長時間停留時提示、不自動暫停；越野跑保留跑步的靜止確認，但用較寬鬆的停止門檻以容納崎嶇地形。模型變更集中於 `lib/model-governance.ts`，前景與背景補給計畫皆讀取同一運動類型。

## 參考資料

[1] [Martin et al., *Validation of a Mathematical Model for Road Cycling Power*](https://pubmed.ncbi.nlm.nih.gov/28121252/)

[2] [Minetti et al., *Energy cost of walking and running at extreme uphill and downhill slopes*](https://pubmed.ncbi.nlm.nih.gov/12183501/)

[3] [Herrmann et al., *2024 Adult Compendium of Physical Activities*](https://pmc.ncbi.nlm.nih.gov/articles/PMC10818145/)

[4] [Sawka et al., *ACSM Position Stand: Exercise and Fluid Replacement*](https://pubmed.ncbi.nlm.nih.gov/17277604/)

[5] [Naderi et al., *Carbohydrates and Endurance Exercise*](https://pmc.ncbi.nlm.nih.gov/articles/PMC10054587/)
