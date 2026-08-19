# 單車助手：上架前 QA/QC 與穩定性檢測報告

**檢測日期：** 2026-08-19  
**檢測範圍：** Android／Expo SDK 54 受管工作流程、核心騎乘頁、背景定位、補給提醒、離線回退、設定與本機儲存。  
**檢測結論：** **未發現阻擋上架的程式碼或設定缺陷。** 本輪已修復三項可重現的發布前風險；仍有三項不阻擋上架、建議持續追蹤的事項。

> 本報告的「通過」表示已完成靜態檢查、可重現單元測試、Expo 設定解析或 Android Hermes 匯出驗證；它不取代實機背景 GPS、通知權限、旋轉與簽署 AAB 的最後驗收。

## 一、驗證總覽

| 檢測面向 | 結果 | 證據與結論 |
|---|---|---|
| TypeScript | ✅ 通過 | `pnpm check` 以零型別錯誤完成。 |
| ESLint | ✅ 通過 | `pnpm lint` 完成，零錯誤、零警告。 |
| 單元／靜態回歸 | ✅ 通過 | **289 passed / 1 skipped**；唯一跳過的是未啟用帳號功能的樣板 `auth.logout` 測試。 |
| Expo 相容性 | ✅ 通過 | `npx expo-doctor` 完成，**18/18** 檢查通過。 |
| Android production JS 匯出 | ✅ 通過 | `EAS_BUILD_PROFILE=production expo export --platform android` 成功；28 個輸出檔、Hermes bundle 約 5.79 MB、總匯出約 6.1 MB。 |
| Android 原生預生成 | ✅ 通過 | `expo prebuild --platform android --clean --no-install` 成功；受管外掛與 SDK/權限設定可解析。 |
| 正式設定 | ✅ 通過 | Android compile／target SDK 36、min SDK 24；production profile 輸出 AAB，且正式 profile 才啟用 R8／資源縮減。 |

## 二、通過項目

### 1. 靜態程式碼與建置檢查

專案的 TypeScript、Lint、完整回歸測試與 Expo Doctor 皆完成。production profile 已透過 `EAS_BUILD_PROFILE=production` 模擬，Android Hermes 匯出能列出 26 項靜態資產與 bundle metadata，表示目前圖片、字型、音效及 JavaScript 入口沒有遺失路徑。

`app.config.ts` 使用受管 Expo 設定，正式 AAB 由 `eas.json` 的 `production` profile 控制。R8 與 Android 資源縮減只會在 production profile 啟用，預覽 APK 不承受額外的 Gradle 記憶體負擔。[1] [2]

### 2. UI/UX 與適應性

全域 `ScreenContainer` 以 `SafeAreaView` 與裝置 bottom inset 處理底部系統列；全螢幕地圖騎乘頁則使用 `useSafeAreaInsets()` 對頂部工具列、導航提示、底部運動面板和選單 sheet 進行偏移。系統方向已設定為 `default`，避免 Android 大螢幕裝置忽略強制直向時產生不必要的設定衝突。

深淺主題持有獨立的 `background`、`foreground`、`surface`、`muted`、`accent` 與 `onAccent` 令牌；對比可讀性回歸測試 8 項通過。程式碼未發現 `allowFontScaling={false}`，因此不會刻意阻止系統字體放大。由於本輪不以瀏覽器模擬原生畫面，仍建議於實機以 130% 與 150% 字級做最後視覺驗收。

### 3. 韌性、離線與效能

背景補給復原、騎乘生命週期隔離、權限準備、軌跡品質、持久化批次、騎乘結束清理、模型更新契約與路線服務等回歸測試均通過。模型更新服務使用五秒逾時、每七天節流、已驗證快取與 `offline-fallback` 回傳值；無網路時維持內建／快取模型，不會阻塞本機騎乘。

本輪新增全域 `AppErrorBoundary`，將根提供者樹包覆於可重試、SafeArea 相容的錯誤備援畫面中。未知 render 例外不再直接造成無提示白屏，且 fallback 不會顯示技術性例外內容。背景定位的軌跡批次寫入與恢復快照守門仍保持原有行為。

### 4. 安全與隱私

原始碼與設定檔的硬編碼機密掃描未發現 API key、Token、密碼、Authorization 或 Bearer 值。騎乘記錄、設定、GPX 快取與模型快取使用本機儲存；本 App 沒有使用者登入流程或前端憑證交換邏輯。定位、通知、音訊與背景服務的 Android 權限均在 Expo 設定中明確列出，並保留 `RECEIVE_BOOT_COMPLETED` 的封鎖設定。

