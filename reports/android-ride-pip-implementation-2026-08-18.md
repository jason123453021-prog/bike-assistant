# Android 騎乘 PiP 縮小導航實作紀錄

**日期：** 2026-08-18（GMT+8）  
**交付範圍：** 在騎乘啟動後，使用者返回 Android 主畫面或切換其他 App 時，以 Android 原生 Picture-in-Picture（PiP）持續顯示最小導航資訊。

## 已實作行為

本次採用 Android 原生 Activity PiP，而非 `SYSTEM_ALERT_WINDOW` 覆蓋層。Manifest 對 `MainActivity` 宣告 `android:supportsPictureInPicture="true"` 與可調整視窗；Android 12 以上使用 Auto-Enter，Android 8–11 在使用者離開 App 時進入 PiP。這符合 Android 對導航類縮小畫面的平台模型，不需要懸浮窗特殊權限。[1]

縮小畫面採深綠高對比卡片，顯示騎乘／暫停狀態、大型左轉、右轉、到達或直行箭頭、下一導航指令、轉向距離、即時速度與累計距離。PiP 只讀取既有 React 騎乘狀態及導航狀態，不派送 reducer action，因此不會改寫活動時間、距離、補給倒數或騎乘生命週期。當狀態轉為 `finished` 或 `idle` 時，橋接會通知原生層關閉 PiP。

| 情境 | 預期結果 |
|---|---|
| 騎乘進行中，按主畫面／切換 App | Android 8–11 使用離開回呼進入 PiP；Android 12+ 使用系統 Auto-Enter。 |
| 已載入導航路線 | 顯示下一轉向指令、箭頭與轉向距離。 |
| 自由騎乘 | 顯示「騎乘中」、直行箭頭、速度與累計距離。 |
| 騎乘暫停 | 保留 PiP，但明確顯示「騎乘已暫停」及零速快照。 |
| 停止騎乘 | 關閉 PiP；不留下過期的騎乘資訊。 |
| Expo Go 或不支援 PiP 的裝置 | 傳統橋接安全降級為無動作，不影響既有騎乘。 |

## 架構與限制

PiP 使用最小化 Kotlin Activity 與傳統 React Native Bridge，並透過 Expo config plugin 在每次預生成時套用。因此不使用 C++、JSI／NitroModules 或 `SYSTEM_ALERT_WINDOW`。此功能需要新的正式 Android binary；Expo Go 不含此原生橋接，不能用於 PiP 實機驗證。

## 驗證紀錄

Android 預生成已成功，確認產出 Manifest PiP 宣告、Kotlin `MainActivity`、`BikeRidePipModule` 與 `BikeRidePipPackage`。TypeScript 與 ESLint 均通過；完整 Vitest 為 **288 passed / 1 skipped**，涵蓋 PiP 快照、設定外掛、騎乘生命週期與既有發布衛生回歸。[2]

曾嘗試在沙盒進行 Gradle Kotlin 編譯，但依賴解析階段使整體記憶體壓力超過安全門檻，已主動中止以避免中斷開發環境。這不是 Kotlin 編譯錯誤；最終原生編譯與實機 PiP 行為須在下一個正式 Android Publish build 驗收。

## 實機驗收步驟

1. 使用包含本次變更的新正式 Android APK 安裝 App，並授予既有定位與通知權限。
2. 在「導航」頁開始騎乘，最好先載入一條 GPX 或釘選導航路線。
3. 返回手機主畫面；確認右上或系統選擇的位置出現深綠色 PiP，內容包含箭頭、下一指令、速度與累計距離。
4. 拖曳或縮放 PiP 後點選它，確認回到完整導航；停止騎乘後確認 PiP 關閉，且活動統計保持正確。

## 參考資料

[1]: https://developer.android.com/develop/ui/views/picture-in-picture "Android Developers — Use picture-in-picture"
[2]: qc-evidence-2/pip-full-regression.txt "PiP 整合後完整 Vitest 回歸輸出"
