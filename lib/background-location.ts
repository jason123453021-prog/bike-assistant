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
import { getLocalNotifications } from "@/lib/local-notifications";
import { SUPPLY_NOTIFICATION_CATEGORY } from "@/lib/supply-notification-actions";
import {
  addTrackPoint,
  createNewRideSession,
  initializeRideSession,
  saveRideSessionSnapshot,
} from "@/lib/ride-recovery/ride-session-recovery";

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
  rideStartedAt: number;
  supplyIntervalReminderEnabled: boolean;
  supplyTimeIntervalEnabled: boolean;
  supplyTimeIntervalMinutes: number;
  supplyDistanceIntervalEnabled: boolean;
  supplyDistanceIntervalKm: number;
  intervalLastTimeSec: number;
  intervalLastDistanceKm: number;
  intervalTimeReminderSent: boolean;
  intervalDistanceReminderSent: boolean;
  trackingMode?: "full" | "idle_monitor";
  gpsAccuracy?: GpsAccuracyLevel;
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
      const recoverySession = (await initializeRideSession()) ?? createNewRideSession();

      // 處理每個位置更新
      for (const loc of locations) {
        const { latitude, longitude, speed } = loc.coords;
        const timestamp = loc.timestamp;
        const speedMs = speed ?? 0;
        const speedKmh = speedMs * 3.6;

        // 省電監測期間只低頻確認是否重新移動，不寫入騎乘軌跡與統計。
        if ((state.trackingMode ?? "full") === "idle_monitor") {
          const movementM = state.lastLat !== 0 && state.lastLon !== 0
            ? bgHaversine(state.lastLat, state.lastLon, latitude, longitude)
            : 0;
          state.lastLat = latitude;
          state.lastLon = longitude;
          state.lastTimestamp = timestamp;
          if (speedKmh >= 3 || movementM >= 18) {
            state.trackingMode = "full";
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
            if (isRegistered) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            await Location.startLocationUpdatesAsync(
              BACKGROUND_LOCATION_TASK,
              locationTaskOptions(state.gpsAccuracy ?? "standard", "full"),
            );
          }
          await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
          continue;
        }

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

        addTrackPoint(
          recoverySession,
          {
            timestamp,
            latitude,
            longitude,
            altitude: loc.coords.altitude ?? undefined,
            speed: speed ?? undefined,
            accuracy: loc.coords.accuracy ?? undefined,
            heading: loc.coords.heading ?? undefined,
          },
          recoverySession.trackPoints.at(-1),
        );
        recoverySession.stats.caloriesBurned = state.calories;
        recoverySession.stats.waterLoss = state.sweatLossMl;
        await saveRideSessionSnapshot(recoverySession);
      }

      // 檢查補給提醒
      if (state.calories >= state.calorieThreshold && !state.calorieReminderSent) {
        state.calorieReminderSent = true;
        const Notifications = await getLocalNotifications();
        if (Notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🍌 補給提醒",
              body: "已消耗大量卡路里，建議補充能量棒或食物",
              sound: true,
              categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
              data: { type: "supply_reminder", supplyKind: "calorie" },
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        }
      }

      if (state.sweatLossMl >= state.waterThreshold && !state.waterReminderSent) {
        state.waterReminderSent = true;
        const Notifications = await getLocalNotifications();
        if (Notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "💧 補水提醒",
              body: "水分流失達到補水條件，建議立即補充水分",
              sound: true,
              categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
              data: { type: "supply_reminder", supplyKind: "water" },
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        }
      }

      const elapsedSec = Math.max(0, Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000));
      const timeIntervalSec = (state.supplyTimeIntervalMinutes ?? 0) * 60;
      if (
        state.supplyIntervalReminderEnabled &&
        state.supplyTimeIntervalEnabled &&
        timeIntervalSec > 0 &&
        elapsedSec - (state.intervalLastTimeSec ?? 0) >= timeIntervalSec &&
        !state.intervalTimeReminderSent
      ) {
        state.intervalTimeReminderSent = true;
        const Notifications = await getLocalNotifications();
        if (Notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "補給提醒",
              body: `已騎乘 ${state.supplyTimeIntervalMinutes} 分鐘，建議補充能量與水分`,
              sound: true,
              categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
              data: { type: "supply_reminder", supplyKind: "interval-time" },
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        }
      }

      const distanceKm = state.totalDistanceM / 1000;
      if (
        state.supplyIntervalReminderEnabled &&
        state.supplyDistanceIntervalEnabled &&
        state.supplyDistanceIntervalKm > 0 &&
        distanceKm - (state.intervalLastDistanceKm ?? 0) >= state.supplyDistanceIntervalKm &&
        !state.intervalDistanceReminderSent
      ) {
        state.intervalDistanceReminderSent = true;
        const Notifications = await getLocalNotifications();
        if (Notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "補給提醒",
              body: `已累積騎乘 ${state.supplyDistanceIntervalKm} km，建議補充能量與水分`,
              sound: true,
              categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
              data: { type: "supply_reminder", supplyKind: "interval-distance" },
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        }
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
  supplyIntervalReminderEnabled: boolean;
  supplyTimeIntervalEnabled: boolean;
  supplyTimeIntervalMinutes: number;
  supplyDistanceIntervalEnabled: boolean;
  supplyDistanceIntervalKm: number;
}) {
  const startedAt = Date.now();
  const state: BackgroundState = {
    totalDistanceM: 0,
    calories: 0,
    sweatLossMl: 0,
    lastLat: params.currentLat,
    lastLon: params.currentLon,
    lastTimestamp: startedAt,
    isRiding: true,
    calorieThreshold: params.calorieThreshold,
    waterThreshold: params.waterThreshold,
    calorieReminderSent: false,
    waterReminderSent: false,
    rideStartedAt: startedAt,
    supplyIntervalReminderEnabled: params.supplyIntervalReminderEnabled,
    supplyTimeIntervalEnabled: params.supplyTimeIntervalEnabled,
    supplyTimeIntervalMinutes: params.supplyTimeIntervalMinutes,
    supplyDistanceIntervalEnabled: params.supplyDistanceIntervalEnabled,
    supplyDistanceIntervalKm: params.supplyDistanceIntervalKm,
    intervalLastTimeSec: 0,
    intervalLastDistanceKm: 0,
    intervalTimeReminderSent: false,
    intervalDistanceReminderSent: false,
    trackingMode: "full",
    gpsAccuracy: "standard",
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

/** 在前台確認時間／距離補給後，將背景任務的同一項計數基準同步重置。 */
export async function acknowledgeBackgroundSupplyInterval(kind: "time" | "distance") {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    if (kind === "time") {
      state.intervalLastTimeSec = Math.max(0, Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000));
      state.intervalTimeReminderSent = false;
    } else {
      state.intervalLastDistanceKm = state.totalDistanceM / 1000;
      state.intervalDistanceReminderSent = false;
    }
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  } catch {}
}

