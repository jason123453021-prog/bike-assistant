# Android Maestro E2E

此目錄包含不需人工操作的 Android 原生 E2E flow。CI 會先建置驗收 APK、在 Android Emulator 安裝 App、以 Maestro 授與定位與通知權限，最後產出 JUnit XML、Maestro logs 與截圖 artifact。

本機執行需要已啟動 Android Emulator、`adb`、Java 17+ 與 Maestro CLI：

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
maestro test --format junit --output build/maestro-report.xml --test-output-dir build/maestro-results e2e/maestro
```

目前 flow 自動驗證 App 啟動及四個主要 tab 的切換。GPS 模擬、背景限制、TTS、亮度與通知 action 的邏輯則由 Jest／Vitest 的純函式與整合回歸驗證；這些功能需要受控的原生 mock 或真實裝置才可驗證硬體效果。