## 三、本輪修復

| 優先度 | 發現 | 修復內容 | 回歸守門 |
|---|---|---|---|
| 高 | 根路由缺少全域錯誤邊界，未知 render 例外可能形成無提示白屏。 | 新增 `components/app-error-boundary.tsx`，在根提供者外層提供 SafeArea fallback 與「重新嘗試」按鈕。 | `app-error-boundary.test.ts`。 |
| 高 | 地圖頁仍可由自動暫停、恢復、抵達、轉彎、導航開始與路線規劃發出非補給語音，違反既定騎乘語音政策。 | 移除地圖頁泛用 `speak` 與 `EmotionalUXManager` 執行路徑，收窄 `feedback-service` 語音 API；正式 TTS 僅保留「請補給能量」與「請補給水分」。 | `voice-policy-release.test.ts`。 |
| 中 | 騎乘熱路徑與可恢復錯誤仍有多處直接 Console 輸出。 | 新增 `release-safe-log.ts`，僅在 `__DEV__` 提供診斷；根啟動、背景定位、GPX、通知、匯出與 TTS 回退改用此守門。移除 AppState 熱路徑日誌。 | `release-safe-log.test.ts`、`release-debug-hygiene.test.ts`。 |
| 中 | 發布衛生測試讀取不存在的 `android/gradle.properties`，不符合 Expo Managed workflow。 | 改由 `app.config.ts` 與 `eas.json` 驗證 production 的 R8、資源縮減及 AAB profile。 | `release-debug-hygiene.test.ts`。 |

## 四、優化建議與已知限制

| 等級 | 項目 | 建議處理方式 |
|---|---|---|
| ⚠️ 建議 | `pnpm audit --prod` 在本次沙盒遭系統終止（exit 137），未能產出可信的 CVE 結果。 | 在記憶體較充足的 CI 或本機環境重新執行 `pnpm audit --prod --audit-level high`；此項未發現漏洞，但也不能當作已通過的漏洞掃描。 |
| ⚠️ 建議 | `pnpm outdated` 標示 `@types/cookie` 為 deprecated 的開發期型別套件。 | 將它列入下一次 Expo SDK 升級／依賴整理工作；它不會被 Android bundle 載入，非目前上架阻擋項。 |
| ⚠️ 建議 | 部分未進入本輪核心騎乘熱路徑的舊版管理類別與維護腳本仍保留 Console 診斷。 | 後續可逐步改用 `reportRecoverableIssue` 或移除未使用的舊版模組；本輪已收斂根啟動、背景定位、AppState、GPX、通知、匯出與地圖騎乘頁。 |
| ⚠️ 實機驗收 | 本環境已驗證 prebuild 與 Hermes 匯出，但未生成正式簽署 AAB，也無法替代 Android 真機的背景 GPS、電池最佳化、通知與 150% 字級驗收。 | 於正式 Android 建置後，在實機以飛航模式、鎖定螢幕、拒絕權限、弱 GPS 與字級放大情境逐項驗收。 |

## 五、阻擋上架的嚴重 Bug

**本輪未發現可重現的程式碼／設定阻擋項。** 靜態檢查、完整回歸、Expo 相容性、受管 Android prebuild 與 production Hermes 匯出皆已通過。

正式上架前仍須完成兩項營運性驗收：其一是取得正式簽署 AAB 並安裝實機；其二是在可用記憶體的 CI 或本機完成一次 `pnpm audit`。這兩項是發行程序與環境驗證，不是目前偵測到的 App 程式碼缺陷。

## 六、上架前最終核對清單

- [x] TypeScript、Lint、Vitest、Expo Doctor 與 Android production 匯出通過。
- [x] Android API 36、AAB production profile、R8 與資源縮減設定已稽核。
- [x] 深淺主題、安全區、字體縮放風險及高對比令牌已檢查。
- [x] 全域錯誤邊界、離線模型回退、背景騎乘復原、批次持久化與權限回退已測試。
- [x] 正式 TTS 已限制為補給能量／補給水分兩句。
- [ ] 使用正式簽署 AAB 在 Android 實機驗收背景 GPS、鎖屏、通知與放大字級。
- [ ] 在非受限環境重新執行 production dependency audit。

## 參考資料

[1]: https://docs.expo.dev/build-reference/eas-json/ "Expo — eas.json reference"
[2]: https://docs.expo.dev/versions/latest/sdk/build-properties/ "Expo — expo-build-properties"
[3]: https://docs.expo.dev/workflow/prebuild/ "Expo — Prebuild workflow"
