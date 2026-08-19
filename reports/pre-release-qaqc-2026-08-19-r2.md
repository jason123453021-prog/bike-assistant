# 單車助手：上架前 QA/QC 與穩定性檢測報告（第二輪）

**檢測日期：** 2026-08-19  
**檢測範圍：** Android 發布前 JavaScript/TypeScript 程式碼、Expo 設定、相依套件、UI 韌性、例外回退、靜態 Web 匯出與 Android production Hermes 匯出。  
**本輪修復：** 雲端部署的 Web export 曾因 NativeWind 在 `node_modules/react-native-css-interop/.cache/web.css` 寫入暫存檔而使 Metro 無法取得 SHA-1 並失敗。本輪已將該檔案快取限制為非 CI 的開發期，production/CI 匯出改用虛擬 CSS 模組，並使 `build` script 明確帶入 `NODE_ENV=production`。

## 總結

本輪的 **TypeScript、Lint、完整單元測試、Expo 相容性檢查、production Web export 與 Android Hermes export 均通過**。先前的雲端部署阻擋已在與雲端相同的 `CI=true`、production 條件下重現並修復。Android App 的核心本機騎乘紀錄、恢復、補給、GPX 與設定流程具備既有回歸覆蓋。

不過，若上架文案或驗收標準要求「**所有功能 100% 離線**」，目前仍存在一項產品需求阻擋：底圖、地址導航、即時天氣與每週模型更新仍使用公開網路服務。程式會安全降級，不會因此白屏或無限等待；但這些功能本身不能在飛航模式下提供完整內容。因此在未內嵌離線地圖圖磚與路由圖資前，**不得宣稱整個 App 的所有功能皆可完全離線使用**。

| 結論 | 數量 | 說明 |
|---|---:|---|
| ✅ 通過 | 10 類 | 型別、Lint、設定、回歸、資產匯出、安全區域、對比、錯誤邊界、弱網回退、日誌/機密掃描。 |
| ⚠️ 待追蹤 | 2 類 | 建置工具鏈的轉移相依漏洞；大型字體與實機通知/背景行為需要正式 AAB 實測。 |
| ❌ 需求阻擋 | 1 類 | 「所有功能 100% 離線」尚未成立；限於地圖、地址路由、天氣與模型更新。 |

## ✅ 通過項目

### 1. 靜態程式碼、設定與構建

| 檢查 | 結果 | 證據 |
|---|---|---|
| TypeScript 嚴格檢查 | 通過 | `pnpm check`：0 errors。 |
| ESLint | 通過 | `pnpm lint`：0 warnings、0 errors。 |
| Expo 設定解析 | 通過 | `npx expo config --type public --json` 成功產生公開設定。 |
| Expo SDK 相容性 | 通過 | `npx expo-doctor`：18/18 checks passed。 |
| 完整回歸 | 通過 | Vitest：92 個測試檔、294 個測試全部通過。 |
| 雲端等效 Web export | 通過 | `CI=true pnpm build` 成功產生 `dist/index.html`、`metadata.json` 與 26 個檔案，約 3.9 MB。 |
| Android production JS/Hermes 匯出 | 通過 | 28 個檔案，總計約 6.1 MB；Android Hermes bundle 約 5.79 MB。 |

Expo 官方建議在 Metro 或 JavaScript bundle 問題時以 `npx expo export` 先驗證 production bundle；本輪已依此方式驗證 Android production 匯出。[4]

### 2. UI/UX 與介面適應性

根路由已提供 `SafeAreaProvider` 與 `initialWindowMetrics`；共用 `ScreenContainer` 以系統 inset 加入底部間距，主要分頁與全域錯誤回退畫面皆採用 Safe Area。這符合 `react-native-safe-area-context` 對瀏海、狀態列及底部系統導覽區的使用方式。[1]

雙主題色彩令牌包含 `background`、`surface`、`foreground`、`accent` 與 `onAccent`；可讀性回歸測試已覆蓋設定列、篩選器、導航覆蓋層、圖表、權限卡與補給按鈕的高對比前景色。`readability-contrast-ui.test.ts` 已納入 294 項完整回歸並通過。

### 3. 崩潰防禦、弱網與資源生命週期

全域 `AppErrorBoundary` 以 Safe Area 相容的中文回退畫面捕捉未處理的渲染例外，並提供「重新嘗試」而不將例外細節暴露給正式版使用者。路線服務對 BRouter/OSRM 設有逾時、HTTP 錯誤、端點驗證與 `null` 回退；天氣服務設有 5 秒逾時、一次重試、記憶體快取與 `null` 安全降級。本機通知在 Expo Go 不載入遠端 Token 流程，正式原生版僅使用本機通知；Expo 官方亦說明 Android Expo Go 不提供遠端推播 Token，而本機通知仍可使用。[3]

