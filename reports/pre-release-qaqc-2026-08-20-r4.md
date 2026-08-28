# 單車助手發布前 QC 報告（第 4 輪）

> **檢驗日期：** 2026-08-20  
> **檢驗範圍：** 目前工作版本與 Expo Go 開發連線  
> **結論：** 本輪自動化與匯出檢驗未發現可重現的發布阻擋問題；仍須在實體 Android 裝置完成 GPS、背景位置、通知與省電策略的最終驗收。

## 一、版本與發布設定基準

目前 Expo 設定可成功解析。應用名稱為「單車助手」、版本為 `1.0.3`、Android package 為 `com.jason123453021.bikeassistant`，且由 `jason1234530` 擁有。正式設定維持 Android `compileSdkVersion`／`targetSdkVersion` 36、最低 API 24、Hermes 與官方 Expo 模組架構。

正式版已明確停用 Expo OTA：`updates.enabled: false` 及 `updates.checkAutomatically: "NEVER"`。此設定僅影響安裝版 OTA 流程；Expo Go 仍會從目前開發伺服器下載 development bundle，兩者不可混為一談。

| 檢驗項目 | 結果 | 佐證 |
|---|---:|---|
| Expo 設定解析 | 通過 | `npx expo config --json` 成功輸出 |
| Android target API | 通過 | `targetSdkVersion: 36` |
| 正式 OTA | 通過 | `enabled: false`、`checkAutomatically: NEVER` |
| 禁止模組邊界 | 通過 | 未導入 NitroModules 或自訂 C++ 原生模組 |
| 開機／懸浮窗權限 | 通過 | `RECEIVE_BOOT_COMPLETED` 設為 blocked permission；未宣告 `SYSTEM_ALERT_WINDOW` |

## 二、靜態檢查與自動化測試

本輪執行 TypeScript、Expo Lint、完整 Vitest 與 Expo Doctor。所有可執行檢查均通過，未發現型別錯誤、lint error 或 Expo SDK 相依不一致問題。生產相依安全稽核未回報 high 以上的可用修復警示；Git diff whitespace 檢查亦無錯誤。

| 指令／檢驗 | 結果 |
|---|---:|
| `pnpm check` | 通過，0 型別錯誤 |
| `pnpm lint` | 通過，0 warning／0 error |
| `pnpm test` | 通過，98 個測試檔、311 項測試 |
| `npx expo-doctor` | 通過，18/18 checks |
| `pnpm audit --prod --audit-level=high` | 通過，未回報 high 以上問題 |
| `git diff --check` | 通過 |

測試範圍包含騎乘時間／距離／速度／爬升／功率計算、GPS 軌跡品質、背景復原、補給計時與通知動作、字體縮放、離線回退、深淺主題、發布設定、OTA 停用及 Expo Go 連線守門。

## 三、發布產物與開發連線

Web 靜態匯出與 Android production Hermes 匯出均成功完成。Web 產物含可部署的 `dist/index.html` 與靜態服務入口 `dist/index.js`；Android 匯出成功產生 Hermes bytecode bundle。管理預覽與 Expo Go 使用獨立服務端點，避免開發 tunnel 問題中斷管理預覽。

| 產物／端點 | 結果 | 量測結果 |
|---|---:|---|
| CI Web 靜態匯出 | 通過 | 26 個檔案，約 3.5 MB |
| Android production Hermes 匯出 | 通過 | 約 6.1 MB；`.hbc` bundle 5,791,843 bytes |
| Web 管理預覽 | 通過 | localhost HTTP 200 |
| Expo Go manifest | 通過 | `application/expo+json`、runtime `exposdk:54.0.0` |
| Expo Go Android bundle | 通過 | HTTP 200，12,204,628 bytes |

## 四、問題盤點與處置

本輪掃描曾出現 `RECEIVE_BOOT_COMPLETED` 字串，但其來源是 `blockedPermissions` 與歷史稽核文件，而非最終允許權限。發布設定會明確阻擋該權限，因此未列為發布阻擋項目。歷史服務日誌也保留舊的 ngrok／非互動啟動失敗記錄；本輪實際測試的公開 manifest 與其 Android Hermes bundle 均回應 HTTP 200，因此不影響目前可用的 Expo Go 測試連線。

目前無須修改產品程式碼。為避免誤判，後續仍應將服務日誌中的歷史失敗與即時失敗分開檢視。

## 五、實機驗收限制與建議

沙盒可驗證編譯、設定、bundle 與網路回應，但無法取代真實 Android 裝置的 GPS 晶片、系統省電限制、鎖屏、通知權限與背景前景服務行為。因此，發布前仍需要在至少一台 API 36 Android 裝置完成下列驗收。

1. 在飛航模式開始與停止騎乘，確認本機記錄、儀表板與補給倒數可正常運作。
2. 鎖屏與切換其他 App 後持續騎乘至少 15 分鐘，確認軌跡、活動時間與前景服務通知維持連續。
3. 分別拒絕再允許精確定位、背景定位與通知權限，確認畫面提供引導且不閃退。
4. 使用附件 QR Code 在 Expo Go 重新掃描，確認可下載最新開發 bundle；正式上架驗收則應改用最新 AAB 安裝版。

## 六、最終判定

**程式與匯出品質：通過。** 本輪自動化測試、設定解析、Expo SDK 健康度、Web 靜態匯出、Android Hermes 匯出與 Expo Go bundle 連線全部通過。由於原生背景定位與通知只能在實體裝置完成最終確認，本版本的發布狀態為：**可進入 Android 實機驗收，完成實機清單後即可作為正式建置候選版本。**

