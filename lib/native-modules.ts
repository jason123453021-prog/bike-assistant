import { NativeModules, NativeEventEmitter, Platform } from "react-native";

const { LocationModule, ScreenWakeupModule } = NativeModules;

/**
 * 後台位置追蹤模塊
 */
export const BackgroundLocationTracking = {
  /**
   * 啟動後台位置追蹤
   */
  async start(): Promise<string> {
    if (Platform.OS !== "android") {
      console.warn("Background location tracking is only available on Android");
      return "Not available on this platform";
    }
    return LocationModule.startBackgroundLocationTracking();
  },

  /**
   * 停止後台位置追蹤
   */
  async stop(): Promise<string> {
    if (Platform.OS !== "android") {
      return "Not available on this platform";
    }
    return LocationModule.stopBackgroundLocationTracking();
  },

  /**
   * 檢查後台位置追蹤是否運行
   */
  async isRunning(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return false;
    }
    return LocationModule.isBackgroundLocationTrackingRunning();
  },

  /**
   * 監聽位置更新事件
   */
  onLocationUpdate(callback: (location: LocationData) => void): () => void {
    if (Platform.OS !== "android") {
      console.warn("Location updates are only available on Android");
      return () => {};
    }

    const emitter = new NativeEventEmitter(LocationModule);
    const subscription = emitter.addListener("onLocationUpdate", callback);

    return () => subscription.remove();
  },

  /**
   * 監聽位置錯誤事件
   */
  onLocationError(callback: (error: string) => void): () => void {
    if (Platform.OS !== "android") {
      return () => {};
    }

    const emitter = new NativeEventEmitter(LocationModule);
    const subscription = emitter.addListener("onLocationError", callback);

    return () => subscription.remove();
  },
};

/**
 * 鎖屏喚醒模塊
 */
export const ScreenWakeup = {
  /**
   * 初始化鎖屏喚醒功能
   */
  async initialize(): Promise<string> {
    if (Platform.OS !== "android") {
      console.warn("Screen wakeup is only available on Android");
      return "Not available on this platform";
    }
    return ScreenWakeupModule.initialize();
  },

  /**
   * 點亮螢幕
   */
  async wakeupScreen(): Promise<string> {
    if (Platform.OS !== "android") {
      return "Not available on this platform";
    }
    return ScreenWakeupModule.wakeupScreen();
  },

  /**
   * 請求 Audio Focus
   */
  async requestAudioFocus(): Promise<string> {
    if (Platform.OS !== "android") {
      return "Not available on this platform";
    }
    return ScreenWakeupModule.requestAudioFocus();
  },

  /**
   * 放棄 Audio Focus
   */
  async abandonAudioFocus(): Promise<string> {
    if (Platform.OS !== "android") {
      return "Not available on this platform";
    }
    return ScreenWakeupModule.abandonAudioFocus();
  },

  /**
   * 釋放喚醒鎖
   */
  async releaseWakeupLock(): Promise<string> {
    if (Platform.OS !== "android") {
      return "Not available on this platform";
    }
    return ScreenWakeupModule.releaseWakeupLock();
  },

  /**
   * 清理資源
   */
  async cleanup(): Promise<string> {
    if (Platform.OS !== "android") {
      return "Not available on this platform";
    }
    return ScreenWakeupModule.cleanup();
  },

  /**
   * 監聽音量鍵事件
   */
  onVolumeKeyPressed(callback: (keyName: "UP" | "DOWN") => void): () => void {
    if (Platform.OS !== "android") {
      console.warn("Volume key interception is only available on Android");
      return () => {};
    }

    const emitter = new NativeEventEmitter(ScreenWakeupModule);
    const subscription = emitter.addListener("onVolumeKeyPressed", callback);

    return () => subscription.remove();
  },
};

/**
 * 位置數據類型
 */
export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  accuracy: number;
  bearing: number;
  timestamp: number;
}
