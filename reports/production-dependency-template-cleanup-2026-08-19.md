# Production 相依安全與模板模組整理報告

**專案：** 單車助手（`bike-assistant`）  
**日期：** 2026-08-19  
**作者：** Manus AI

## 結論

本輪已將專案收斂為純 Expo／React Native 的 Local-First Android App，移除未被行動端引用的 tRPC、Express、MySQL、Drizzle、OAuth、社群與模板伺服器堆疊。掃描發現未使用的 `axios@1.13.2` 命中 OSV 已知漏洞資料；因該套件只被已移除的模板伺服器引用，本次直接刪除整個未使用依賴鏈，而非將漏洞遺留為不必要的 production 暴露面。[1]

| 項目 | 結果 | 證據／說明 |
|---|---|---|
| 直接 production 相依安全檢查 | **已完成** | 逐套件 OSV 查詢檢出 `axios@1.13.2` 受影響；其餘核心直接套件未回傳已知漏洞。 |
| Axios 風險處理 | **已完成** | 移除未使用的 `axios` 與其模板伺服器呼叫端；目前 production 依賴樹不再包含 axios。 |
| 模板伺服器與資料庫 | **已移除** | 移除 `server/`、`drizzle/`、tRPC、Express、MySQL、Drizzle、OAuth callback 與對應建置腳本。 |
| 舊版導航／語音模組 | **已移除** | 移除未被 App 引用的即時導航、轉彎語音、情感語音、舊補給管理與 onboarding 管理器。 |
| Console 診斷 | **已收斂** | 正式執行路徑改用 `reportRecoverableIssue`；只有 `release-safe-log.ts` 在 `__DEV__` 下輸出診斷。 |
| 設定與靜態檢查 | **通過** | `pnpm check`、`pnpm lint`、`npx expo config --json` 均成功。 |
| 完整回歸 | **通過** | `pnpm test` 成功；路線服務等直接載入模組的測試已驗證相對匯入解析。 |
| Expo 相容性 | **通過** | `npx expo-doctor` 成功。 |
| Android production 匯出 | **通過** | Hermes 匯出 28 個檔案，產物約 6.1 MB，其中 Android bundle 約 5.79 MB。 |

## 清理範圍

刪除的模板堆疊不參與 App 路由、騎乘生命週期、GPS、離線儲存或 Android 原生發布流程。專案啟動腳本已改為只啟動 Expo Metro；不再啟動已刪除的 Node 伺服器。這可降低相依解析、監看程序與不必要網路／資料庫模組對行動端開發與發布的干擾。

同時，權限、亮度控制、騎乘恢復、路線回退與地圖 AppState 恢復等仍會保留既有的錯誤回退；僅將正式版 Console 輸出改為開發期可見的受控診斷，並未移除錯誤處理或使用者提示。

## 已知限制與後續建議

由於沙盒對 Node 記憶體有硬限制，`pnpm audit --prod --json` 在建構完整相依報告時發生 heap out-of-memory；`npm audit` 則無法使用 pnpm lockfile。因此本輪改以 OSV 公開資料 API 逐一驗證核心直接 production 相依，並移除唯一被檢出的、且未使用的 Axios 堆疊。若日後在記憶體更充足的 CI 環境執行，仍建議加入完整 lockfile 的遞迴 audit 作為週期性防線。

> 本輪未加入 NitroModules、C++ 原生模組、雲端帳號功能或遠端資料同步；App 維持以 Expo 官方模組與本機資料流程運作。

## References

[1]: https://osv.dev/vulnerability/GHSA-xx6v-rp6x-q39c "OSV — Axios advisory GHSA-xx6v-rp6x-q39c"
