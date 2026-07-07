# EAS Build 本地編譯完整指南 - Android 開發版 APK

本指南提供詳細的步驟，幫助您快速生成 Android 開發版 APK 用於真機測試。包含原生 Foreground Service、MMKV 存檔、GPS 定位等核心功能。

---

## 📋 前置需求

### 1. 安裝 EAS CLI
```bash
npm install -g eas-cli
# 或使用 pnpm
pnpm add -g eas-cli

# 驗證版本
eas --version  # 應該 >= 5.0.0
```

### 2. 登錄 Expo 帳戶
```bash
eas login
# 按提示輸入 Expo 帳戶的 Email 和密碼
# 如果沒有帳戶，請先在 https://expo.dev 註冊

# 驗證登錄狀態
eas whoami
```

### 3. 驗證項目配置
```bash
cd /home/ubuntu/bike_assistant

# 檢查 app.json 是否正確配置
cat app.json | grep -A 5 '"slug"'

# 檢查 eas.json 是否存在
ls -la eas.json

# 檢查依賴是否完整
pnpm install
```

---

## 🚀 快速編譯步驟（推薦）

### 方案 A：使用 EAS Cloud Build（最簡單，推薦首選）

**優點**：
- ✅ 無需本地 Android SDK
- ✅ 自動處理簽名和依賴
- ✅ 編譯速度快（5-15 分鐘）
- ✅ 支援多個 Android 版本
- ✅ 自動上傳到 EAS 服務器

**完整步驟**：

```bash
# 1. 進入項目目錄
cd /home/ubuntu/bike_assistant

# 2. 清理舊的編譯產物（可選但推薦）
rm -rf dist/ .expo/ node_modules/.cache

# 3. 確保依賴已安裝
pnpm install

# 4. 執行 EAS Build（開發版 APK）
eas build --platform android --profile development

# 5. 等待編譯完成（通常 5-15 分鐘）
# 編譯過程中會顯示實時進度
# 完成後會顯示下載連結

# 6. 查看編譯結果
eas build:view

# 7. 下載 APK 到本地
# 方法 A：從命令行下載
eas build:download <BUILD_ID> --path ./bike_assistant_dev.apk

# 方法 B：從瀏覽器下載
# 複製編譯完成後顯示的下載連結，用瀏覽器打開
```

### 方案 B：本地編譯（需要 Android SDK）

**前置條件**：
- 已安裝 Android Studio 或 Android SDK
- 已設置 `ANDROID_HOME` 環境變數
- 已安裝 Java JDK 11 或更高版本

**完整步驟**：

```bash
cd /home/ubuntu/bike_assistant

# 1. 安裝依賴
pnpm install

# 2. 執行本地編譯
eas build --platform android --profile development --local

# 3. 編譯完成後，APK 會在以下目錄
# ./dist/bike_assistant-dev.apk
# 或 ./build/outputs/apk/debug/app-debug.apk

# 4. 驗證 APK 文件
ls -lh dist/bike_assistant-dev.apk
```

---

## 📱 安裝 APK 到真機

### 使用 ADB（Android Debug Bridge）

```bash
# 1. 連接 Android 設備到電腦
# 設置 → 開發者選項 → 啟用 USB 調試

# 2. 驗證設備連接
adb devices
# 應該顯示設備列表，例如：
# List of attached devices
# emulator-5554          device
# FA8AX1A123             device

# 3. 安裝 APK（推薦使用 -r 參數覆蓋舊版本）
adb install -r bike_assistant_dev.apk

# 4. 驗證安裝成功
adb shell pm list packages | grep bikeassistant

# 5. 啟動應用
adb shell am start -n com.bikeassistant/.MainActivity

# 6. 查看實時日誌
adb logcat | grep -E "bike_assistant|ForegroundService|MMKV|GPS"
```

### 使用 Android Studio

1. 打開 Android Studio
2. 選擇 `Device Manager` → 連接真機或啟動虛擬機
3. 拖拽 APK 文件到 Device Manager 窗口
4. 應用會自動安裝並啟動

---

## 🔧 配置詳解

### eas.json 各個 Profile 說明

