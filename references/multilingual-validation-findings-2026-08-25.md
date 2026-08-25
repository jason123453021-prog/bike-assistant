# 多語系驗收發現（2026-08-25）

## 分享圖卡：真實長活動名稱

已以 `scripts/generate-locale-share-card-samples.ts` 產生全部 13 個支援語系的 SVG 與 1080 × 1920 PNG，輸出於本機 `build/share-card-long-title-validation/`。自動化測試確認每一種語言均產生多個標題 `<tspan>`、不含省略號或 `undefined`，並保留日期、統計格與底部說明結構。

已視覺檢視德文與 Arabic 輸出。兩者的長標題均分為兩行，日期下移而不與標題重疊；統計格、分隔線及底部說明仍在圖卡安全範圍內。Arabic 的 RTL 標題與本地化日期可正常顯示。這是 Chromium 靜態 SVG／PNG 渲染驗證，不替代實體 Android 的分享操作驗收。

## 釘選導航：跨洲路由端點探測

2026-08-25 使用應用中的相同 BRouter `trekking` 與 FOSSGIS OSM bike 路由端點，以每一服務相隔至少 1.3 秒的節流方式，探測台北、柏林、舊金山、聖保羅、開普敦與雪梨的短距離自行車路線。兩個端點在六個代表城市均回傳 HTTP 200 與有效路線；原始結果保存於 `build/global-pinned-navigation-probe-2026-08-25.tsv`。

此結果僅代表該時點、代表城市與可通行端點的線上可用性，不能推論所有道路、所有國家或離線情況。BRouter 表示其資料全球可用且每週更新；FOSSGIS 的 bike profile 也標示為全球，但公開服務限制為每秒最多一個請求，禁止大量使用，因此目前產品不具有全球服務可用性保證或離線釘選導航能力。[1][2]

## 參考資料

[1] [BRouter：自行車路由與全球資料說明](https://brouter.de/brouter/)

[2] [routing.openstreetmap.de：全球 bike profile 與使用政策](https://routing.openstreetmap.de/about.html)
