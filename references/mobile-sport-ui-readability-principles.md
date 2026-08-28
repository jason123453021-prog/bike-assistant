# 現代行動運動 App 可讀性設計原則

調查日期：2026-08-15

## 可落地的設計決策

1. **閱讀距離與日間可見性優先。**小字必須與背景維持至少 4.5:1 對比，大型粗體文字與關鍵圖示至少 3:1；不要用淡灰文字承載功能或狀態資訊。
2. **建立明確三層文字系統。**頁面標題、列標題／關鍵數值、說明／輔助資料必須分別以字級、字重、行高與對比區隔。避免 Thin 或 Light 字重；多行說明使用足夠行高。
3. **騎乘頁只保留一眼可讀的主資訊。**主畫面顯示有限的核心數值；補給、爬升與進階統計移入展開區，符合 Garmin 將主要騎乘數據和特定用途畫面分離的模式。
4. **所有操作符合拇指觸及與可點擊尺寸。**主要列與按鈕最小 48dp，元件之間至少 8dp；將關鍵操作置於螢幕底部或明確的浮動控制區。
5. **不要只依顏色傳達狀態。**除了綠、黃、紅，需保留文字、圖示或邊框等第二訊號；深色導航浮層使用高不透明背景與高對比白字。
6. **避免主題不同步。**React Native 畫面容器、文字與 NativeWind 主題變數必須使用同一個顏色方案，避免深色字體／淺色背景錯置或反向錯置。

## 來源

- Apple Typography HIG：<https://developer.apple.com/design/human-interface-guidelines/typography>
- Material Design 3 — Designing structure：<https://m3.material.io/foundations/designing/structure>
- Material Design Accessibility：<https://m2.material.io/design/usability/accessibility.html>
- Garmin Edge data fields：<https://www.garmin.com/en-GB/blog/coachs-corner-what-data-fields-to-have-on-your-garmin-edge-bike-computer/>
