# Android 原生代碼實現日誌

## 📅 實現日期
2026-06-28

## ✅ 已完成的實現

### Phase 2：Foreground Service 和 WakeLock（Bug 1）
- [x] LocationForegroundService.java
  - GPS 位置追蹤（每 1 秒更新）
  - WakeLock 管理（防止系統休眠）
  - 前台通知（顯示追蹤狀態）
  - 位置更新回調

- [x] LocationModule.java
  - React Native 橋接
  - startBackgroundLocationTracking()
  - stopBackgroundLocationTracking()
  - isBackgroundLocationTrackingRunning()
  - 位置更新事件發送

### Phase 3：鎖屏喚醒和音頻焦點（Bug 2）
- [x] ScreenWakeupActivity.java
  - setShowWhenLocked(true) - Android 8.0+
  - setTurnScreenOn(true) - Android 8.0+
  - ACQUIRE_CAUSES_WAKEUP WakeLock
  - Audio Focus 管理（AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK）
  - 音量鍵監聽框架

- [x] ScreenWakeupModule.java
  - React Native 橋接
  - initialize()
  - wakeupScreen()
  - requestAudioFocus()
  - abandonAudioFocus()
  - 音量鍵事件發送

### Phase 4：音量鍵事件攔截（Bug 3）
- [x] ScreenWakeupActivity.java 中的 handleKeyDown()
  - KeyEvent.KEYCODE_VOLUME_UP 攔截
  - KeyEvent.KEYCODE_VOLUME_DOWN 攔截
  - 返回 true 阻止音量調整

### Phase 5：Config Plugin 配置
- [x] with-foreground-service-plugin.js
  - AndroidManifest.xml 權限配置
  - LocationForegroundService 服務配置
  - ScreenWakeupActivity 活動配置
  - FOREGROUND_SERVICE_LOCATION 類型設置

### Phase 6：EAS Build 配置
- [x] eas.json
  - dev-client 構建配置
  - APK 生成設置
  - 內部分發配置

### Phase 7：React Native 集成
- [x] lib/native-modules.ts
  - BackgroundLocationTracking 模塊封裝
  - ScreenWakeup 模塊封裝
  - 事件監聽器管理
  - TypeScript 類型定義

### Phase 8：文檔
- [x] ANDROID_NATIVE_SETUP.md
  - 集成步驟指南
  - React Native 使用示例
  - 故障排除指南
  - 測試清單

---

## 🔧 文件位置

### 原生 Java 代碼
```
android/app/src/main/java/com/jason123453021/bikeassistant/
├── LocationForegroundService.java
├── LocationModule.java
├── ScreenWakeupActivity.java
└── ScreenWakeupModule.java
```

### Config Plugin
```
plugins/
└── with-foreground-service-plugin.js
```

### EAS 配置
```
eas.json
```

### React Native 集成
```
lib/
└── native-modules.ts
```

### 文檔
```
ANDROID_NATIVE_SETUP.md
NATIVE_IMPLEMENTATION_LOG.md
```

---

## 📝 使用示例

### 啟動後台位置追蹤

```typescript
import { BackgroundLocationTracking } from "@/lib/native-modules";

// 啟動
await BackgroundLocationTracking.start();

// 監聽位置更新
const unsubscribe = BackgroundLocationTracking.onLocationUpdate((location) => {
  console.log("位置更新:", location);
});

// 停止
await BackgroundLocationTracking.stop();
unsubscribe();
```

### 鎖屏喚醒和補給提醒

```typescript
import { ScreenWakeup } from "@/lib/native-modules";

// 初始化
await ScreenWakeup.initialize();

// 補給提醒觸發時
await ScreenWakeup.wakeupScreen();
await ScreenWakeup.requestAudioFocus();

// 播放語音提醒...

// 監聽音量鍵
const unsubscribeVolume = ScreenWakeup.onVolumeKeyPressed((keyName) => {
  if (keyName === "UP" || keyName === "DOWN") {
    // 關閉補給彈窗
    closeSupplyModal();
  }
});

// 清理
await ScreenWakeup.abandonAudioFocus();
unsubscribeVolume();
```

---

## 🚀 後續步驟

1. **EAS Build**
   ```bash
   eas build --platform android --profile dev-client
   ```

2. **安裝 APK**
   ```bash
   adb install -r path/to/build.apk
   ```

3. **測試**
   - 測試後台位置追蹤
   - 測試鎖屏喚醒
   - 測試音量鍵攔截
   - 測試語音播報

4. **集成到現有代碼**
   - 在 map.tsx 中集成 BackgroundLocationTracking
   - 在 HydrationReminderModal.tsx 中集成 ScreenWakeup
   - 更新補給提醒邏輯

---

## ⚠️ 重要注意事項

1. **權限**：所有必要的 Android 權限已在 app.config.ts 中聲明
2. **API 級別**：支持 Android 5.0+ (API 21+)
3. **測試**：必須在真實 Android 設備上測試，模擬器可能無法正確模擬 GPS 和喚醒鎖
4. **電源管理**：WakeLock 會影響電池消耗，應在騎乘結束時及時釋放

---

## 🐛 已知問題和解決方案

| 問題 | 解決方案 |
|------|--------|
| 構建失敗 - 找不到 Java 文件 | 檢查文件路徑是否正確 |
| NativeModule 未找到 | 重新構建 Dev Client |
| 位置更新未收到 | 檢查位置權限和 GPS 狀態 |
| 音量鍵未被攔截 | 確保 ScreenWakeupModule 已初始化 |
| 電池消耗過快 | 優化位置更新頻率或在非騎乘時停止追蹤 |

---

## 📚 參考資源

- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Android Foreground Service](https://developer.android.com/guide/components/foreground-services)
- [Android WakeLock](https://developer.android.com/reference/android/os/PowerManager.WakeLock)
- [Android KeyEvent](https://developer.android.com/reference/android/view/KeyEvent)
- [React Native Native Modules](https://reactnative.dev/docs/native-modules-android)
