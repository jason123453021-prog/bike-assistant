# Android 交付流程標準

> 此標準依使用者於 2026-08-27 的明確指示建立，適用於後續功能、新增與修正工作。

## 交付順序

後續每次產品程式變更，先完成與變更範圍相符的本機品質檢查。至少包括相關 Jest 或 Vitest 回歸、`pnpm check`、`pnpm lint` 與 `git diff --check`；涉及 Expo 設定或版本資訊時，另執行 `pnpm exec expo config --json`。對核心資料、導航、通知、i18n 或廣泛 UI 變更，應再執行完整 Jest 與 Vitest。

本機 QC 通過且版本 metadata 已依產品變更更新後，提交並推送至 `main`，再以 GitHub Android APK workflow 產出 release artifact。Android APK artifact 成功後，交付時直接提供該 GitHub Actions artifact 的下載連結。

## E2E 範圍

Android E2E **不再是交付前置條件**，也不應在一般修正後自動啟動。只有使用者明確要求 Emulator／裝置截圖、特定端到端流程、語系視覺驗收或通知回前景驗證時，才建立或執行對應 E2E。

## 外部建置等待

若 GitHub Actions APK workflow 停在 `queued`、受 runner 容量限制或發生 GitHub 端問題，必須明確區分「本機 QC 已通過」與「尚無新版 APK artifact」。不可將排隊或雲端服務錯誤描述為產品功能失敗；artifact 可用前也不可宣稱已提供新版下載連結。

## 限制

不在沙盒手動編譯 release APK，不上傳 Google Play，也不發布／送審。交付的 Android 下載來源固定為 GitHub Actions 成功 workflow 的 artifact URL。
