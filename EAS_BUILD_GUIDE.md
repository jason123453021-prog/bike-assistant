# EAS Build 指南 - Dev Client APK 生成

本指南說明如何使用 EAS Build 生成包含原生代碼和 TTS 功能的 Dev Client APK。

## ⚠️ 若構建在 19% 卡住或超時

已應用以下優化到 `eas.json`：

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk",
        "distribution": "internal",
        "resourceClass": "default",
        "env": {
          "EXPO_DEBUG": "0",
          "SKIP_BUNDLER_CACHE_INVALIDATION": "1"
        }
      }
    }
  },
  "cache": {
    "key": "bike-assistant-cache",
    "disabled": false
  },
  "buildTimeout": 3600
}
```

**優化說明**：
- `EXPO_DEBUG: "0"` - 禁用調試模式，加快編譯
- `SKIP_BUNDLER_CACHE_INVALIDATION: "1"` - 跳過緩存驗證
- `cache` - 啟用構建緩存
- `buildTimeout: 3600` - 增加超時時間到 1 小時

若仍然超時，嘗試：
```bash
eas build --platform android --profile dev-client --clear-cache
```

## 前置要求

1. **安裝 EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **登錄 EAS 帳戶**
   ```bash
   eas login
   ```
   - 如果沒有帳戶，請在 https://expo.dev 註冊

3. **初始化項目（如果尚未初始化）**
   ```bash
   eas init
   ```

## 生成 Dev Client APK

### 步驟 1：確保所有依賴已安裝
```bash
cd /home/ubuntu/bike_assistant
pnpm install
```

### 步驟 2：執行 EAS Build
```bash
eas build --platform android --profile dev-client
```

### 步驟 3：等待構建完成
- 構建通常需要 5-15 分鐘
- 可以在 EAS 控制台查看進度：https://expo.dev/builds
- 構建完成後會收到郵件通知

### 步驟 4：下載 APK
- 構建完成後，點擊下載連結獲取 APK 文件
- 或使用命令行：
  ```bash
  eas build:list --platform android
  eas build:download <build-id>
  ```

## 在 Android 設備上安裝

### 方法 1：使用 ADB（推薦）
```bash
adb install -r bike_assistant-dev-client.apk
```

### 方法 2：直接傳輸到設備
1. 將 APK 複製到設備
2. 使用文件管理器打開 APK
3. 點擊「安裝」

## 測試三個 Bug 修復

### Bug 1：背景 GPS 失效
1. 打開應用並開始騎乘
2. 按下手機電源鍵關閉屏幕
3. 等待 30 秒
4. 按下電源鍵點亮屏幕
5. 檢查軌跡是否持續記錄（應該沒有「切西瓜」現象）

### Bug 2：鎖屏補給提醒失效
1. 在騎乘中，等待補給提醒觸發
2. 按下電源鍵關閉屏幕
3. 觀察：
   - 屏幕是否自動點亮？
   - 是否聽到語音播報？
   - 是否看到彈窗？

### Bug 3：音量鍵無法關閉彈窗
1. 補給彈窗顯示時
2. 按下手機側邊的音量鍵（加或減）
3. 檢查彈窗是否關閉

## 查看日誌

### 實時日誌
```bash
adb logcat | grep -E "HydrationReminder|BackgroundLocation|ScreenWakeup|TtsManager"
```

### 關鍵日誌標記
- `[HydrationReminder]` - 補給提醒相關
- `[BackgroundLocation]` - 後台位置追蹤相關
- `[ScreenWakeup]` - 鎖屏喚醒相關
- `[TtsManager]` - 文字轉語音相關

## 常見問題

### Q1：構建失敗怎麼辦？
- 檢查 `app.config.ts` 中的權限配置
- 確保所有依賴已正確安裝
- 查看 EAS 構建日誌了解具體錯誤

### Q2：APK 安裝失敗
- 確保設備已啟用「未知來源」安裝
- 使用 `adb install -r` 強制覆蓋安裝
- 檢查設備存儲空間是否充足

### Q3：功能在 Dev Client 中不工作
- 檢查 logcat 日誌
- 確保原生模塊已正確編譯
- 驗證 Android 版本是否滿足要求（API 24+）

## 後續優化

1. **性能優化**
   - 調整 GPS 更新頻率
   - 優化後台服務資源消耗

2. **功能擴展**
   - 添加更多自訂補給品
   - 支援多語言 TTS

3. **生產構建**
   - 完成測試後，執行 `eas build --platform android --profile production` 生成 AAB 文件
   - 上傳到 Google Play Store

## 支援

如有問題，請：
1. 查看 EAS 官方文檔：https://docs.expo.dev/eas-update/introduction/
2. 檢查 Expo 社區論壇：https://forums.expo.dev
3. 查看項目日誌了解具體錯誤信息

## 編譯優化檢查清單

在執行 EAS Build 前，確認以下項目：

- [ ] `eas.json` 已應用優化配置（buildTimeout、cache、env）
- [ ] `app.config.ts` 中的 plugins 已精簡
- [ ] `package.json` 中移除了未使用的依賴
- [ ] TypeScript 編譯 0 錯誤：`npm run check`
- [ ] 本地 Metro 編譯成功：`npm run dev:metro`
- [ ] 清除緩存並重新構建：`eas build --platform android --profile dev-client --clear-cache`