| Profile | 用途 | 特點 | 何時使用 |
|---------|------|------|---------|
| `development` | 開發版本 | Expo Dev Client，支援熱更新 | 日常開發、功能測試 |
| `dev-client` | 開發客戶端 | 同上，備用配置 | 備用方案 |
| `preview` | 預覽版本 | 接近生產環境的測試版 | Beta 測試、性能測試 |
| `production` | 生產版本 | 優化後的正式版本 | 上傳 Play Store |

### 編譯配置參數解釋

```json
{
  "android": {
    "buildType": "apk",           // 格式：apk（開發）或 aab（生產）
    "distribution": "internal",   // 分發方式：internal（不上傳 Play Store）
    "developmentClient": true,    // 啟用 Expo Dev Client（支援熱更新）
    "env": {
      "EXPO_DEBUG": "1"           // 啟用調試模式（詳細日誌）
    }
  }
}
```

---

## 🐛 常見問題排查

### 問題 1：`eas login` 失敗
```bash
# 清除舊的登錄信息
eas logout

# 重新登錄
eas login

# 驗證登錄狀態
eas whoami
```

### 問題 2：編譯失敗 - 依賴問題
```bash
# 清理 node_modules 和 lock 文件
rm -rf node_modules pnpm-lock.yaml

# 重新安裝依賴
pnpm install

# 重新編譯
eas build --platform android --profile development
```

### 問題 3：編譯失敗 - 簽名問題
```bash
# 讓 EAS 自動生成簽名密鑰
eas build --platform android --profile development --clear-cache

# 按提示選擇 "Let EAS handle the app signing"
```

### 問題 4：APK 安裝失敗 - 版本衝突
```bash
# 先卸載舊版本
adb uninstall com.bikeassistant

# 重新安裝
adb install bike_assistant_dev.apk
```

### 問題 5：設備無法連接
```bash
# 重啟 ADB 服務
adb kill-server
adb start-server

# 重新連接設備
adb devices

# 檢查 USB 連接
lsusb
```

### 問題 6：編譯超時或失敗
```bash
# 增加超時時間並清除緩存
eas build --platform android --profile development --clear-cache --wait

# 或查看詳細日誌
eas build:view
```

---

## 📊 編譯進度監控

### 查看編譯日誌
```bash
# 在編譯過程中，可以查看實時日誌
eas build --platform android --profile development --wait

# 編譯完成後查看詳細日誌
eas build:view

# 查看特定編譯的日誌
eas build:view <BUILD_ID> --log
```

### 查看已編譯的版本
```bash
# 列出所有編譯記錄
eas build:list --platform android

# 查看特定編譯的詳細信息
eas build:view <BUILD_ID>

# 下載特定版本的 APK
eas build:download <BUILD_ID> --path ./bike_assistant_dev.apk
```

---

## 🚀 快速命令速查表

```bash
# ========== 登錄和驗證 ==========
eas login                                    # 登錄 Expo 帳戶
eas whoami                                   # 驗證登錄狀態
eas logout                                   # 登出

# ========== 編譯命令 ==========
eas build --platform android --profile development              # 雲端編譯（推薦）
eas build --platform android --profile development --local     # 本地編譯
eas build --platform android --profile development --clear-cache  # 清除緩存重新編譯
eas build --platform android --profile development --wait      # 等待編譯完成

# ========== 查看編譯結果 ==========
eas build:list --platform android                              # 列出所有編譯
eas build:view                                                  # 查看最新編譯
eas build:view <BUILD_ID>                                       # 查看特定編譯
eas build:download <BUILD_ID> --path ./bike_assistant_dev.apk  # 下載 APK

# ========== 安裝和測試 ==========
adb devices                                  # 列出連接的設備
adb install -r bike_assistant_dev.apk       # 安裝 APK
adb uninstall com.bikeassistant             # 卸載應用
adb shell am start -n com.bikeassistant/.MainActivity  # 啟動應用

# ========== 日誌和調試 ==========
adb logcat                                   # 查看實時日誌
adb logcat | grep bike_assistant            # 過濾應用日誌
adb logcat -c                                # 清除日誌
adb shell pm list packages | grep bikeassistant  # 驗證應用安裝

# ========== 清理 ==========
rm -rf dist/ .expo/ node_modules/.cache     # 清理編譯產物
pnpm install                                 # 重新安裝依賴
```

