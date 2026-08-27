# 單車助手 1.0.103／10103 發布候選 QC 報告

> **結論：可供使用者確認後上傳至 Google Play。** 本文件不代表 AAB 已上傳、送審或發布。

| 檢查項目 | 結果 | 證據 |
| --- | --- | --- |
| 地圖、POI、觸控與繁中回歸 | 通過 | Jest 專案測試：19 suites／98 tests 通過。 |
| 全專案邏輯回歸 | 通過 | Vitest：130 files／462 tests 通過。依使用者既定偏好，本輪未執行 E2E。 |
| 型別與靜態規範 | 通過 | `pnpm check` 與 `pnpm lint` 通過。 |
| Expo 發布設定 | 通過 | 解析為 package `com.jason123453021.bikeassistant`、version `1.0.103`、versionCode `10103`。 |
| 差異格式 | 通過 | `git diff --check` 通過。 |
| 受保護 upload key AAB | 通過 | GitHub Actions [run 33064135669](https://github.com/jason123453021-prog/bike-assistant/actions/runs/33064135669) 成功；來源為 `release/1.0.103`、commit `4bf7dc84045b081ba77a5b2c791dca41a602e6d6`。 |
| 封裝後 manifest | 通過 | 可讀取 package、`ACCESS_BACKGROUND_LOCATION` 與 `FOREGROUND_SERVICE_LOCATION`；未發現 `BOOT_COMPLETED`、`REBOOT` 或 `QUICKBOOT_POWERON` action。 |
| Artifact SHA-256 | 已記錄 | `ce36e4c9f4b1d9506671b9789a13422d4831dd1599952e20725e0a577d81707a`。 |

## 本版修正範圍

本版修正道路底圖 API key 錯誤浮字、補水點／拍照點在初始與地圖範圍更新時的載入、公開 POI 查詢端點暫時失敗的後備處理、無實體觸控卻顯示 100% 長按進度，以及繁中「單車助理／騎程」等錯誤用詞。產品名稱統一為「單車助手」。

## Google Play 寫入前置條件

上傳 AAB 至正式版草稿、檢視 Play pre-check、儲存發布草稿與送交 Google 審查都會變更外部 Play Console 狀態。本版不含資料安全性聲明變更，亦不會擅自處理尚未完成的 Data Safety 草稿或公開隱私權頁部署問題。提交前需明確確認是否只上傳並儲存正式版草稿，或同時送交審查。
