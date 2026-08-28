# Strava 功能比對研究筆記

研究日期：2026-08-12

## 官方資料重點

1. Strava 的活動記錄頁面列出 GPS 記錄、即時速度／平均速度、暫停、螢幕常亮、音訊提示、GPS 精度提示，以及目前海拔與總爬升／下降等功能。這些屬於單次騎乘的核心體驗，能以本機 GPS、AsyncStorage 與既有 UI 在不登入、不上傳資料的前提下實作或強化。

2. Strava 將分段排行榜、即時分段、訓練日誌、常用路線比對、月累計統計、進階功率分析、最佳成績、路線探索、個人熱圖與離線地圖列為訂閱功能。它們不應直接被宣稱為本次的「免費 Strava 對等功能」，但其中的純個人資料分析可改寫成不含社群、帳號、雲端或付款的 Local-First 功能。

## 篩選結論

| 概念 | 是否符合本 App 原則 | 理由 |
| --- | --- | --- |
| GPS 精度／資料品質提示 | 是 | 僅使用每個 GPS 點已提供的 accuracy、速度與時間戳，無需連網。 |
| 本機個人最佳成績（距離／爬升／最長時間） | 是 | 可由本機歷史騎乘紀錄計算，沒有排行榜或身分資料。 |
| 本機週／月騎乘彙總 | 是 | 可從 AsyncStorage 歷史資料生成，沒有帳號或同步。 |
| 常用路線／分段成績比對 | 需後續設計 | 可本機做，但需先定義安全且穩定的路線相似度與分段模型。 |
| 社群分段排行榜、社群挑戰、Beacon 位置分享 | 否 | 需要帳號、社群或位置分享，與本 App Local-First 原則衝突。 |
| 訂閱型即時分段、雲端路線推薦／熱圖 | 否 | 依賴付費或雲端資料，依使用者要求排除。 |

## 資料來源

1. Strava Help Center, [Recording an Activity](https://support.strava.com/en-us/articles/15402137-recording-an-activity).
2. Strava Help Center, [Strava Subscription Features](https://support.strava.com/en-us/articles/15402044-strava-subscription-features).
