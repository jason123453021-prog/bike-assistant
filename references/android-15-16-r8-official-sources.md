# Android 15/16 與 R8 官方相容性來源

本文件記錄 2026-08-15 全面健康度稽核所使用的官方 Android 文件，僅作為本專案設定與驗證的依據。

## Android 15：BOOT_COMPLETED 與前景服務

- 官方文件指出，Target Android 15（API 35）以上時，`BOOT_COMPLETED` receiver 不得啟動 `dataSync`、`camera`、`mediaPlayback`、`phoneCall`、`mediaProjection` 等前景服務；系統會拋出 `ForegroundServiceStartNotAllowedException`。
- 專案收到的 Play 警告涉及 `expo-audio` 的音訊服務，因此最終產物必須確認其 receiver 不含 `BOOT_COMPLETED`，而不應僅依賴原始設定檔的宣告。

來源：[Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-15)

## Android 16：無邊框與大螢幕

- Target Android 16（API 36）時，Android 16 裝置無法再以 `windowOptOutEdgeToEdgeEnforcement` 停用無邊框；應採用 window insets 與 edge-to-edge 相容佈局。
- 在最小寬度至少 600dp 的大螢幕上，`screenOrientation`、`resizableActivity` 與 aspect ratio 限制會被忽略；應測試自適應版面與 Activity 狀態保存，而非依賴 portrait 鎖定。

來源：[Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16)

## R8 最佳化

- 官方建議僅在已測試的 release 版本啟用 R8；舊版 Gradle DSL 以 `isMinifyEnabled = true` 及 `isShrinkResources = true` 啟用程式與資源最佳化。
- 啟用後需驗證反射／原生模組的 keep rules 與 release 實際行為，因為壓縮與混淆可能暴露未宣告的動態引用。

來源：[Enable app optimization with R8](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)

## Expo SDK 54：release 最佳化設定

- `expo-build-properties` 的 Android 公開設定提供 `enableMinifyInReleaseBuilds`（R8 程式壓縮／最佳化）與 `enableShrinkResourcesInReleaseBuilds`（資源壓縮），可在受管理 Expo 專案的 release 建置中使用。
- 此外可透過 `extraProguardRules` 補充最小化的保留規則；啟用壓縮後應以 release bundle 完整驗證，避免動態載入或原生橋接類別被誤移除。

來源：[Expo BuildProperties](https://docs.expo.dev/versions/latest/sdk/build-properties/)

## Expo：權限與方向設定

- Expo 官方文件說明，套件原生 manifest 自動加入的 Android 權限可用 `android.blockedPermissions` 從最終 manifest 移除；這適合移除本 App 未使用的 `SYSTEM_ALERT_WINDOW`、舊式外部儲存與 `WRITE_SETTINGS` 權限。
- Expo `orientation: "default"` 表示不鎖定方向，符合 Android 16 大螢幕不應依賴 portrait 限制的遷移方向。

來源：[Expo Permissions](https://docs.expo.dev/guides/permissions/)；[Expo App Configuration](https://docs.expo.dev/versions/latest/config/app/)