---

## 📝 編譯後檢查清單

編譯完成後，請按以下清單進行驗證：

- [ ] APK 文件大小合理（通常 40-100 MB）
- [ ] 應用在真機上成功安裝
- [ ] 應用能正常啟動，無崩潰
- [ ] GPS 定位功能正常（檢查日誌中的 GPS 信息）
- [ ] 後台 Foreground Service 正常運行
- [ ] MMKV 存檔正常工作（檢查日誌中的 MMKV 信息）
- [ ] 轉彎語音播報正常
- [ ] 沒有異常日誌或警告

---

## 💡 性能優化建議

### 減少 APK 大小
```bash
# 在 app.json 中配置
{
  "android": {
    "enableProguard": true,  // 啟用代碼混淆
    "minSdkVersion": 24      // 設置最低 SDK 版本
  }
}
```

### 加速編譯
```bash
# 使用增量編譯（從上次編譯的緩存開始）
eas build --platform android --profile development --cache-from=last

# 清除緩存重新編譯（確保最新代碼）
eas build --platform android --profile development --clear-cache
```

### 優化後台服務
```bash
# 檢查 Foreground Service 是否正常運行
adb shell dumpsys activity services | grep com.bikeassistant

# 監控內存使用
adb shell dumpsys meminfo com.bikeassistant
```

---

## 🧪 功能測試指南

### 測試 1：GPS 定位和軌跡記錄
```bash
# 1. 打開應用並開始騎乘
# 2. 查看實時日誌
adb logcat | grep -E "GPS|Location|Track"

# 3. 驗證軌跡是否持續記錄
# 4. 檢查 MMKV 存檔是否正常
adb logcat | grep MMKV
```

### 測試 2：後台保活
```bash
# 1. 開始騎乘
# 2. 按下電源鍵關閉屏幕
# 3. 等待 30-60 秒
# 4. 按下電源鍵點亮屏幕
# 5. 檢查軌跡是否持續記錄（應該沒有間斷）

# 查看日誌驗證
adb logcat | grep ForegroundService
```

### 測試 3：轉彎語音播報
```bash
# 1. 加載 GPX 文件並開始導航
# 2. 靠近轉彎點
# 3. 檢查是否聽到語音播報
# 4. 查看日誌
adb logcat | grep -E "TurnDetection|Speech"
```

### 測試 4：多廠牌設備適配
在以下設備上進行測試：
- [ ] 小米（激進的後台殺進程）
- [ ] OPPO（激進的後台殺進程）
- [ ] Vivo（激進的後台殺進程）
- [ ] Samsung（相對溫和）
- [ ] 其他品牌

---

## 📞 技術支援和資源

| 資源 | 連結 |
|------|------|
| Expo 官方文檔 | https://docs.expo.dev/build/setup/ |
| EAS 命令參考 | https://docs.expo.dev/eas-cli/ |
| Android 開發文檔 | https://developer.android.com/ |
| Expo 社區論壇 | https://forums.expo.dev |
| GitHub Issues | https://github.com/expo/expo/issues |

---

## ✅ 下一步

編譯完成並通過基本測試後，建議進行以下工作：

### 短期（1-2 天）
1. **功能驗證**
   - [ ] GPS 定位精度測試
   - [ ] 後台保活穩定性測試
   - [ ] 轉彎語音播報測試
   - [ ] 地圖顯示流暢度測試

2. **性能測試**
   - [ ] 電池消耗率測試
   - [ ] 內存占用監控
   - [ ] CPU 使用率監控

### 中期（3-7 天）
3. **兼容性測試**
   - [ ] 小米設備測試
   - [ ] OPPO 設備測試
   - [ ] Vivo 設備測試
   - [ ] 不同 Android 版本測試（API 24-34）

4. **實地騎乘測試**
   - [ ] 市區導航測試
   - [ ] 山區無訊號測試
   - [ ] 長距離騎乘測試（2+ 小時）

### 長期（1-2 週）
5. **優化和改進**
   - [ ] 根據測試結果優化性能
   - [ ] 修復發現的 Bug
   - [ ] 添加用戶反饋的功能

---

祝編譯和測試順利！🚀 如有任何問題，請查閱上述資源或提交 Issue。