/** 在前台或通知按鈕確認卡路里／水分補給後，同步重置背景任務的對應計數。 */
export async function acknowledgeBackgroundSupplyReminder(kind: "calorie" | "water") {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    if (kind === "calorie") {
      state.calories = 0;
      state.calorieReminderSent = false;
    } else {
      state.sweatLossMl = 0;
      state.waterReminderSent = false;
    }
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
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

export type GpsAccuracyLevel = "power_saving" | "standard" | "high_accuracy";
export type BackgroundTrackingMode = "full" | "idle_monitor";

const ACCURACY_CONFIG: Record<GpsAccuracyLevel, { accuracy: Location.Accuracy; timeInterval: number; distanceInterval: number }> = {
  power_saving: { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 30 },
  standard: { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
  high_accuracy: { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 5 },
};

const IDLE_MONITOR_CONFIG = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 60_000,
  distanceInterval: 18,
};

function locationTaskOptions(gpsAccuracy: GpsAccuracyLevel, mode: BackgroundTrackingMode) {
  const config = mode === "idle_monitor" ? IDLE_MONITOR_CONFIG : ACCURACY_CONFIG[gpsAccuracy];
  return {
    accuracy: config.accuracy,
    timeInterval: config.timeInterval,
    distanceInterval: config.distanceInterval,
    foregroundService: {
      notificationTitle: mode === "idle_monitor" ? "🚴 單車助手省電監測中" : "🚴 單車助手正在追蹤",
      notificationBody: mode === "idle_monitor" ? "靜止中；重新移動會自動恢復完整追蹤" : "GPS 追蹤中，點擊返回應用",
      notificationColor: "#00C896",
      killServiceOnDestroy: false,
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  };
}

export async function startBackgroundLocationTracking(gpsAccuracy: GpsAccuracyLevel = "standard") {
  try {
    const { accuracy: accuracyLevel, timeInterval: timeIntervalMs, distanceInterval: distanceIntervalM } = ACCURACY_CONFIG[gpsAccuracy];
    const foregroundPermission = await Location.requestForegroundPermissionsAsync();
    if (foregroundPermission.status !== "granted") {
      console.warn("[BackgroundLocation] Foreground permission denied");
      return false;
    }
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("[BackgroundLocation] Background permission denied");
      return false;
    }

    const isTracking = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (!isTracking) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: accuracyLevel,
        timeInterval: timeIntervalMs,
        distanceInterval: distanceIntervalM,
        foregroundService: {
          notificationTitle: "🚴 單車助手正在追蹤",
          notificationBody: "GPS 追蹤中，點擊返回應用",
          notificationColor: "#00C896",
          killServiceOnDestroy: false,
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

/** 在完整追蹤與靜止省電監測間更新同一背景定位任務。 */
export async function setBackgroundLocationTrackingMode(
  gpsAccuracy: GpsAccuracyLevel = "standard",
  mode: BackgroundTrackingMode = "full",
) {
  try {
    const foregroundPermission = await Location.requestForegroundPermissionsAsync();
    if (foregroundPermission.status !== "granted") return false;
    const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
    if (backgroundPermission.status !== "granted") return false;

    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (stateStr) {
      const state: BackgroundState = JSON.parse(stateStr);
      state.isRiding = true;
      state.trackingMode = mode;
      state.gpsAccuracy = gpsAccuracy;
      await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    await Location.startLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
      locationTaskOptions(gpsAccuracy, mode),
    );
    return true;
  } catch (e) {
    console.warn("[BackgroundLocation] Idle monitor start failed:", e);
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

/**
 * 清除背景軌跡數據（騎乘結束時調用）
 */
export async function clearBackgroundData() {
  try {
    await AsyncStorage.multiRemove([BG_TRACK_KEY, BG_STATE_KEY]);
    console.log("[BackgroundLocation] 已清除背景軌跡數據");
  } catch (e) {
    console.warn("[BackgroundLocation] 清除背景數據失敗:", e);
  }
}
