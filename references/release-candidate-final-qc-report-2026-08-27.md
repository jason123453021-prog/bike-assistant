# 單車助手 Release Candidate 最終 QC 與 Google Play 上架準備報告

**版本：** 1.0.102（versionCode 10102）  
**Package：** `com.jason123453021.bikeassistant`  
**報告日期：** 2026-08-27  
**測試策略：** 依既定交付偏好完成本機單元／整合／靜態驗證與 GitHub Android AAB 工作流程；**未啟動 Android E2E**。本報告不以自動化測試替代實體裝置、Google Play Console 或法律審閱的結論。

## 結論摘要

Release Candidate 的可自動驗證項目已完成並通過。本機品質守門為 Jest **16 suites／89 tests**、Vitest **130 files／462 tests**、TypeScript、Expo Lint、Expo config 解析及 `git diff --check` 全數成功。最終 GitHub workflow 亦成功建置受保護 upload key 簽署的 `.aab`，並直接檢查**封裝完成 AAB** 的 binary manifest 不含 `BOOT_COMPLETED`、`REBOOT` 或各類 quick boot action。

不過，**尚未將此 AAB 上傳至 Play Console、未送審、未發布**。商店公開文案仍有需修正的 Local-first 功能描述，Data Safety、Sensitive app permissions、內容分級及 Console 隱私權政策欄位尚未逐題核對，且隱私權政策／日韓阿語法律文字仍為草案。因此現況是「可交付 AAB 已備妥、外部上架條件尚未全部確認」，而非「已上架」。

| 範圍 | 最終狀態 | 證據／限制 |
|---|---|---|
| 程式與邏輯品質 | 通過 | Jest 16/89、Vitest 130/462、TypeScript、Expo Lint、設定解析與 diff 檢查成功。 |
| Android 15 BOOT_COMPLETED／FGS 風險 | 最終 AAB 通過 | 初次 bundle 暴露 Gradle 合併缺口後，改以 `tools:node="replace"` 覆寫兩個 Expo receiver；最終封裝 AAB binary manifest guard 成功。 |
| 正式 AAB／簽署 | 通過 | GitHub run `33037338529` success；package、版本、upload key 憑證和必要 location FGS permissions 已核對。 |
| Play Console AAB 接受度 | 未驗證 | 尚未上傳，upload key 是否已被 Console 接受仍須實際草稿上傳。 |
| 商店資訊與資產 | 部分備妥、待核准 | icon 1/1、Feature Graphic 1/1、手機截圖 5/8 已存在；文字內容與 1.0.102／Local-first 邊界不完全相符。 |
| Data Safety／敏感權限／隱私政策 | 未完成 Console／法務核對 | app 內顯眼告知已實作並測試；但 Console 表單與法律核准不可自動推論。 |
| 實體 Android／OEM／語系視覺 | 未執行 | 未跑 E2E；沒有把模擬或靜態測試誤列為實機驗證。 |

## 本機與 CI 品質證據

最後一次全套本機 QC 輸出儲存在 `/tmp/bike-assistant-release-candidate-local-qc-manifest-merge-fix.log`。測試包含 GPS／騎乘生命週期、補給倒數、GPX、POI、i18n、背景復原、release signing、權限與靜態安全守門。Vitest 中新增 Android 15 receiver merge guard，驗證高優先級 receiver replace 標記、移除開機 actions、保留 app 內通知與 Task Manager event、保留 `MY_PACKAGE_REPLACED`。

| 品質守門 | 結果 | 備註 |
|---|---:|---|
| Jest | 16 suites／89 tests passed | 應用程式 UI／靜態守門測試。 |
| Vitest | 130 files／462 tests passed | 演算法、資料模型、i18n、Android release 與整合守門。 |
| TypeScript | passed | `tsc --noEmit`。 |
| Expo Lint | passed | `expo lint`。 |
| Expo config | passed | 解析到 version `1.0.102`、versionCode `10102`、正確 package。 |
| Diff 檢查 | passed | `git diff --check`。 |
| Android E2E | 未執行 | 符合使用者「後續不以 E2E 為交付前置」的指定。 |

## 使用者驗收清單覆蓋矩陣

下表的「自動驗證」指程式邏輯、狀態或靜態結構已由測試覆蓋；它不表示觸控手勢、GPU 繪製、GPS 天線、OEM 背景限制或第三方服務在實機環境中已保證完全一致。

