# Android 原生代碼集成指南

本文檔說明如何集成原生 Android 代碼以修復三個嚴重 Bug。

## 📋 已創建的文件

### 1. 原生 Java 模塊

#### LocationForegroundService.java
- **位置**：`android/app/src/main/java/com/jason123453021/bikeassistant/LocationForegroundService.java`
- **功能**：
  - 後台 GPS 追蹤服務
  - 持續監聽位置更新（每 1 秒）
  - 保持 WakeLock 防止系統休眠
  - 通過 React Native 橋接發送位置更新

#### LocationModule.java
- **位置**：`android/app/src/main/java/com/jason123453021/bikeassistant/LocationModule.java`
- **功能**：
  - React Native 橋接模塊
  - 啟動/停止後台位置追蹤
  - 發送位置更新事件到 React Native
  - 檢查服務運行狀態

#### ScreenWakeupActivity.java
- **位置**：`android/app/src/main/java/com/jason123453021/bikeassistant/ScreenWakeupActivity.java`
- **功能**：
  - 在鎖屏時點亮螢幕（setShowWhenLocked + setTurnScreenOn）
  - 管理 Audio Focus（確保語音播報優先級）
  - 攔截實體音量鍵事件
  - 管理 WakeLock（ACQUIRE_CAUSES_WAKEUP）

#### ScreenWakeupModule.java
- **位置**：`android/app/src/main/java/com/jason123453021/bikeassistant/ScreenWakeupModule.java`
- **功能**：
  - React Native 橋接模塊
  - 初始化鎖屏喚醒功能
  - 請求/放棄 Audio Focus
  - 發送音量鍵事件到 React Native

### 2. Config Plugin

#### with-foreground-service-plugin.js
- **位置**：`plugins/with-foreground-service-plugin.js`
- **功能**：
  - 在 AndroidManifest.xml 中添加 Foreground Service 權限
  - 配置 LocationForegroundService
  - 配置 ScreenWakeupActivity
  - 添加 WAKE_LOCK 和其他必要權限

### 3. EAS Build 配置

#### eas.json
- **位置**：`eas.json`
- **功能**：
  - 定義 EAS Build 配置
  - 配置 dev-client 構建選項
  - 支持 APK 生成

---

## 🚀 集成步驟

### 步驟 1：安裝 EAS CLI

```bash
npm install -g eas-cli
```

### 步驟 2：登錄 EAS

```bash
eas login
```

### 步驟 3：初始化項目（如果尚未初始化）

```bash
eas init
```

### 步驟 4：更新 app.config.ts

在 `app.config.ts` 中添加 Config Plugin：

```typescript
const config: ExpoConfig = {
  // ... 其他配置 ...
  plugins: [
    // ... 現有插件 ...
    require("./plugins/with-foreground-service-plugin.js"),
  ],
};
```

### 步驟 5：構建 Dev Client

```bash
eas build --platform android --profile dev-client
```

或使用本地構建（需要 Android SDK）：

```bash
eas build --platform android --profile dev-client --local
```

### 步驟 6：安裝 APK

```bash
adb install -r path/to/build.apk
```

---

## 🔧 React Native 集成

### 在 React Native 中使用原生模塊

#### 1. 後台位置追蹤

```typescript
import { NativeModules } from "react-native";

const { LocationModule } = NativeModules;

// 啟動後台位置追蹤
await LocationModule.startBackgroundLocationTracking();

// 停止後台位置追蹤
await LocationModule.stopBackgroundLocationTracking();

// 檢查是否運行
const isRunning = await LocationModule.isBackgroundLocationTrackingRunning();
```

#### 2. 鎖屏喚醒

```typescript
import { NativeModules, NativeEventEmitter } from "react-native";

const { ScreenWakeupModule } = NativeModules;

// 初始化
await ScreenWakeupModule.initialize();

// 點亮螢幕
await ScreenWakeupModule.wakeupScreen();

// 請求 Audio Focus
await ScreenWakeupModule.requestAudioFocus();

// 監聽音量鍵事件
const screenWakeupEmitter = new NativeEventEmitter(ScreenWakeupModule);
screenWakeupEmitter.addListener("onVolumeKeyPressed", (keyName) => {
  console.log("Volume key pressed:", keyName); // "UP" 或 "DOWN"
  // 關閉補給彈窗
});
```

#### 3. 位置更新事件

```typescript
import { NativeEventEmitter } from "react-native";

const { LocationModule } = NativeModules;

const locationEmitter = new NativeEventEmitter(LocationModule);
locationEmitter.addListener("onLocationUpdate", (location) => {
  console.log("Location updated:", location);
  // {
  //   latitude: 25.123,
  //   longitude: 121.456,
  //   altitude: 100,
  //   speed: 5.5,
  //   accuracy: 10,
  //   bearing: 45,
  //   timestamp: 1234567890
  // }
});
```

---

## 🐛 故障排除

### 問題 1：構建失敗 - 找不到 Java 文件

**解決方案**：確保文件路徑正確
```
android/app/src/main/java/com/jason123453021/bikeassistant/LocationForegroundService.java
```

### 問題 2：運行時錯誤 - NativeModule 未找到

**解決方案**：
1. 確保 Config Plugin 已添加到 app.config.ts
2. 重新構建 Dev Client
3. 清除 Expo 緩存：`expo start -c`

### 問題 3：位置更新未收到

**解決方案**：
1. 檢查位置權限是否已授予
2. 確保 GPS 已啟用
3. 查看 Android Studio Logcat 中的日誌

### 問題 4：音量鍵未被攔截

**解決方案**：
1. 確保 ScreenWakeupModule 已初始化
2. 檢查 Activity 是否正確配置 setShowWhenLocked
3. 驗證音量鍵監聽器是否已設置

---

## 📝 測試清單

- [ ] 後台位置追蹤在螢幕關閉時繼續工作
- [ ] 補給提醒在鎖屏時點亮螢幕
- [ ] 補給提醒彈窗在鎖屏時顯示
- [ ] 語音播報在鎖屏時播放
- [ ] 實體音量鍵可以關閉補給彈窗
- [ ] 軌跡不會出現「切西瓜」現象
- [ ] 應用在後台執行時不會被系統殺死

---

## 📚 參考資源

- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Android Foreground Service](https://developer.android.com/guide/components/foreground-services)
- [Android WakeLock](https://developer.android.com/reference/android/os/PowerManager.WakeLock)
- [Android KeyEvent](https://developer.android.com/reference/android/view/KeyEvent)
