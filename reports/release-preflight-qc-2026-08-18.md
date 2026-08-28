# 單車助手發布前品質管制檢驗清單

**檢驗日期：** 2026-08-18  
**範圍：** Android 發布前的應用程式邏輯、設定、套件健康度與 JavaScript bundle 檢驗。  
**結論：** 專案已完成可在沙盒內驗證的靜態、單元與 Android Hermes bundle 品管；另有兩項必須由實體 Android 裝置與正式簽署發布包驗證的系統邊界，詳見「限制與發布前實機檢驗」。

## 一、檢驗結果摘要

| 模組 | 結果 | 證據與處置 |
|---|---|---|
| 型別安全 | 通過 | `pnpm check` 完成，TypeScript 0 errors。 |
| 程式風格與 Hook 依賴 | 通過 | `pnpm lint` 完成，0 warnings／0 errors；補齊四個智慧補給通道閉包依賴，移除未使用匯入。 |
| 回歸測試 | 通過 | Vitest：**85 passed、1 skipped；278 passed、1 skipped**。唯一跳過項目為樣板 OAuth 登出測試，App 未提供帳號功能。 |
| Expo／套件健康度 | 通過 | `expo-doctor`：18/18 checks passed。 |
| Android JavaScript 發布 bundle | 通過 | `expo export --platform android` 成功輸出 Hermes `.hbc` bundle（5.79 MB）與 `metadata.json`。 |
| Target API 與 Android 設定 | 通過 | `compileSdkVersion`／`targetSdkVersion` 為 36；`minSdkVersion` 為 24；版本為 1.0.3（versionCode 10087）。 |
| 高風險原生依賴 | 通過 | 僅使用 Expo SDK 官方模組與 React Native 標準元件；未偵測 NitroModules 或自訂 C++ 原生模組。 |

## 二、核心資料、軌跡與復原稽核

活動統計、時間記帳、定位點品質、即時海拔濾波、記錄正規化、騎乘生命週期、背景補給恢復與批次持久化共進行 31 項定向回歸測試，全部通過。測試涵蓋距離／時間分離、低品質與漂移 GPS 點拒絕、海拔雜訊抑制、暫停不重複計時、背景提醒去重與活動狀態復原。

騎乘頁的定位訂閱、AppState 訂閱、補給重複計時器、觸控解鎖計時器、天氣輪詢與自動置中計時器均有對應的清理程式。開始騎乘前新增定位服務與前景定位權限守門；若背景追蹤啟動失敗，App 會清楚說明前景仍可記錄，但鎖定螢幕／背景連續軌跡需要使用者允許背景定位與電池不受限制。

> Android 在使用者強制停止 App 或某些裝置廠商終止程序後，背景定位不能由定位事件自行重啟；使用者重新開啟 App 後才能恢復。這是系統限制，不可由應用程式宣稱 100% 繞過。[1]

## 三、權限、離線與互動邊界稽核

定位權限、背景定位、通知、離線模型回退、觸控鎖定、文字可讀性與 Expo Go 啟動穩定性共進行 23 項定向回歸測試，全部通過。當定位服務關閉、前景定位被拒絕或背景追蹤不可用時，均顯示中文引導，不會建立不完整騎乘活動或白屏。

核心騎乘記錄、統計、補給計算、歷史紀錄、GPX 匯出與已驗證模型快取可離線使用。地址搜尋、路線規劃、圖磚與即時天氣屬可選網路增強；離線時會採本機回退或以可理解訊息提示，不會中斷已開始的記錄。Expo Go 的搖動開發者選單屬 Expo Go 容器行為，正式 APK／AAB 不包含該開發者選單。

## 四、發布配置與本輪修復

本輪清理騎乘頁、背景軌跡清除、預覽容器、省電與路線選擇熱路徑中的 `console.log`／`console.info` 開發輸出，並以回歸測試守住該範圍。Android release 設定已關閉開發網路檢查器，並開啟 R8 程式縮減與資源縮減。應用程式名稱、圖示、Adaptive Icon、隱私政策 URL、套件名稱、API 36、深層連結與 GPX intent filters 均已解析確認。

## 五、限制與發布前實機檢驗

沙盒無法替代實體手機的 GPS、鎖定螢幕、廠商省電策略、通知權限與正式簽署驗證。因此，以下兩項在 APK／AAB 發布前仍須完成實機檢驗：

| 項目 | 實機操作 | 驗收標準 |
|---|---|---|
| 背景騎乘 | 開始 20 分鐘騎乘，鎖螢幕並切換 App；確認 Android 設定已允許背景定位與電池不受限制。 | 軌跡、移動時間與距離在回到前景後連續；若系統終止程序，能顯示並恢復本機快照。 |
| 正式簽署建置 | 在本專案管理介面點選 **Publish**，以 production profile 產出 AAB；若需要側載測試則選 preview APK。 | 建置系統使用受管理的正式簽署憑證；安裝後再次執行背景騎乘與通知測試。 |

正式 APK/AAB 不在沙盒直接手動產生，以避免未受管理的 keystore、資源耗盡與不可追溯簽署風險。本輪已完成正式建置前可執行的設定解析、相依診斷與 Android Hermes bundle 匯出。

## 參考資料

[1] [Expo Location — Background location platform limitations](https://docs.expo.dev/versions/latest/sdk/location/#background-location)
