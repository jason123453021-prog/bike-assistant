# 單車助手全自動測試套件最終報告

**執行日期：** 2026-08-24  
**驗收基準：** `FEATURE_MAP_PRD_2026-08-24.md`、Jest 規格測試、既有 Vitest 回歸測試，以及 `e2e/maestro/core-navigation.yaml`。  
**最終判定：** **PASS**

> 本輪由本機命令與 GitHub Actions hosted Android Emulator 完全自動執行。最後的原生 E2E 為 [run 32753570646][1]，結果為 **成功**；其 JUnit 產物記錄 **1 suite、1 test、0 failures、28.254 秒**，並已上傳 `bike-assistant-maestro-e2e` artifact。

## 執行結果總覽

| 測試層級 | 執行項目 | 最終結果 | 可追溯證據 |
|---|---|---:|---|
| 型別守門 | `pnpm check` | PASS | `tsc --noEmit` 成功 |
| 靜態程式規範 | `pnpm lint` | PASS | Expo lint 成功 |
| 規格導向核心／靜態守門 | `pnpm test:jest` | PASS | 2 suites／15 tests |
| 既有全量回歸 | `pnpm test` | PASS | 125 files／426 tests |
| 組合自動測試入口 | `pnpm test:automated` | PASS | Jest 15 + Vitest 426 |
| Android 原生 E2E | GitHub `android-e2e.yml` | PASS | [run 32753570646][1] |
| Maestro JUnit | `maestro-report.xml` | PASS | 1 test／0 failures／28.254 秒 |
| Maestro artifact | `bike-assistant-maestro-e2e` | PASS | 335,773 bytes；JUnit、logs、logcat、截圖、metadata |

## 規格覆蓋與斷言結果

| 規格需求 | 自動化驗證方式 | 結果 |
|---|---|---:|
| 時速低於 **1.08 km/h** 且無可信移動 **10 秒**進入自動暫停；超過 **1.8 km/h** 恢復 | Jest GPS／自動暫停案例 | PASS |
| 自動暫停期間 `duration` 繼續累積，而 `movingTime` 停止 | Jest 時間隔離案例 | PASS |
| 12 km 軌跡在 1／5／10 km 建立插值自動圈 | Jest 自動分圈案例 | PASS |
| 採 3 秒 COG、0.28 指數平滑，且不依賴硬體羅盤 | Jest COG 案例與靜態守門 | PASS |
| 大於 35° 向量轉彎正確判斷左右；100 m 喚醒、50 m TTS | Jest 導航幾何與路口狀態案例 | PASS |
| 能量／補水以 `Date.now()` 倒數；暫停秒數 × 0.4 的下輪補償、上限 5 分鐘 | Jest 補給倒數案例 | PASS |
| 天氣資料逾時 60 秒時沿用前輪，或首輪回退 10 分鐘 | Jest timeout 案例 | PASS |
| 不得回歸手動 Lap、日出／日落提醒、Kalman Filter，且 FIT `totalTimerTime` 綁定移動時間 | Jest 靜態封版守門 | PASS |
| Android APK 可安裝、定位／通知權限可授與，並可切換四個主分頁 | Maestro `core-navigation.yaml` | PASS |

## 原生 E2E 驗收內容

GitHub workflow 先執行 TypeScript、Lint、Jest 與 Vitest，隨後在 Ubuntu hosted runner 以 Java 17 產生 **x86_64 release APK**。此 APK 內含 JavaScript bundle，故 Android Emulator 不依賴 Metro 開發伺服器。workflow 再以 KVM 啟動 Android API 35 Google APIs Emulator，安裝固定交接位置的 APK，並以 Maestro 執行 UI flow。

成功 flow 使用真實 app ID `com.jason123453021.bikeassistant`，清除 App 狀態後授與精確／概略定位及通知權限，驗證並依序切換「導航」、「路線」、「記錄」與「設定」四個主分頁，最後確認設定頁的「顯示與外觀」分類可見。Maestro 以 `--format junit`、`--output` 與 `--test-output-dir` 保存 JUnit、命令 metadata、裝置 log、Maestro log 與畫面截圖，符合其官方報告 artifact 用法。[2]

## 已自動追溯並修正的 CI 失敗

| GitHub run | 可重現原因 | 修正措施 | 狀態 |
|---|---|---|---:|
| 32740742805 | KVM 權限不足，Emulator 降級為 software acceleration 後逾時 | 在 Emulator 前加入 udev KVM 規則並 reload／trigger | 已排除 |
| 32744427734、32746576574、32748420285 | Gradle 已成功，Emulator action script 卻無法定位 APK | 將 APK handoff 移至一般 workflow step，固定複製到 `build/e2e-under-test.apk` | 已排除 |
| 32750160946 | Android Emulator action 對逐行 script 建立獨立 shell，導致 `PATH` 未延續 | 直接以 `$HOME/.maestro/bin/maestro` 呼叫 CLI | 已排除 |
| 32751621064 | debug APK 需要 Metro，Emulator 顯示「Unable to load script」 | 改建置內含 JavaScript bundle 的 x86_64 release APK | 已排除 |
| 32753570646 | 所有品質、建置、Emulator、Maestro 與 artifact 步驟完成 | 無需再修正 | **PASS** |

## CI、報告與下載位置

| 項目 | 位置 |
|---|---|
| 成功的原生 E2E | [Android 原生 E2E — run 32753570646][1] |
| Maestro artifact | 在成功 run 的 **Artifacts** 區下載 `bike-assistant-maestro-e2e`；workflow 保留 14 天 |
| E2E workflow | [`.github/workflows/android-e2e.yml`][3] |
| Maestro flow | [`e2e/maestro/core-navigation.yaml`][4] |
| Android preview APK 驗收 | [run 32736347306][5]；artifact `bike-assistant-preview-apk` |

## 自動化範圍的實機邊界

本輪 PASS 證明專案的核心演算、封版靜態規則、原生 APK 安裝、首次權限流程與四分頁導覽可在無人工操作下完成。Android Emulator 並不能代表所有戶外與 OEM 情境；GPS 衛星品質、鎖屏背景定位、廠商省電策略、真實亮度、TTS 音訊焦點、通知 action，以及第三方 GPX／FIT 消費端的相容性仍應於目標 Android 實機驗收。這些項目是發布前實機驗收邊界，而非本自動化套件的失敗項。

## 參考資料

[1]: https://github.com/jason123453021-prog/bike-assistant/actions/runs/32753570646 "GitHub Actions：Android 原生 E2E 成功 run 32753570646"
[2]: https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts "Maestro：測試報告與 artifact 文件"
[3]: https://github.com/jason123453021-prog/bike-assistant/blob/main/.github/workflows/android-e2e.yml "單車助手 Android E2E workflow"
[4]: https://github.com/jason123453021-prog/bike-assistant/blob/main/e2e/maestro/core-navigation.yaml "單車助手 Maestro 核心導覽 flow"
[5]: https://github.com/jason123453021-prog/bike-assistant/actions/runs/32736347306 "GitHub Actions：Android preview APK 驗收 run 32736347306"
