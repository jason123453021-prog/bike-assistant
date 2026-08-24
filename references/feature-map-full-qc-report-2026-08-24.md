# 單車助手：完整功能地圖全自動 QC 報告

**執行日期：** 2026-08-24  
**驗收基準：** `FEATURE_MAP_PRD_2026-08-24.md` 與 `references/feature-map-qc-matrix-2026-08-24.md`  
**範圍：** 現行 TypeScript／React Native 程式、核心演算、導航、補給、活動、分享、標準匯出、設定、背景資料鏈與 Expo Android 組態。

> **結論：自動化檢查通過，無目前可重現的封版阻擋項。** 本結果只覆蓋可在沙盒可靠執行的靜態、單元／整合、設定及 Android Hermes bundle 驗證；真實 GPS、OEM 背景限制、亮度、TTS、通知、外部分享與實道路線仍須在 Android 實機確認。

## 1. 執行結果摘要

| 類別 | 自動化結果 | 證據 | 判定 |
|---|---|---|---|
| 差異格式 | `git diff --check` 無輸出 | 文件與待辦無空白／patch 格式錯誤 | 通過 |
| TypeScript | `pnpm check` 成功 | `tsc --noEmit` 0 error | 通過 |
| 靜態規則 | `pnpm lint` 成功 | `expo lint` 0 warning／error | 通過 |
| 核心資料鏈 | 4 檔、26 項 targeted tests | 移動時間、正規化、自動暫停、自動分圈 | 通過 |
| 導航／補給／匯出 | 13 檔、59 項 targeted tests | COG、GPX／FIT、分享、恢復、智慧補給與通知 | 通過 |
| 完整回歸 | 125 檔、426 項 tests | `pnpm test` | 通過 |
| Expo SDK | 18/18 checks passed | `npx expo-doctor` | 通過 |
| 正式設定 | App `單車助手`、1.0.90、Android package 已解析 | `npx expo config --type public --json` | 通過 |
| Android Hermes | 1 個 Android HBC bundle、26 項 assets、共 28 檔 | `EAS_BUILD_PROFILE=production npx expo export --platform android` | 通過 |
| GitHub Android APK | workflow run 32736347306 成功；artifact 未過期 | `bike-assistant-preview-apk`，28,358,260 bytes | 通過 |
| 開發伺服器 | 最近 Metro bundle 成功；歷史 ELIFECYCLE 後已重啟 | `.manus-logs/devserver.log` | 通過（附註） |

## 2. 功能地圖對應驗證

| PRD 模組 | 已執行的自動化案例 | 檢查內容 | 結果 |
|---|---|---|---|
| 核心紀錄與演算 | `moving-time-gps-integrity`、`ride-record-normalizer`、`background-auto-pause`、`auto-lap-milestones` | 可信 GPS 時間鏈、暫停前防抖區間、移動／總經過時間分離、錯誤舊紀錄修復、固定距離分圈插值 | 4 檔／26 項通過 |
| 導航與地圖 | `cog-navigation`、`external-gpx-import` | COG 視窗、前視航向、on/off track 回退、左右轉幾何、外部 GPX 接收 | 通過 |
| 運動補給 | `smart-supply-plan`、`smart-supply-countdown`、`supply-pause-recovery`、`hydration-recalculation`、背景補給守門 | 10–30 分鐘補水範圍、絕對到期時間、暫停比例補償、60 秒逾時回退與通知狀態一致 | 通過 |
| 活動／分享／匯出 | `local-share-card`、`gpx-export`、`fit-export`、`ride-session-recovery-statistics` | 路線等比例分享、零分母安全格式、原始時間戳、FIT elapsed/timer 分離、暫停點統計隔離 | 通過 |
| 已移除項目 | 完整 Vitest 內的 `manual-lap-experience`、`daylight-removal` 等守門 | 手動 Lap、日出／日落提醒不應回歸；硬體羅盤／Kalman 未被產品資料鏈採用 | 通過 |
| 設定與防護 | 完整 Vitest、TypeScript、Lint 與正式 config | AsyncStorage 正規化、設定 UI 守門、權限與 Android manifest 組態 | 通過 |

## 3. Android 與設定驗證

正式公開設定成功解析出版本 **1.0.90**、Android `versionCode` **10090** 與套件名稱 `com.jason123453021.bikeassistant`。定位、背景定位、前景定位服務、通知、震動、Wake Lock、音訊與相片選取權限均在解析後設定中存在；OTA 更新維持停用，正式 JavaScript 引擎為 Hermes。

Android export 成功建立一個約 **5.88 MB** 的 Hermes HBC bundle、**26** 項資產及 metadata。此動作驗證 JavaScript bundle 與 Metro 資產層，不等同於已在實體裝置安裝或完成 Google Play 簽署／上傳。

GitHub Actions 亦已完成可安裝的 Android APK 驗收建置：[workflow run 32736347306](https://github.com/jason123453021-prog/bike-assistant/actions/runs/32736347306) 成功，artifact `bike-assistant-preview-apk` 為 **28,358,260 bytes**，有效至 **2026-09-07 14:19:56 UTC**。workflow 顯示第三方 action 的 Node.js 20 棄用提醒，但 action 已被 GitHub runner 強制升至 Node.js 24，工作流程、品質守門、Gradle 建置與 artifact 上傳皆成功；本輪將其列為非阻擋的依賴維護提醒。

## 4. 警告、限制與實機驗收邊界

| 類型 | 狀態 | 說明與處理建議 |
|---|---|---|
| 阻擋項 | 無 | 本輪自動命令未發現 TypeScript、Lint、測試、Expo Doctor 或 Android Hermes export 阻擋問題。 |
| 歷史日誌 | 非阻擋 | 日誌仍可見 2026-08-23 的舊 `ELIFECYCLE` 紀錄；其後服務已重啟，2026-08-24 多次 Metro bundle 成功，未見目前編譯錯誤。 |
| GPS／背景 | 需實機 | 單元測試可驗證狀態機，不能模擬不同手機、衛星遮蔽、廠商省電政策、鎖屏與定位批次時機。 |
| 系統互動 | 需實機 | TTS、震動、亮度恢復、通知 action、相片／文件分享需在 Android 實機與目標社群 App 驗證。 |
| 第三方相容 | 需實機／第三方 | GPX/FIT 結構已由輸出測試驗證；仍建議實際匯入第三方服務或檢視器確認其個別解讀。 |

## 5. 建議實機驗收腳本

1. 以 20 分鐘真實騎乘測試開始、紅燈靜止超過 10 秒、恢復與停止，核對活動時間、移動時間、暫停與自動暫停是否合理。
2. 匯入含兩個明顯轉彎的 GPX，測試 100 m 螢幕喚醒、50 m TTS、偏離後 COG 回退、回到 20 m 路線範圍內的前視航向。
3. 在前景、鎖屏與回到前景時各完成一次智慧補水／補給通知確認，確認下一輪僅建立一次。
4. 完成活動後將 GPX、FIT 與 PNG 分享圖卡分別交由第三方檢視器／社群 App 開啟，核對路線時間戳、活動時間與圖卡文字可讀性。