騎乘生命週期、背景補給恢復、軌跡品質、資料寫入批次、設定重設競態、通知 action、權限前置與 App Error Boundary 均有回歸測試，且已在完整測試中通過。正式診斷由 `reportRecoverableIssue` 集中管理，只有 `__DEV__` 才輸出 `console.warn`。

### 4. 安全與隱私

本輪掃描 118 個 App 原始碼檔案，未發現 API key、密碼或 Token 的直接字串指派；唯一直接 `console` 出現於 release-safe helper 與註解範例。此 App 目前沒有帳號、後端登入或可供保護的使用者憑證；騎乘紀錄、偏好與本機媒體屬 Local-First 功能資料，使用 AsyncStorage/檔案系統保存。若未來導入登入、API key、付款憑證或其他機密，應改用 `expo-secure-store`；該模組在 Android 以 Android Keystore 加密的 SharedPreferences 保存資料。[2]

## ⚠️ 優化建議與風險追蹤

| 優先度 | 項目 | 風險與建議 |
|---|---|---|
| 高 | 建置工具鏈轉移相依 | `pnpm audit --prod` 回報 3 low、25 moderate、55 high、2 critical。已確認兩個 critical 範例皆位於開發/建置鏈：`react-native > react-devtools-core > shell-quote` 與 `expo > @expo/cli > tar`，不是 Android Hermes runtime 的直接客戶端依賴；但若組織政策要求 high/critical 為零，仍應在 Expo SDK 支援的 patch 更新後執行受控升級與完整回歸，不建議以未驗證的 override 破壞 SDK 相容性。 |
| 中 | 字體縮放實機驗收 | 靜態檢查顯示主要文字樣式均具合理 line-height、核心控制元件有最小高度，可讀性回歸通過；但仍應以 Android 系統字體 130% 與 200% 實機確認設定頁長表單、地圖儀表板與雙補給彈窗。 |
| 中 | 正式 AAB 實機驗收 | 本輪驗證的是 production JS/Hermes 匯出，不等同於安裝後的完整 Gradle/AAB 行為。應以正式 AAB 驗收冷啟動、背景 GPS、鎖屏、本機通知 action、螢幕亮度與離線恢復。 |
| 低 | 週期性套件稽核 | 建議在 CI 每週執行 production audit、`expo-doctor`、TypeScript、Lint、Vitest、Web export 及 Android export，及早捕捉 Expo SDK/鎖檔更新造成的問題。 |

## ❌ 阻擋上架或產品宣稱的項目

| 狀態 | 項目 | 影響與處置 |
|---|---|---|
| 需求阻擋 | 全功能 100% 離線承諾 | Leaflet 底圖與插件經 CDN/公開圖磚載入；地址導航依 BRouter/OSRM；天氣依 Open-Meteo；模型更新依 HTTPS manifest。離線時程式有逾時與 `null` 回退，核心記錄可持續，但地圖圖資、地址路由、即時天氣及更新不會完整可用。若要符合全功能離線，需內嵌離線圖磚、離線地理編碼/路由圖資，並將模型更新改為使用者匯入的本機資料包；否則上架文案必須明確說明上述功能需要網路。 |

本阻擋是**功能宣稱與既定 Local-First 需求的符合性問題**，不是本輪發現的 Android 編譯、白屏或已知崩潰問題。若 Play 商店描述只宣稱「核心騎乘記錄、GPX、補給與本機歷史可離線」，本輪未發現其他立即阻擋 Android 上架的程式品質問題。

## 本輪修復與回歸守門

| 修復 | 防回歸措施 |
|---|---|
| 雲端 Web export 在 `react-native-css-interop/.cache/web.css` 取 SHA-1 失敗 | `metro.config.js` 僅於非 CI 的開發期設定 `forceWriteFileSystem`；production/CI 改用虛擬 CSS 模組。 |
| 靜態 build 缺少明確 production 條件 | `package.json` 的 `build` 改為 `cross-env NODE_ENV=production expo export --platform web --output-dir dist`。 |
| 未來腳本變動可能讓部署問題復發 | 新增 `production-web-export.test.ts`；並更新既有啟動體驗守門測試。兩項測試均已納入完整 294 項回歸。 |

## 上架判定

> **建議判定：可進行正式 AAB 實機驗收；暫不應宣稱全功能 100% 離線。**

在完成正式 AAB 的背景 GPS、鎖屏通知與字體縮放驗收前，不建議直接在 Play Console 送審。若產品需求接受「核心騎乘資料離線、地圖/地址/天氣連線增強」，則本輪程式品質與匯出檢查未發現其他阻擋上架的錯誤。

## 參考資料

[1] [Expo：react-native-safe-area-context](https://docs.expo.dev/versions/latest/sdk/safe-area-context/)  
[2] [Expo：SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)  
[3] [Expo：Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)  
[4] [Expo：Build troubleshooting](https://docs.expo.dev/build-reference/troubleshooting/)
