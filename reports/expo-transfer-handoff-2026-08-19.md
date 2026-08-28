# Expo 專案交接紀錄

日期：2026-08-19

## 目前外部狀態

`bike-assistant` 已由 `jason123453021eve` 成功移轉至臨時組織 `bike-assistant-transfer-jason`，再成功移轉至 `jason1234530`。Expo 最終成功頁確認目前專案網址為 `https://expo.dev/accounts/jason1234530/projects/bike-assistant`，並提示應將設定檔 `owner` 同步為 `jason1234530`。

臨時組織成員頁已確認 `jason1234530`（`jason1234530@yahoo.com.tw`）與 `jason123453021` 都是 **Owner**。此權限提升後，`jason1234530` 已在暫存組織的專案移轉頁完成最終交接。

## 必須保留的識別資料

| 項目 | 值 |
|---|---|
| EAS projectId | `af286610-25f1-45e5-afcc-6c30040d4124` |
| Android package | `com.jason123453021.bikeassistant` |
| 暫時 Expo owner | `bike-assistant-transfer-jason`（交接後仍存在，但不再擁有此專案） |
| 最終 Expo owner | `jason1234530` |

## 官方依據

Expo 官方帳號文件說明，跨帳號移轉時操作人必須在來源與目的地均有 Owner 或 Admin 權限；若目的地帳號不受來源擁有者控制，可建立 escrow（臨時）組織，授予目的地 Owner 後先移轉到該組織，再由目的地完成最終交接。組織 Owner 可授予任何角色，包含 Owner。

來源：<https://docs.expo.dev/accounts/account-types/>
