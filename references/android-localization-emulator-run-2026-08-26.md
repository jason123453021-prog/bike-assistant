# Android Emulator 多語系、RTL 與字體縮放驗收紀錄（2026-08-26）

| 項目 | 值 |
| --- | --- |
| GitHub Actions E2E run | [`32978807675`](https://github.com/jason123453021-prog/bike-assistant/actions/runs/32978807675)（Android 原生 E2E，成功） |
| Commit | `72dcb2e`（`fix(e2e): grant location after clearing app data`） |
| 驗收環境 | GitHub Actions Android Emulator，API 35、Google APIs、x86_64；**非實體 Android 裝置**。 |
| artifact | [`bike-assistant-maestro-e2e`](https://github.com/jason123453021-prog/bike-assistant/actions/runs/32978807675#artifacts)；保留 14 天。 |
| 驗收範圍 | 核心導覽、日文／韓文／Arabic 逐頁、Arabic RTL 200%、Arabic／德文／俄文 130% 表單、背景本機通知排程與點擊通知回前景。 |

## 成功結果

下載 artifact 後已核對 JUnit XML 皆為 `failures="0"`，並確認以下 Maestro 流程各自產出可追溯 PNG 截圖：核心導覽、日文、韓文、Arabic RTL、Arabic RTL 200%、Arabic／德文／俄文 130% 表單、背景本機通知排程，以及背景通知本體回前景。

日文、韓文與 Arabic 每一流程皆覆蓋導航、路線、歷史、設定及隱私政策頁面。Arabic 200% 流程另覆蓋相同五頁。已視覺檢視 `locale-ar-200-privacy.png`：Arabic 標題、段落與清單維持由右至左對齊與可讀折行，頁面在 320×640 Emulator 截圖中未見截斷；該畫面仍明確標示政策最後更新日期。

## 通知流程修復與驗收

前一輪 `32976012887` 的通知回前景斷言失敗並非文案、RTL 或字體縮放問題。artifact 截圖顯示清除 App 資料後，Android 前景位置權限系統視窗遮擋了 `Refuel` Modal。`72dcb2e` 已在通知驗收的 `pm clear` 後明確授予 `ACCESS_COARSE_LOCATION` 與 `ACCESS_FINE_LOCATION`，並加入 workflow 回歸守門。此後 `32978807675` 已成功通過背景通知本體回前景流程，並產出 `background-notification-open-refuel-modal.png`。

> 此紀錄只能證明 GitHub Android Emulator 的自動化驗收結果；尚未驗證實體 Android 裝置、各 OEM 的背景限制、電池最佳化或通知行為。

## 限制與後續

本次已證實文字、方向、字體縮放與通知流程在定義的 Emulator 環境中通過。實體 Android／OEM 驗收仍需在可連線裝置上進行，尤其是背景通知、權限自動重設與廠商電池管理差異。