| 清單區域 | 自動驗證覆蓋 | 目前判定 | 仍需人工／實機驗證 |
|---|---|---|---|
| 設定頁 POI 開關、持久化、地圖無額外開關 | `poi-layer.test.ts`、`poi-layers-i18n-and-ui.test.ts`、設定持久化守門 | 邏輯通過 | 真機重開後 marker 可見狀態。 |
| 水滴／相機點位、遠景聚合、Bottom Sheet、釘選導航 | POI 資料過濾／分類／聚合、Leaflet bridge、Bottom Sheet 與 pin navigation 守門 | 邏輯通過 | 實際 tile／大量 marker 繪製效能與互動流暢度。 |
| 釘選導航後視角回到目前位置 | `pinned-navigation-layers.test.ts`、導航生命週期守門 | 邏輯通過 | 實機 GPS 與 WebView 鏡頭動畫。 |
| 沉浸式全螢幕導航列 | `ride-focus-experience.test.ts`、release config guards | 程式／設定通過 | Android 版本、三鍵／手勢導航及 OEM 實測。 |
| 補水倒數溫濕區間與暫停重排 | `hydration-factors.test.ts`、`hydration-recalculation.test.ts`、`supply-pause-recovery.test.ts` | 演算法通過 | 真實天氣資料可得性與騎乘體感。 |
| 能量倒數 FTP／體重／強度與暫停解耦 | `smart-supply-countdown.test.ts`、`energy-serving-carbohydrate-setting.test.ts`、`supply-pause-recovery.test.ts` | 演算法通過 | 個人化參數與長時間騎乘實測。 |
| 總爬升、坡度、功率、匯出一致性 | `live-elevation-filter.test.ts`、`gpx-elevation-filter.test.ts`、`gpx-export.test.ts`、`ride-control-data-alignment.test.ts` | 本機演算法與匯出鏈通過 | 無法聲稱與 Strava 私有氣壓計／DEM 管線完全相同；須用同一路線實測比對。 |
| 儀表板自訂與排序 | `settings-i18n-deep-audit.test.ts`、`navigation-dashboard-summary.test.ts` | 狀態與渲染鏈通過 | 各螢幕尺寸與 200% 字體的實機排版。 |
| GPX 匯入、資料帶入與路線估算 | `external-gpx-import.test.ts`、`route-estimate-snapshot.test.ts`、`route-energy-supply.test.ts` | 解析與計算鏈通過 | 多來源 GPX 檔案的現場抽樣。 |
| 天氣成功路徑與離線 fallback | 路線／天氣資料、i18n fallback 與 offline non-blocking guards | 容錯邏輯通過 | 公開天氣服務實際可用性、速率限制與弱網行為。 |
| 自動省電、系統亮度交還、觸控鎖與幽靈進度條 | `supply-modal-brightness-hold.test.ts`、`touch-guard-cancel-ui.test.ts`、背景／省電守門 | 狀態邏輯通過 | 系統自動亮度、真實 touch pointer、不同 OEM 省電限制。 |
| 13 locale、fallback、防跨語系洩漏與長字串／RTL | i18n audit、`i18n-rtl-layout-resilience.test.ts`、visible JSX 掃描與通知／匯出翻譯守門 | 字典與靜態布局規則通過 | 日、韓、Arabic 的實體 Android 200% 字體逐頁校對。 |
| Target SDK、AAB、版本遞增、簽署與 location FGS | Android release config／signing／boot receiver tests，最終 GitHub workflow／AAB binary manifest guard | 通過 | Play Console 實際接受 upload key／AAB 與 policy pre-check。 |
| 背景定位顯眼告知 | `ride-permission-readiness.test.ts`、`ride-start-location-readiness.test.ts`，開始騎乘與設定頁同意前守門 | 程式流程與 13 語系文案通過 | Android 系統授權流程及 Play 審查判定。 |
| 離線啟動、地圖與騎乘容錯 | `address-navigation-offline-nonblocking.test.ts`、背景騎乘與本機通知相容性守門 | 失敗降級邏輯通過 | 真實無網路、快取 tile 與各 OEM 網路回復行為。 |
| 512×512 icon、Feature Graphic、手機／平板截圖、隱私政策 | 既有 Console 表單唯讀檢視與 app config URL 靜態守門 | 部分備妥 | Feature Graphic／截圖是否為當前版、平板與多語系素材、Console Privacy Policy URL、Data Safety、內容分級與法律核准。 |

## 最終 Android App Bundle 證據

