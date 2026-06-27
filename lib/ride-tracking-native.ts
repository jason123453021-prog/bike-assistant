/**
 * 騎乘追蹤原生模塊橋接
 * 
 * 提供 React Native 端調用原生 Android 功能的接口：
 * - 啟動/停止前台服務
 * - 管理 WakeLock
 * - 檢查和請求電池最佳化豁免
 */

import { NativeModules, Platform } from "react-native";

const RideTrackingModule = NativeModules.RideTracking || {};

export const RideTrackingNative = {
  /**
   * 啟動騎乘追蹤服務
   * 
   * 功能：
   * - 啟動 Foreground Service
   * - 獲取 WakeLock
   * - 顯示常駐通知
   */
  async startTracking(): Promise<void> {
    if (Platform.OS === "android") {
      try {
        await RideTrackingModule.startTracking?.();
        console.log("[RideTracking] Service started");
      } catch (error) {
        console.error("[RideTracking] Failed to start service:", error);
      }
    }
  },

  /**
   * 停止騎乘追蹤服務
   * 
   * 功能：
   * - 停止 Foreground Service
   * - 釋放 WakeLock
   * - 移除通知
   */
  async stopTracking(): Promise<void> {
    if (Platform.OS === "android") {
      try {
        await RideTrackingModule.stopTracking?.();
        console.log("[RideTracking] Service stopped");
      } catch (error) {
        console.error("[RideTracking] Failed to stop service:", error);
      }
    }
  },

  /**
   * 檢查是否已忽略電池最佳化
   */
  async isIgnoringBatteryOptimizations(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        return await RideTrackingModule.isIgnoringBatteryOptimizations?.() ?? false;
      } catch (error) {
        console.error("[RideTracking] Failed to check battery optimization:", error);
        return false;
      }
    }
    return true;
  },

  /**
   * 請求忽略電池最佳化
   * 
   * 會彈出系統對話框或跳轉至設定頁面
   */
  async requestIgnoreBatteryOptimizations(): Promise<void> {
    if (Platform.OS === "android") {
      try {
        await RideTrackingModule.requestIgnoreBatteryOptimizations?.();
        console.log("[RideTracking] Battery optimization exemption requested");
      } catch (error) {
        console.error("[RideTracking] Failed to request battery optimization exemption:", error);
      }
    }
  },

  /**
   * 檢查並提示用戶
   * 
   * 如果 App 在電池最佳化限制名單中，會顯示對話框
   */
  async checkAndPromptBatteryOptimization(): Promise<void> {
    if (Platform.OS === "android") {
      try {
        const isIgnoring = await this.isIgnoringBatteryOptimizations();
        if (!isIgnoring) {
          await this.requestIgnoreBatteryOptimizations();
        }
      } catch (error) {
        console.error("[RideTracking] Failed to check battery optimization:", error);
      }
    }
  },
};
