/**
 * 電量監測與效能模式自動調整
 */

import * as Battery from "expo-battery";
import { PerformanceMode } from "./settings-context";

export interface BatteryState {
  level: number;           // 0-1
  isLow: boolean;          // 低電量警告
  isCharging: boolean;
  state: Battery.BatteryState;
}

/**
 * 根據電量百分比自動選擇效能模式
 * - 電量 > 50%：性能模式
 * - 電量 20-50%：平衡模式
 * - 電量 < 20%：省電模式
 */
export function getAutoPerformanceMode(batteryLevel: number): PerformanceMode {
  if (batteryLevel > 0.5) {
    return "performance";
  } else if (batteryLevel > 0.2) {
    return "balanced";
  } else {
    return "battery-saver";
  }
}

/**
 * 獲取當前電量狀態
 */
export async function getBatteryState(): Promise<BatteryState> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    const state = await Battery.getBatteryStateAsync();
    const isLow = level < 0.2;
    const isCharging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;

    return {
      level,
      isLow,
      isCharging,
      state,
    };
  } catch (error) {
    console.error("Failed to get battery state:", error);
    return {
      level: 1,
      isLow: false,
      isCharging: false,
      state: Battery.BatteryState.UNKNOWN,
    };
  }
}

/**
 * 根據效能模式獲取 GPS 精度設定
 * 省電模式：降低精度，增加採樣間隔
 * 平衡模式：正常精度
 * 性能模式：高精度，頻繁採樣
 */
export function getGpsConfig(mode: PerformanceMode) {
  switch (mode) {
    case "battery-saver":
      return {
        accuracy: 100,        // 米
        interval: 5000,       // 毫秒
        fastestInterval: 10000,
      };
    case "balanced":
      return {
        accuracy: 50,
        interval: 2000,
        fastestInterval: 5000,
      };
    case "performance":
      return {
        accuracy: 10,
        interval: 1000,
        fastestInterval: 1000,
      };
  }
}

/**
 * 根據效能模式獲取螢幕更新頻率
 * 省電模式：降低刷新率
 * 平衡模式：正常刷新率
 * 性能模式：高刷新率
 */
export function getScreenRefreshConfig(mode: PerformanceMode) {
  switch (mode) {
    case "battery-saver":
      return {
        updateInterval: 2000,  // 毫秒
        animationDuration: 300,
      };
    case "balanced":
      return {
        updateInterval: 1000,
        animationDuration: 200,
      };
    case "performance":
      return {
        updateInterval: 500,
        animationDuration: 100,
      };
  }
}

/**
 * 根據效能模式獲取數據採樣率
 */
export function getDataSamplingConfig(mode: PerformanceMode) {
  switch (mode) {
    case "battery-saver":
      return {
        sensorUpdateRate: 0.5,  // 每秒採樣次數
        locationUpdateRate: 0.2,
      };
    case "balanced":
      return {
        sensorUpdateRate: 1,
        locationUpdateRate: 1,
      };
    case "performance":
      return {
        sensorUpdateRate: 2,
        locationUpdateRate: 2,
      };
  }
}
