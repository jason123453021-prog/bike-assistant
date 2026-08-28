# Android 測試環境設置指南

## 前置條件檢查清單

### 1. 開發環境

- [ ] Android SDK 已安裝（API Level 24+）
- [ ] Android Studio 已安裝
- [ ] ADB（Android Debug Bridge）已安裝
- [ ] Java JDK 已安裝

**驗證命令：**
```bash
adb version
java -version
```

### 2. Android 設備準備

- [ ] Android 設備已連接到電腦（USB 或 WiFi）
- [ ] USB 調試已啟用
- [ ] 開發者選項已啟用
- [ ] 設備已授予必要權限

**驗證命令：**
```bash
adb devices
# 應該看到設備列表，狀態為 "device"
```

### 3. 應用構建

- [ ] 應用已通過 `expo prebuild` 生成原生代碼
- [ ] Android 文件夾已生成
- [ ] 所有依賴已安裝

**驗證命令：**
```bash
cd /home/ubuntu/bike_assistant
ls -la android/
```

---

## 構建與安裝應用

### 方法 1：使用 EAS Build（推薦）

```bash
# 安裝 EAS CLI
npm install -g eas-cli

# 登錄 Expo 帳戶
eas login

# 構建 APK
eas build --platform android --local

# 安裝到設備
adb install -r eas-build-*.apk
```

### 方法 2：本地構建

```bash
cd /home/ubuntu/bike_assistant/android

# 使用 Gradle 構建
./gradlew assembleDebug

# 安裝到設備
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 方法 3：使用 Expo Go（快速測試）

```bash
cd /home/ubuntu/bike_assistant

# 啟動 Expo 開發服務器
npx expo start

# 掃描 QR 碼在 Expo Go 中打開
# 注意：Expo Go 不支持原生模塊，某些功能可能不可用
```

---

## 測試執行步驟

### 步驟 1：啟動應用

```bash
# 確保設備已連接
adb devices

# 啟動應用
adb shell am start -n com.jason123453021.bikeassistant/.MainActivity
```

### 步驟 2：運行自動化測試腳本

```bash
cd /home/ubuntu/bike_assistant

# 使腳本可執行
chmod +x TEST_EXECUTION_SCRIPT.sh

# 執行測試
./TEST_EXECUTION_SCRIPT.sh
```

### 步驟 3：手動驗證

按照腳本提示進行手動驗證：
- 檢查通知欄
- 關閉屏幕
- 檢查數據更新
- 驗證電池最佳化提示

---

## 測試場景詳細說明

### 場景 1：Foreground Service 通知

**預期結果：**
- 進入 Relive 頁面後，通知欄顯示「騎乘追蹤進行中」
- 通知無法被滑掉（常駐通知）
- 點擊通知返回應用

**驗證方法：**
```bash
# 查看日誌
adb logcat | grep "RideTrackingService"

# 預期輸出：
# D/RideTrackingService: Foreground service started
```

### 場景 2：WakeLock 功能

**預期結果：**
- 屏幕關閉後，應用繼續運行
- CPU 保持喚醒狀態
- 數據繼續更新

**驗證方法：**
```bash
# 查看 WakeLock 狀態
adb shell "dumpsys power | grep -A 5 'Wake Locks'"

# 查看日誌
adb logcat | grep "WakeLockManager"
```

### 場景 3：屏幕關閉時的數據持續性

**預期結果：**
- 屏幕關閉 3 分鐘後打開
- 時間、距離、速度繼續更新
- 沒有數據中斷

**手動驗證：**
1. 記錄當前時間和距離
2. 關閉屏幕 3 分鐘
3. 打開屏幕
4. 驗證數據是否增加

### 場景 4：電池最佳化檢查

**預期結果：**
- App 啟動時檢查電池最佳化狀態
- 如果在限制名單中，彈出對話框
- 用戶可跳轉至系統設定

**驗證方法：**
```bash
# 查看電池最佳化狀態
adb shell "dumpsys deviceidle | grep -i 'bike'"

