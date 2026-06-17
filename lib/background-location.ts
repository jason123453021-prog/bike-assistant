/**
 * 背景 GPS 追蹤 — 使用 expo-task-manager + expo-location
 * 必須在模組頂層定義 TaskManager 任務
 */

import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";

export const BACKGROUND_LOCATION_TASK = "BIKE_BACKGROUND_LOCATION";

// 定義背景任務（必須在模組頂層，不能在函數內）
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[BackgroundLocation] Error:", error.message);
    return;
  }
  if (data) {
    // 背景位置更新 — 儲存到 AsyncStorage 供前台讀取
    // 實際的功率計算和 UI 更新在前台進行
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      // 可以在這裡儲存位置點到 AsyncStorage
      // 前台 watchPositionAsync 已處理主要邏輯
    }
  }
});

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
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (e) {
    console.warn("[BackgroundLocation] Stop failed:", e);
  }
}
