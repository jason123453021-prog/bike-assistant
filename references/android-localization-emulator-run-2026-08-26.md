# Android Emulator 多語系驗收執行紀錄（2026-08-26）

| 項目 | 值 |
| --- | --- |
| GitHub Actions run | `32944024715`（Android 原生 E2E） |
| APK workflow | `32944024714`（Android 驗收 APK） |
| Commit | `bbd9079` |
| 驗收環境 | GitHub Actions Android Emulator，API 35、x86_64；**非實體 Android 裝置**。 |
| 目前狀態 | 2026-08-26 07:46 GMT+8，E2E 與 APK workflow 均仍在執行；尚未產生 artifact。GitHub 公開執行頁：<https://github.com/jason123453021-prog/bike-assistant/actions/runs/32944024715>。 |
| 目標流程 | 日文、韓文及 Arabic 的導航、路線、歷史、設定與隱私政策截圖；Arabic 流程使用 200% 系統字體。 |

## 執行中觀察（07:56 GMT+8）

GitHub job 已完成原生專案產生（11 分 49 秒）、安裝 E2E APK、授予通知權限並安裝 Maestro。目前正在執行既有 `core-navigation.yaml`；新增的 locale 截圖流程尚未開始，尚不可據此判定日文、韓文或 Arabic 的畫面結果。

## 失敗診斷（08:00 GMT+8）

`core-navigation.yaml` 已通過（1/1，38 秒）。後續既有通知流程在 Maestro 回報 Android 裝置遺失後中止，因此 workflow 尚未到達 130%／200% 字體或新增的 locale 截圖步驟。下一輪需把多語系截圖移到通知流程之前，並為後續 Maestro 呼叫明確指定目前的 Android serial，才能取得本任務所需 artifact。

> 後續結果必須以 workflow 的 JUnit、Maestro screenshot artifact 與實際 Android Emulator 畫面為準；本紀錄不可作為實體設備或 OEM 行為驗證的證據。
