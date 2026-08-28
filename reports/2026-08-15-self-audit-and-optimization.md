# 單車助手：自我檢測與優化摘要

> 稽核日期：2026-08-15。範圍涵蓋 Android 15／16 發佈相容性、Expo 原生設定、型別與 lint、定位及提醒生命週期、本機寫入策略、權限、套件相容性與 Android Hermes bundle。

## 結論

本次稽核已完成可由受管理 Expo 專案安全驗證的修正。專案維持 **Local-First** 架構，未加入 NitroModules、C++ 原生模組、雲端帳號或遠端推播註冊。所有正式騎乘定位、補給提醒、背景位置任務與本機復原流程均保留。

| 面向 | 已處理項目 | 驗證結果 |
|---|---|---|
| Android 15 前景服務 | 移除自訂開機前景服務外掛、舊版自動原生服務與啟動時電池白名單請求；在最終 manifest 使用 `blockedPermissions` 封鎖 `RECEIVE_BOOT_COMPLETED` 與 `SYSTEM_ALERT_WINDOW`。 | 乾淨預建置 manifest 顯示兩者均為 `tools:node="remove"`；騎乘定位僅由使用者開始騎乘後啟動。 |
| Android 15 無邊框 | 移除 App 自有簡化導航覆蓋層的舊式狀態列背景色設定，保留 Expo 的無邊框佈局與 Safe Area。 | 不再由專案程式直接指定 Android 狀態列背景色。上游 React Native／Material 元件的 API 警告須隨 Expo SDK 升級持續觀察。 |
| Android 16 大螢幕 | 將方向改為 `default`，iOS 亦啟用 tablet 支援；以既有 Safe Area、flex 佈局與即時視窗尺寸邏輯支援旋轉及寬螢幕。 | 預建置 manifest 的 `MainActivity` 為 `screenOrientation="unspecified"`。 |
| R8 與資源縮減 | 透過 Expo 官方 `expo-build-properties` 開啟 release R8 壓縮與資源縮減。 | 乾淨預建置 `gradle.properties` 已寫入兩個 release flags。 |
| 套件健康度 | 升級並對齊 Expo SDK 54 patch 依賴；新增 `expo-asset`、`expo-font` 正式外掛；調整 React Navigation 宣告範圍。 | `expo-doctor`：**18/18 checks passed**。 |
| 靜態品質 | 修正地圖頁未使用 import、泛型陣列風格與不必要 Hook 依賴；將 ESLint 設定改為明確 ESM 檔案。 | TypeScript：**0 errors**；lint：**0 warnings / 0 errors**。 |
| 記憶體與生命週期 | 移除未被引用的舊版自訂前景服務、原生騎乘橋接、電池／權限輪詢鏈與 Gradle hack；保留設定頁使用者主動開啟系統設定的流程。 | 無殘留 TypeScript 引用；App 啟動不再自動要求電池最佳化例外。 |
| 定位與寫入 | 檢查到前景 GPS 訂閱、加速度計、AppState、補給重複提醒、騎乘計時器、天氣計時器均有 cleanup；背景軌跡每 5 秒批次落盤，前景復原快照節流為 3 秒。背景完整狀態則保留每回呼持久化，以換取鎖屏／崩潰時資料完整性。 | 既有持久化批次回歸測試與全量測試通過。 |

## 已知邊界與後續監測

Google Play 所列的 `Window`／Material bottom sheet 舊式無邊框 API 多來自 Expo SDK 54 所含的 React Native、React Navigation Screens 與 Material 上游相依，而非 App 業務程式可安全覆寫的 API。本次已移除 App 自有狀態列背景色呼叫，並保留 `edgeToEdgeEnabled: true`。若 Play 在新 AAB 仍持續列出上游呼叫，建議於下一個 Expo SDK 穩定版納入對應 Android 15／16 相容性更新後，再以同一套 release 檢核重測。

R8 已在設定與預建置層驗證啟用；由於本沙盒執行 Gradle release manifest 任務曾被記憶體限制終止，最終 AAB 仍應在發佈管線中完成一次安裝型 release smoke test，特別驗證背景定位、GPX 匯入、提示音與通知動作。

## 最終驗證

| 指標 | 結果 |
|---|---:|
| TypeScript | 0 errors |
| ESLint | 0 warnings / 0 errors |
| Vitest | 183 passed / 1 skipped（65 test files） |
| Expo Doctor | 18 / 18 checks passed |
| Android Hermes production export | 5.7 MB bundle；6.0 MB 匯出目錄 |
| Android 設定守門 | 通過：API 36、方向未鎖定、BOOT_COMPLETED／懸浮窗已封鎖、R8 已啟用 |

## 參考資料

Android 與 Expo 官方來源及設定依據已保存在 [`references/android-15-16-r8-official-sources.md`](../references/android-15-16-r8-official-sources.md)。