| 項目 | 核對結果 |
|---|---|
| GitHub workflow | [Google Play 正式 AAB #33037338529](https://github.com/jason123453021-prog/bike-assistant/actions/runs/33037338529) 已成功。 |
| Artifact | `bike-assistant-google-play-aab`，ID `9632743029`，GitHub 顯示 `37,329,597` bytes，保留至 2026-09-10 03:59 UTC。 |
| Artifact 下載 | [GitHub AAB artifact](https://github.com/jason123453021-prog/bike-assistant/actions/runs/33037338529/artifacts/9632743029)。 |
| 解壓 AAB | `app-release.aab`，`37,806,121` bytes，SHA-256 `1b4996164ae010d3ad87561dbd6a1b1ba3e75beea5f7380dbcaaa6f018190f7d`。 |
| 實際 metadata | `com.jason123453021.bikeassistant`／versionName `1.0.102`／versionCode `10102`。 |
| SDK | compile／target SDK `36`，min SDK `24`。 |
| 簽署 | `CN=Bike Assistant Upload Key, OU=Release, O=Bike Assistant, L=Taipei, ST=Taiwan, C=TW`；certificate SHA-256 `B1:A5:FB:BA:CF:83:2A:92:7A:61:3F:6A:FE:C2:91:FC:10:50:D9:46:01:EC:02:93:76:5A:DF:EA:D5:C1:8F:C3`。 |
| 封裝 manifest | `ACCESS_BACKGROUND_LOCATION`、`FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_LOCATION` 均存在；受限制 BOOT／REBOOT／quick boot action 檢查通過。 |

## Play Console 唯讀核對與上架缺口

目前帳戶已確認能存取此 app。最新正式版仍是 `bike-assistant-v1_0_89`（versionCode `10089`，100% rollout）；另有一份未命名正式版草稿，範圍 172 個國家／地區，未列出本輪 AAB。舊版 1.0.89 的技術品質頁面顯示 BOOT_COMPLETED FGS、無邊框 API 和大型螢幕提醒；最終 AAB 已在 workflow 層消除 BOOT_COMPLETED action，但後兩項以及 Play 對最終 AAB 的實際掃描仍須在草稿上傳後確認。

| 提交前項目 | 狀態 | 下一步 |
|---|---|---|
| 最終 AAB 上傳／upload key 接受 | 未進行 | 需先取得使用者確認，將 AAB 上傳到既有正式版草稿後讀取 Play pre-check。 |
| 發布軌道與範圍 | 未確認 | 使用者須在「只上傳草稿」、「送交審查」或「正式 100% 推出」中明確選擇。 |
| 商店文字 | 待產品／法務核准 | 以 `google-play-store-listing-draft-1.0.102-zh-TW.md` 取代不相符的「隊友遙測／自動重算」描述。 |
| 圖像素材 | 部分存在 | 既有 icon 1/1、Feature Graphic 1/1、手機截圖 5/8；須確認反映 1.0.102，並補齊／核准平板與多語系策略。 |
| Data Safety／FGS 聲明／背景位置聲明 | 未唯讀核對 | 依最終 manifest 與實際資料流逐題填寫；不應以本機測試推定答案。 |
| 隱私權政策 | URL 配置存在，法律核准待完成 | 合格律師須確認背景／前景位置、POI viewport、30 分鐘快取與所有翻譯文本。 |
| 內容分級／測試軌道規定 | 未核對 | 在 Console 確認是否有 closed testing 或帳戶層級條件。 |
| 實體 Android／OEM 驗證 | 未進行 | 在實機驗證位置、通知 action、背景復原、觸控鎖、沉浸模式及 200% RTL 排版。 |

## 參考資料

1. [Android 15 行為變更：BOOT_COMPLETED 啟動前景服務限制](https://developer.android.com/about/versions/15/behavior-changes-15)
2. [Android 前景服務類型與 Google Play 聲明](https://developer.android.com/develop/background-work/services/fgs/service-types)
3. [Android Manifest 合併與 `tools:node="replace"`](https://developer.android.com/build/manage-manifests)
4. [Google Play 目標 API 層級規定](https://developer.android.com/google/play/requirements/target-sdk)
5. [Google Play 商店資訊與預覽素材規格](https://support.google.com/googleplay/android-developer/answer/9866151?hl=zh-Hant)
6. [Play Console 本輪唯讀觀察](./play-console-session-observation-2026-08-27.md)
7. [AAB 建置與簽署狀態](./release-candidate-aab-build-status-2026-08-27.md)
