# Foreground Service 測試指南

## 概述

本指南提供在 Android 設備上測試 Foreground Service 和 WakeLock 功能的完整步驟。

## 前置條件

- Android 設備（推薦 Android 12+）
- 已安裝 Bike Assistant 應用
- 開發者選項已啟用
- USB 調試已啟用

## 測試場景

### 1. Foreground Service 通知測試

**目的：** 驗證騎乘追蹤時，通知欄是否顯示常駐通知

**步驟：**

1. 打開 Bike Assistant 應用
2. 進入 Relive（騎乘回放）頁面
3. **預期結果：**
   - 通知欄應顯示「騎乘追蹤進行中」的常駐通知
   - 通知無法被滑掉（onGoing = true）
   - 點擊通知應返回應用

**驗證方法：**

```bash
# 在開發機上查看通知日誌
adb logcat | grep "RideTrackingService"

# 應該看到類似輸出：
# D/RideTrackingService: Foreground service started
```

### 2. WakeLock 功能測試

**目的：** 驗證屏幕關閉時，CPU 是否保持喚醒狀態

**步驟：**

1. 進入 Relive 頁面開始回放
2. 立即關閉屏幕（按電源鍵）
3. 等待 5-10 分鐘
4. 打開屏幕，檢查應用是否仍在運行

**驗證方法：**

```bash
# 查看 WakeLock 狀態
adb shell "dumpsys power | grep 'Wake Locks'"

# 應該看到：
# PARTIAL_WAKE_LOCK 'BikeAssistant:RideTracking' (uid=10xxx)

# 查看日誌
adb logcat | grep "WakeLockManager"

# 應該看到：
# D/WakeLockManager: WakeLock acquired
```

### 3. 屏幕關閉時的數據持續性測試

**目的：** 驗證屏幕關閉時，騎乘數據（時間、距離、速度）是否繼續更新

**步驟：**

1. 進入 Relive 頁面，開始回放
2. 記錄當前的時間、距離、速度
3. 關閉屏幕
4. 等待 2-3 分鐘
5. 打開屏幕，檢查數據是否繼續更新

**預期結果：**

- 時間應繼續增加
- 距離應繼續增加
- 速度應根據回放數據更新
- 坡度應根據地形實時計算

### 4. 電池最佳化檢查測試

**目的：** 驗證應用是否正確檢查並提示電池最佳化設定

**步驟：**

1. 進入系統設定 → 電池 → 電池最佳化
2. 確認 Bike Assistant 在限制名單中
3. 打開應用
4. **預期結果：**
   - 應顯示對話框提示「電池最佳化」
   - 點擊「前往設定」應跳轉至系統設定頁面
   - 用戶可手動將應用從限制名單移除

**驗證方法：**

```bash
# 查看電池最佳化狀態
adb shell "dumpsys deviceidle | grep 'Bike Assistant'"

# 或使用 PowerManager API
adb shell "pm dump com.jason123453021.bikeassistant | grep -i battery"
```

### 5. 進程優先級測試

**目的：** 驗證 Foreground Service 是否提高了應用進程優先級

**步驟：**

1. 進入 Relive 頁面
2. 打開多個其他應用，佔用內存
3. 系統應優先保留 Bike Assistant 進程

**驗證方法：**

```bash
# 查看進程優先級
adb shell "ps -o PID,NAME,PRIORITY | grep bike"

# 應該看到較高的優先級（較低的數字）

# 查看 OOM 調整分數
adb shell "cat /proc/$(pidof com.jason123453021.bikeassistant)/oom_score_adj"

# Foreground Service 應該有較低的分數（更不容易被殺死）
```

## 故障排除

### 通知未顯示

**症狀：** 進入 Relive 頁面後，通知欄沒有顯示通知

**解決方案：**

1. 檢查通知權限
   ```bash
   adb shell pm grant com.jason123453021.bikeassistant android.permission.POST_NOTIFICATIONS
   ```

2. 檢查通知頻道設定
   ```bash
   adb shell settings get secure notification_badging
   ```

3. 查看日誌
   ```bash
   adb logcat | grep "RideTrackingService"
   ```

### WakeLock 未生效

**症狀：** 屏幕關閉後，應用立即暫停

**解決方案：**

1. 檢查 WAKE_LOCK 權限
   ```bash
   adb shell pm grant com.jason123453021.bikeassistant android.permission.WAKE_LOCK
   ```

2. 檢查電池最佳化設定
   - 將應用從電池最佳化限制名單移除

3. 查看日誌
   ```bash
   adb logcat | grep "WakeLockManager"
   ```

### 應用被系統殺死

**症狀：** 屏幕關閉後不久，應用被系統回收

**解決方案：**

1. 禁用電池最佳化
   ```bash
   adb shell cmd battery reset
   adb shell dumpsys deviceidle disable
   ```

2. 增加 WakeLock 超時時間（在 WakeLockManager.kt 中修改）

3. 檢查內存使用
   ```bash
   adb shell dumpsys meminfo com.jason123453021.bikeassistant
   ```

## 性能監控

### 電池消耗監控

```bash
# 查看電池消耗
adb shell "dumpsys batterystats --reset"
# 運行測試...
adb shell "dumpsys batterystats | grep -A 20 'com.jason123453021.bikeassistant'"
```

### CPU 使用率監控

```bash
# 實時監控 CPU 使用率
adb shell "top -n 1 | grep bike"
```

### 內存使用監控

```bash
# 查看內存使用
adb shell "dumpsys meminfo com.jason123453021.bikeassistant | head -20"
```

## 日誌收集

### 收集完整日誌

```bash
# 清空日誌
adb logcat -c

# 運行測試...

# 導出日誌
adb logcat > bike_assistant_test.log

# 篩選相關日誌
grep -E "RideTracking|WakeLock|BatteryOptimization" bike_assistant_test.log
```

### 查看系統日誌

```bash
# 查看 Android 系統日誌
adb shell "logcat -b system | grep -i 'bike\|foreground\|wakelock'"
```

## 測試檢查清單

- [ ] Foreground Service 通知正確顯示
- [ ] 通知無法被滑掉
- [ ] 點擊通知返回應用
- [ ] 屏幕關閉時 WakeLock 生效
- [ ] 屏幕關閉時數據繼續更新
- [ ] 電池最佳化提示正確顯示
- [ ] 系統設定頁面跳轉正常
- [ ] 進程優先級提高
- [ ] 應用不被系統殺死
- [ ] 電池消耗在可接受範圍內

## 參考資源

- [Android Foreground Service 文檔](https://developer.android.com/guide/components/foreground-services)
- [Android WakeLock 文檔](https://developer.android.com/reference/android/os/PowerManager.WakeLock)
- [Android 電池最佳化](https://developer.android.com/topic/performance/power)
- [Android 進程優先級](https://developer.android.com/guide/components/processes-and-threads)
