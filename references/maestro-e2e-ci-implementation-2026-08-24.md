# Maestro Android E2E CI 實作依據

本機沙盒未提供 `adb`、Android Emulator、`avdmanager` 或 Maestro CLI，故無法在此沙盒直接執行原生 E2E；新增的 E2E workflow 會在 GitHub Actions 的 Android 模擬器中自動安裝 APK 並執行，不需要人工操作。

Maestro 官方說明其 flow 可在 Android Emulator 上以人類可讀 YAML 執行，且 CLI 需要 Java 17 以上；CLI 可用官方安裝腳本安裝。[1] GitHub Marketplace 的 Android 範例結合 Android emulator runner 與 `maestro test --format=junit --output=report.xml` 產出 CI 報告。[2] Maestro 官方報告文件確認 `--format junit`、`--output` 與 `--test-output-dir` 可輸出 JUnit、逐步 logs、截圖與執行 metadata。[3]

## 採用邊界

| 面向 | 採用方式 | 原因 |
|---|---|---|
| 核心演算 | Jest + 既有 Vitest | 純 TypeScript 函式適合無裝置的確定性回歸 |
| 原生 E2E | Maestro Android YAML flow | 不導入 Detox 原生測試 binary 與額外 React Native 測試框架相依 |
| CI 裝置 | GitHub hosted Android Emulator | 目前本機無 Android SDK／Emulator；CI 能自動授權、安裝與執行 |
| 證據保存 | JUnit XML、Maestro 輸出、APK | 失敗時可查 log／螢幕階層；成功時可保存報告 artifact |

## 參考資料

[1]: https://github.com/mobile-dev-inc/maestro "Maestro 官方 GitHub：Android emulator、Java 17 與 CLI 安裝"
[2]: https://github.com/marketplace/actions/maestro-test-action "Maestro test action：Android Emulator 與 JUnit CI 範例"
[3]: https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts "Maestro 官方測試報告與 artifact 文件"
