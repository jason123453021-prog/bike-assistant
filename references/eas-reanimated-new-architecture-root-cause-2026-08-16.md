# EAS Android Gradle 根因紀錄：Reanimated 與新架構

> 來源建置：[Expo Build 9d09b7cc-0561-4e95-988d-de9b2df3745f](https://expo.dev/accounts/jason123453021/projects/bike-assistant/builds/9d09b7cc-0561-4e95-988d-de9b2df3745f)，於 2026-08-16 檢視。

## 實際失敗原因

EAS 的 `Run gradlew` 階段已在 `:react-native-reanimated:assertNewArchitectureEnabledTask` 停止，而不是因為 BOOT_COMPLETED、R8、憑證或 C++ 第三方模組。原始日誌的關鍵訊息如下：

> `Execution failed for task ':react-native-reanimated:assertNewArchitectureEnabledTask'.`
>
> `[Reanimated] Reanimated requires new architecture to be enabled. Please enable it by setting newArchEnabled to true in gradle.properties.`

當時產物的 `android/gradle.properties` 為 `newArchEnabled=false`，來源是 `app.config.ts` 的顯式設定。已改為 `newArchEnabled: true`，並以 `EAS_BUILD_PROFILE=preview npx expo prebuild --clean --platform android --no-install` 確認原生產物輸出 `newArchEnabled=true`。

## 修正邊界

本修正啟用的是 Expo SDK 54／React Native 提供的**受管理新架構**，沒有新增自訂 NitroModules、C++ 原生模組或第三方原生套件。現有 `react-native-reanimated` 4.1.6 與 `react-native-worklets` 0.5.1 已由 Expo SDK 54 支援套件提供。

預覽 APK 維持關閉 R8 與資源縮減，以降低雲端 Gradle 複雜度；production AAB 則保留最佳化。這項 profile 分流與 Reanimated 新架構設定均有 Vitest 守門。

## 官方依據

Expo 官方文件指出 SDK 53／54 預設啟用新架構，且若先前明確關閉，可從 app config 移除或啟用該設定；同時 Expo Go 僅支援新架構。[1]

Reanimated 官方文件指出 4.x 僅能在 React Native New Architecture（Fabric）運作，Expo 專案需重建原生依賴。[2]

## 重新建置驗證

下一個 EAS preview APK 應確認 `Run gradlew` 已跨過 `assertNewArchitectureEnabledTask`。如有後續錯誤，請以新建置中第一個 `FAILURE:` 或 `Caused by:` 作為下一輪根因。

## References

[1]: https://docs.expo.dev/guides/new-architecture/ "Expo: React Native's New Architecture"
[2]: https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/ "React Native Reanimated: Getting started"