# 查看日誌
adb logcat | grep "BatteryOptimization"
```

### 場景 5：進程優先級

**預期結果：**
- Foreground Service 提高進程優先級
- 應用不被系統輕易殺死
- OOM 分數較低

**驗證方法：**
```bash
# 查看進程優先級
adb shell "ps -o PID,NAME,PRIORITY | grep bike"

# 查看 OOM 分數
adb shell "cat /proc/$(pidof com.jason123453021.bikeassistant)/oom_score_adj"
```

---

## 性能監控

### 電池消耗

```bash
# 重置電池統計
adb shell "dumpsys batterystats --reset"

# 運行測試...

# 查看電池統計
adb shell "dumpsys batterystats | grep -A 20 'com.jason123453021.bikeassistant'"
```

### CPU 使用率

```bash
# 實時監控
adb shell "top -n 1 | grep bike"

# 或使用 Android Studio Profiler
# 在 Android Studio 中打開 Profiler 工具
```

### 內存使用

```bash
# 查看內存使用
adb shell "dumpsys meminfo com.jason123453021.bikeassistant | head -20"

# 或使用 Android Studio Memory Profiler
```

---

## 日誌收集

### 收集完整日誌

```bash
# 清空日誌
adb logcat -c

# 運行測試...

# 導出日誌
adb logcat > test_results_$(date +%Y%m%d_%H%M%S).log

# 查看特定日誌
grep -E "RideTracking|WakeLock|BatteryOptimization" test_results_*.log
```

### 查看系統日誌

```bash
# 查看 Android 系統日誌
adb shell "logcat -b system | grep -i 'bike\|foreground\|wakelock'"
```

---

## 故障排除

### 問題 1：ADB 無法連接設備

**症狀：** `adb devices` 顯示空列表

**解決方案：**
```bash
# 重啟 ADB 服務
adb kill-server
adb start-server

# 檢查 USB 連接
adb devices

# 或使用 WiFi 連接
adb connect <device_ip>:5555
```

### 問題 2：應用安裝失敗

**症狀：** `adb install` 返回錯誤

**解決方案：**
```bash
# 卸載舊版本
adb uninstall com.jason123453021.bikeassistant

# 重新安裝
adb install -r app-debug.apk

# 或檢查設備存儲空間
adb shell "df -h"
```

### 問題 3：Foreground Service 通知未顯示

**症狀：** 進入 Relive 頁面後沒有通知

**解決方案：**
```bash
# 授予通知權限
adb shell pm grant com.jason123453021.bikeassistant android.permission.POST_NOTIFICATIONS

# 檢查通知設定
adb shell settings get secure notification_badging

# 查看日誌
adb logcat | grep "RideTrackingService"
```

### 問題 4：WakeLock 未生效

**症狀：** 屏幕關閉後應用立即暫停

**解決方案：**
```bash
# 授予 WAKE_LOCK 權限
adb shell pm grant com.jason123453021.bikeassistant android.permission.WAKE_LOCK

# 禁用電池最佳化
adb shell dumpsys deviceidle disable

# 查看日誌
adb logcat | grep "WakeLockManager"
```

---

## 測試檢查清單

- [ ] ADB 連接正常
- [ ] 應用已安裝到設備
- [ ] Foreground Service 通知顯示
- [ ] 通知無法被滑掉
- [ ] 點擊通知返回應用
- [ ] 屏幕關閉時 WakeLock 生效
- [ ] 屏幕關閉時數據繼續更新
- [ ] 電池最佳化提示顯示
- [ ] 系統設定頁面跳轉正常
- [ ] 進程優先級提高
- [ ] 應用不被系統殺死
- [ ] 電池消耗在可接受範圍內
- [ ] 日誌收集完整

---

## 參考資源

- [Android Debug Bridge (adb) 文檔](https://developer.android.com/studio/command-line/adb)
- [Foreground Service 文檔](https://developer.android.com/guide/components/foreground-services)
- [WakeLock 文檔](https://developer.android.com/reference/android/os/PowerManager.WakeLock)
- [Expo Prebuild 文檔](https://docs.expo.dev/workflow/prebuild/)
- [Android Studio Profiler](https://developer.android.com/studio/profile/profiler)
