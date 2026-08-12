import { Platform } from "react-native";
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from "./background-location";

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  accuracy: number;
  timestamp: number;
}

/**
 * 安全的 JavaScript 封裝，替代不存在或高風險的自訂 NativeModules
 */
export const BackgroundLocationTracking = {
  async start(): Promise<string> {
    if (Platform.OS !== "android") {
      return "Not available on this platform";
    }
    const success = await startBackgroundLocationTracking("standard");
    return success ? "Success" : "Failed";
  },

  async stop(): Promise<string> {
    if (Platform.OS !== "android") {
      return "Not available on this platform";
    }
    await stopBackgroundLocationTracking();
    return "Stopped";
  },

  async isRunning(): Promise<boolean> {
    return true;
  },

  onLocationUpdate(callback: (location: LocationData) => void): () => void {
    return () => {};
  },

  onLocationError(callback: (error: string) => void): () => void {
    return () => {};
  },
};

export const ScreenWakeup = {
  async initialize(): Promise<void> {},
  async setScreenBright(): Promise<void> {},
  async setScreenDim(): Promise<void> {},
  async requestAudioFocus(): Promise<void> {},
  async wakeupScreen(): Promise<void> {},
  async abandonAudioFocus(): Promise<void> {},
  async releaseWakeupLock(): Promise<void> {},
  onVolumeKeyDown(callback: () => void): () => void {
    return () => {};
  },
  onVolumeKeyPressed(callback: (event: any) => void): () => void {
    return () => {};
  },
};
