/**
 * 背景 GPS 追蹤 — 使用 expo-task-manager + expo-location
 * 必須在模組頂層定義 TaskManager 任務
 * 
 * 功能：
 * 1. 背景位置更新持久化到 AsyncStorage（供前台恢復使用）
 * 2. 背景中持續計算距離和卡路里消耗
 * 3. 背景中觸發補給提醒通知（即使螢幕鎖定）
 */

import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export const BACKGROUND_LOCATION_TASK = "BIKE_BACKGROUND_LOCATION";
const BG_TRACK_KEY = "@bike_bg_track_points";
const BG_STATE_KEY = "@bike_bg_state";

export interface BackgroundState {
  totalDistanceM: number;
  calories: number;
  sweatLossMl: number;
  lastLat: number;
  lastLon: number;
  lastTimestamp: number;
  isRiding: boolean;
  calorieThreshold: number;
  waterThreshold: number;
  calorieReminderSent: boolean;
  waterReminderSent: boolean;
}

// Haversine 距離計算（背景任務中不能 import 其他模組的函數）
function bgHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 定義背景任務（必須在模組頂層，不能在函數內）
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[BackgroundLocation] Error:", error.message);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    try {
      // 讀取背景狀態
      const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
      if (!stateStr) return; // 未啟動騎乘，忽略
      const state: BackgroundState = JSON.parse(stateStr);
      if (!state.isRiding) return;

      // 處理每個位置更新
      for (const loc of locations) {
        const { latitude, longitude, speed } = loc.coords;
        const timestamp = loc.timestamp;
        const speedMs = speed ?? 0;
        const speedKmh = speedMs * 3.6;

        // 計算距離增量
        if (state.lastLat !== 0 && state.lastLon !== 0) {
          const dist = bgHaversine(state.lastLat, state.lastLon, latitude, longitude);
          // 過濾 GPS 跳動（單次距離超過 200m 視為異常）
          if (dist < 200 && dist > 1) {
            state.totalDistanceM += dist;
          }
        }

        // 簡化的卡路里估算（背景中使用簡化公式）
        if (speedKmh > 3) {
          const dt = state.lastTimestamp > 0 ? (timestamp - state.lastTimestamp) / 1000 : 0;
          if (dt > 0 && dt < 30) {
            // 簡化功率估算：P ≈ 0.5 * CdA * ρ * v³ + Crr * m * g * v
            const v = speedMs;
            const m = 80; // 預設體重
            const power = Math.max(0, 0.5 * 0.4 * 1.2 * v * v * v + 0.005 * m * 9.81 * v);
            const calPerSec = power / 4.184 / 0.25; // 機械效率 25%
            state.calories += calPerSec * dt / 1000; // kcal
            // 簡化汗液估算
            state.sweatLossMl += (0.8 * dt / 3600) * 1000; // ~800ml/hr
          }
        }

        state.lastLat = latitude;
        state.lastLon = longitude;
        state.lastTimestamp = timestamp;
      }

      // 檢查補給提醒
      if (state.calories >= state.calorieThreshold && !state.calorieReminderSent) {
        state.calorieReminderSent = true;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🍌 補給提醒",
            body: "已消耗大量卡路里，建議補充能量棒或食物",
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });
      }

      if (state.sweatLossMl >= state.waterThreshold && !state.waterReminderSent) {
        state.waterReminderSent = true;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "💧 補水提醒",
            body: "水分流失達到補水條件，建議立即補充水分",
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });
      }

      // 保存背景狀態
      await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));

      // 保存軌跡點（追加模式）
      const trackStr = await AsyncStorage.getItem(BG_TRACK_KEY);
      const trackPoints: Array<{ lat: number; lon: number; ts: number }> = trackStr ? JSON.parse(trackStr) : [];
      for (const loc of locations) {
        trackPoints.push({
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          ts: loc.timestamp,
        });
      }
      // 限制最多保存 10000 點（約 14 小時，每 5 秒一點）
      if (trackPoints.length > 10000) {
        trackPoints.splice(0, trackPoints.length - 10000);
      }
      await AsyncStorage.setItem(BG_TRACK_KEY, JSON.stringify(trackPoints));
    } catch (e) {
      console.warn("[BackgroundLocation] Processing error:", e);
    }
  }
});

/**
 * 啟動背景位置追蹤前，初始化背景狀態
 */
export async function initBackgroundState(params: {
  calorieThreshold: number;
  waterThreshold: number;
  currentLat: number;
  currentLon: number;
}) {
  const state: BackgroundState = {
    totalDistanceM: 0,
    calories: 0,
    sweatLossMl: 0,
    lastLat: params.currentLat,
    lastLon: params.currentLon,
    lastTimestamp: Date.now(),
    isRiding: true,
    calorieThreshold: params.calorieThreshold,
    waterThreshold: params.waterThreshold,
    calorieReminderSent: false,
    waterReminderSent: false,
  };
  await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  // 清空舊軌跡
  await AsyncStorage.setItem(BG_TRACK_KEY, JSON.stringify([]));
}

/**
 * 停止背景追蹤時，標記狀態為非騎乘
 */
export async function stopBackgroundState() {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (stateStr) {
      const state: BackgroundState = JSON.parse(stateStr);
      state.isRiding = false;
      await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
    }
  } catch {}
}

/**
 * 獲取背景追蹤的軌跡點（前台恢復時使用）
 */
export async function getBackgroundTrackPoints(): Promise<Array<{ lat: number; lon: number; ts: number }>> {
  try {
    const str = await AsyncStorage.getItem(BG_TRACK_KEY);
    return str ? JSON.parse(str) : [];
  } catch {
    return [];
  }
}

/**
 * 獲取背景狀態（前台恢復時使用）
 */
export async function getBackgroundState(): Promise<BackgroundState | null> {
  try {
    const str = await AsyncStorage.getItem(BG_STATE_KEY);
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
}

export async function startBackgroundLocationTracking() {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("[BackgroundLocation] Background permission denied");
      return false;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (!isRegistered) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: "🚴 單車助手正在追蹤",
          notificationBody: "GPS 追蹤中，點擊返回應用",
          notificationColor: "#00C896",
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
    }
    return true;
  } catch (e) {
    console.warn("[BackgroundLocation] Start failed:", e);
    return false;
  }
}

export async function stopBackgroundLocationTracking() {
  try {
    await stopBackgroundState();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (e) {
    console.warn("[BackgroundLocation] Stop failed:", e);
  }
}
