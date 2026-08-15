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
import { calcAirDensity, calcGrade, calculatePower } from "@/lib/power-calc";
import {
  calculatePersonalizedCalories,
} from "@/lib/personalized-ride-calculations";
import { calculateSweatLoss } from "@/lib/hydration-calc";
import { getHeadwindMs } from "@/lib/weather-service";
import { createSupplyPlan, type SupplyPlan } from "@/lib/smart-supply-plan";
import { evaluateTrackPoint, type TrackQualityPoint } from "@/lib/track-point-quality";
import type { SupplyIntervalKind } from "@/lib/supply-interval";

export const BACKGROUND_LOCATION_TASK = "BIKE_BACKGROUND_LOCATION";
const BG_TRACK_KEY = "@bike_bg_track_points";
const BG_STATE_KEY = "@bike_bg_state";
const BG_TRACK_FLUSH_INTERVAL_MS = 5_000;
const BG_TRACK_MAX_POINTS = 10_000;

type BackgroundTrackPoint = { lat: number; lon: number; ts: number; accuracy?: number; segmentStart?: boolean; distanceM?: number };

let backgroundTrackCache: BackgroundTrackPoint[] | null = null;
let lastBackgroundTrackFlushAt = 0;

/**
 * 背景任務在同一 JS 執行個體內保留軌跡快取，避免每個位置批次都讀取並重寫完整 JSON。
 * 每次背景任務仍會保存完整騎乘快照；軌跡則在五秒內合併寫入，重新啟動時會安全從本機資料重建。
 */
async function appendBackgroundTrackBatch(points: BackgroundTrackPoint[], force = false): Promise<void> {
  if (!points.length) return;
  if (!backgroundTrackCache) {
    try {
      const stored = await AsyncStorage.getItem(BG_TRACK_KEY);
      backgroundTrackCache = stored ? (JSON.parse(stored) as BackgroundTrackPoint[]) : [];
    } catch {
      backgroundTrackCache = [];
    }
  }
  backgroundTrackCache.push(...points);
  if (backgroundTrackCache.length > BG_TRACK_MAX_POINTS) {
    backgroundTrackCache.splice(0, backgroundTrackCache.length - BG_TRACK_MAX_POINTS);
  }

  const now = Date.now();
  if (!force && now - lastBackgroundTrackFlushAt < BG_TRACK_FLUSH_INTERVAL_MS) return;
  await AsyncStorage.setItem(BG_TRACK_KEY, JSON.stringify(backgroundTrackCache));
  lastBackgroundTrackFlushAt = now;
}

export interface BackgroundState {
  totalDistanceM: number;
  calories: number;
  sweatLossMl: number;
  lastLat: number;
  lastLon: number;
  lastTimestamp: number;
  lastAccuracy?: number;
  isRiding: boolean;
  calorieThreshold: number;
  waterThreshold: number;
  supplyCalculationMode?: "smart" | "custom";
  calorieReminderSent: boolean;
  waterReminderSent: boolean;
  smartCalorieCountdownStartedElapsedSec?: number;
  smartWaterCountdownStartedElapsedSec?: number;
  smartCalorieCountdownDurationSec?: number;
  smartWaterCountdownDurationSec?: number;
  rideStartedAt: number;
  supplyEnergyTimeIntervalEnabled: boolean;
  supplyEnergyTimeIntervalMinutes: number;
  supplyEnergyDistanceIntervalEnabled: boolean;
  supplyEnergyDistanceIntervalKm: number;
  supplyWaterTimeIntervalEnabled: boolean;
  supplyWaterTimeIntervalMinutes: number;
  supplyWaterDistanceIntervalEnabled: boolean;
  supplyWaterDistanceIntervalKm: number;
  intervalLastEnergyTimeSec: number;
  intervalLastEnergyDistanceKm: number;
  intervalLastWaterTimeSec: number;
  intervalLastWaterDistanceKm: number;
  intervalEnergyTimeReminderSent: boolean;
  intervalEnergyDistanceReminderSent: boolean;
  intervalWaterTimeReminderSent: boolean;
  intervalWaterDistanceReminderSent: boolean;
  trackingMode?: "full" | "idle_monitor";
  gpsAccuracy?: GpsAccuracyLevel;
  lastSpeedMs?: number;
  lastAltitude?: number | null;
  riderProfile?: {
    weightKg: number;
    heightCm: number;
    ageYears: number;
    ftpW: number;
    bikeWeightKg: number;
    sweatRateCalibrationMultiplier?: number;
  };
  environment?: {
    temperatureC: number;
    humidityPct: number;
    windSpeedKmh: number;
    windDirection: number;
    weatherCode: number;
    precipitationProb: number;
  };
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

      let activeCalorieThreshold = state.calorieThreshold;
      let activeWaterThreshold = state.waterThreshold;
      let latestSupplyPlan: SupplyPlan = createSupplyPlan({
        mode: state.supplyCalculationMode ?? "custom",
        calorieThresholdKcal: state.calorieThreshold,
        waterThresholdMl: state.waterThreshold,
        elapsedSec: Math.max(0, Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000)),
        riderWeightKg: state.riderProfile?.weightKg ?? 70,
        ftpW: state.riderProfile?.ftpW ?? 245,
        intensityFactor: 0.65,
        sweatRatePerHour: 650,
        environmentLoad: 0,
        weatherAvailable: Boolean(state.environment),
      });

      const acceptedLocations: Array<{ loc: Location.LocationObject; segmentStart: boolean; distanceM: number }> = [];
      let qualityAnchor: TrackQualityPoint | null = state.lastLat !== 0 && state.lastLon !== 0
        ? {
          latitude: state.lastLat,
          longitude: state.lastLon,
          timestamp: state.lastTimestamp,
          accuracy: state.lastAccuracy,
        }
        : null;

      // 背景／鎖定螢幕會批次交付位置，必須先依時間排序並拒絕不準、倒退或不合理高速跳點。
      for (const loc of [...locations].sort((left, right) => left.timestamp - right.timestamp)) {
        const decision = evaluateTrackPoint(qualityAnchor, {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
        });
        if (!decision.accepted) continue;
        acceptedLocations.push({ loc, segmentStart: decision.segmentStart, distanceM: 0 });
        qualityAnchor = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
        };
      }

      // 處理已驗證的位置更新。
      for (const acceptedLocation of acceptedLocations) {
        const { loc, segmentStart } = acceptedLocation;
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
        if (!segmentStart && state.lastLat !== 0 && state.lastLon !== 0) {
          const dist = bgHaversine(state.lastLat, state.lastLon, latitude, longitude);
          // 過濾 GPS 跳動（單次距離超過 200m 視為異常）
          if (dist < 200 && dist > 1) {
            state.totalDistanceM += dist;
            acceptedLocation.distanceM = dist;
          }
        }

        // 鎖屏期間沿用前景的個人 FTP、體重與最近環境摘要；沒有天氣資料時安全回退為預設環境。
        if (!segmentStart && speedKmh > 3) {
          const dt = state.lastTimestamp > 0 ? (timestamp - state.lastTimestamp) / 1000 : 0;
          if (dt > 0 && dt < 30) {
            const profile = state.riderProfile ?? { weightKg: 70, heightCm: 175, ageYears: 32, ftpW: 245, bikeWeightKg: 10 };
            const environment = state.environment ?? {
              temperatureC: 25,
              humidityPct: 60,
              windSpeedKmh: 0,
              windDirection: 0,
              weatherCode: 3,
              precipitationProb: 0,
            };
            const distanceM = state.lastLat !== 0 && state.lastLon !== 0
              ? bgHaversine(state.lastLat, state.lastLon, latitude, longitude)
              : 0;
            const gradePct = calcGrade((loc.coords.altitude ?? 0) - (state.lastAltitude ?? loc.coords.altitude ?? 0), distanceM);
            const heading = loc.coords.heading ?? 0;
            const headwindMs = getHeadwindMs(heading, environment.windDirection, environment.windSpeedKmh);
            const power = calculatePower({
              speedMs,
              prevSpeedMs: state.lastSpeedMs,
              intervalSec: dt,
              gradePct,
              windSpeedMs: headwindMs,
              riderMassKg: profile.weightKg,
              bikeMassKg: profile.bikeWeightKg,
              airDensityKgM3: calcAirDensity(environment.temperatureC, environment.humidityPct),
            });
            const calorieResult = calculatePersonalizedCalories({
              powerW: power,
              hasMeasuredPower: power > 0,
              speedKmh,
              gradePct,
              riderWeightKg: profile.weightKg,
              ftpW: profile.ftpW,
              intervalSec: dt,
              temperatureC: environment.temperatureC,
              humidityPct: environment.humidityPct,
              weatherCode: environment.weatherCode,
              precipitationProb: environment.precipitationProb,
              headwindMs,
            });
            const hydrationResult = calculateSweatLoss({
              weightKg: profile.weightKg,
              heightCm: profile.heightCm,
              ageYears: profile.ageYears,
              ftpW: profile.ftpW,
              powerW: power,
              speedKmh,
              ascentPerInterval: Math.max(0, (loc.coords.altitude ?? 0) - (state.lastAltitude ?? loc.coords.altitude ?? 0)),
              intervalSec: dt,
              temperatureC: environment.temperatureC,
              humidityPct: environment.humidityPct,
              weatherCode: environment.weatherCode,
              headwindMs,
              precipitationProb: environment.precipitationProb,
              calibrationMultiplier: profile.sweatRateCalibrationMultiplier,
            });
            state.calories += calorieResult.kcal;
            state.sweatLossMl += hydrationResult.sweatLossMl;
            latestSupplyPlan = createSupplyPlan({
              mode: state.supplyCalculationMode ?? "custom",
              calorieThresholdKcal: state.calorieThreshold,
              waterThresholdMl: state.waterThreshold,
              elapsedSec: Math.max(0, Math.floor((timestamp - (state.rideStartedAt || timestamp)) / 1000)),
              riderWeightKg: profile.weightKg,
              ftpW: profile.ftpW,
              intensityFactor: calorieResult.intensityFactor,
              sweatRatePerHour: hydrationResult.sweatRatePerHour,
              environmentLoad: hydrationResult.environmentLoad,
              weatherAvailable: Boolean(state.environment),
            });
            activeCalorieThreshold = latestSupplyPlan.calorieTriggerKcal;
            activeWaterThreshold = latestSupplyPlan.waterTriggerMl;
          }
        }

        state.lastLat = latitude;
        state.lastLon = longitude;
        state.lastTimestamp = timestamp;
        state.lastAccuracy = loc.coords.accuracy ?? undefined;
        state.lastSpeedMs = speedMs;
        state.lastAltitude = loc.coords.altitude;

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
            segmentStart,
          },
          recoverySession.trackPoints.at(-1),
        );
        recoverySession.stats.caloriesBurned = state.calories;
        recoverySession.stats.waterLoss = state.sweatLossMl;
      }

      // 一個背景回呼可能包含多個位置點；只需保存該批次最新完整快照即可。
      await saveRideSessionSnapshot(recoverySession);

      const elapsedSec = Math.max(0, Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000));
      if (state.supplyCalculationMode === "smart") {
        state.smartCalorieCountdownStartedElapsedSec ??= 0;
        state.smartWaterCountdownStartedElapsedSec ??= 0;
        state.smartCalorieCountdownDurationSec = latestSupplyPlan.energyCountdownSec;
        state.smartWaterCountdownDurationSec = latestSupplyPlan.waterCountdownSec;
      }
      const calorieDue = state.supplyCalculationMode === "smart"
        ? elapsedSec >= (state.smartCalorieCountdownStartedElapsedSec ?? 0) + (state.smartCalorieCountdownDurationSec ?? latestSupplyPlan.energyCountdownSec)
        : state.calories >= activeCalorieThreshold;
      const waterDue = state.supplyCalculationMode === "smart"
        ? elapsedSec >= (state.smartWaterCountdownStartedElapsedSec ?? 0) + (state.smartWaterCountdownDurationSec ?? latestSupplyPlan.waterCountdownSec)
        : state.sweatLossMl >= activeWaterThreshold;

      // 檢查補給提醒
      if (calorieDue && !state.calorieReminderSent) {
        state.calorieReminderSent = true;
        const Notifications = await getLocalNotifications();
        if (Notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🍌 補給提醒",
              body: state.supplyCalculationMode === "smart" ? "請補給能量，完成後點選已補給以開始下一輪倒數。" : `建議補充約 ${latestSupplyPlan.energyRecommendationKcal} kcal（${latestSupplyPlan.carbohydrateRecommendationG} g 碳水）；${latestSupplyPlan.reason}`,
              sound: true,
              categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
              data: { type: "supply_reminder", supplyKind: "calorie" },
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        }
      }

      if (waterDue && !state.waterReminderSent) {
        state.waterReminderSent = true;
        const Notifications = await getLocalNotifications();
        if (Notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "💧 補水提醒",
              body: state.supplyCalculationMode === "smart" ? "請補給水分，完成後點選已補給以開始下一輪倒數。" : `建議補充約 ${latestSupplyPlan.waterRecommendationMl} ml 水分；${latestSupplyPlan.reason}`,
              sound: true,
              categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
              data: { type: "supply_reminder", supplyKind: "water" },
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        }
      }

      const distanceKm = state.totalDistanceM / 1000;
      const intervalRules: Array<{
        kind: SupplyIntervalKind;
        enabled: boolean;
        interval: number;
        since: number;
        sent: boolean;
        markSent: () => void;
        title: string;
        body: string;
      }> = [
        {
          kind: "energy-time", enabled: state.supplyEnergyTimeIntervalEnabled,
          interval: state.supplyEnergyTimeIntervalMinutes * 60, since: state.intervalLastEnergyTimeSec,
          sent: state.intervalEnergyTimeReminderSent,
          markSent: () => { state.intervalEnergyTimeReminderSent = true; },
          title: "能量補給提醒", body: `已騎乘 ${state.supplyEnergyTimeIntervalMinutes} 分鐘，請補給能量`,
        },
        {
          kind: "energy-distance", enabled: state.supplyEnergyDistanceIntervalEnabled,
          interval: state.supplyEnergyDistanceIntervalKm, since: state.intervalLastEnergyDistanceKm,
          sent: state.intervalEnergyDistanceReminderSent,
          markSent: () => { state.intervalEnergyDistanceReminderSent = true; },
          title: "能量補給提醒", body: `已累積騎乘 ${state.supplyEnergyDistanceIntervalKm} km，請補給能量`,
        },
        {
          kind: "water-time", enabled: state.supplyWaterTimeIntervalEnabled,
          interval: state.supplyWaterTimeIntervalMinutes * 60, since: state.intervalLastWaterTimeSec,
          sent: state.intervalWaterTimeReminderSent,
          markSent: () => { state.intervalWaterTimeReminderSent = true; },
          title: "補水提醒", body: `已騎乘 ${state.supplyWaterTimeIntervalMinutes} 分鐘，請補給水分`,
        },
        {
          kind: "water-distance", enabled: state.supplyWaterDistanceIntervalEnabled,
          interval: state.supplyWaterDistanceIntervalKm, since: state.intervalLastWaterDistanceKm,
          sent: state.intervalWaterDistanceReminderSent,
          markSent: () => { state.intervalWaterDistanceReminderSent = true; },
          title: "補水提醒", body: `已累積騎乘 ${state.supplyWaterDistanceIntervalKm} km，請補給水分`,
        },
      ];
      for (const rule of intervalRules) {
        const currentValue = rule.kind.endsWith("-time") ? elapsedSec : distanceKm;
        if (!rule.enabled || rule.interval <= 0 || rule.sent || currentValue - rule.since < rule.interval) continue;
        rule.markSent();
        const Notifications = await getLocalNotifications();
        if (Notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: rule.title,
              body: rule.body,
              sound: true,
              categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
              data: { type: "supply_reminder", supplyKind: `interval-${rule.kind}` },
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        }
      }

      // 保存背景狀態
      await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));

      // 以記憶體快取合併軌跡批次，避免每次背景回呼讀取和重寫全部歷史軌跡。
      await appendBackgroundTrackBatch(acceptedLocations.map(({ loc, segmentStart, distanceM }) => (
        {
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          ts: loc.timestamp,
          accuracy: loc.coords.accuracy ?? undefined,
          segmentStart: segmentStart || undefined,
          distanceM: distanceM || undefined,
        }
      )));
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
  supplyCalculationMode?: "smart" | "custom";
  currentLat: number;
  currentLon: number;
  currentTimestamp?: number;
  currentAccuracy?: number | null;
  supplyEnergyTimeIntervalEnabled: boolean;
  supplyEnergyTimeIntervalMinutes: number;
  supplyEnergyDistanceIntervalEnabled: boolean;
  supplyEnergyDistanceIntervalKm: number;
  supplyWaterTimeIntervalEnabled: boolean;
  supplyWaterTimeIntervalMinutes: number;
  supplyWaterDistanceIntervalEnabled: boolean;
  supplyWaterDistanceIntervalKm: number;
  riderProfile?: BackgroundState["riderProfile"];
  environment?: BackgroundState["environment"];
}) {
  const startedAt = Date.now();
  const state: BackgroundState = {
    totalDistanceM: 0,
    calories: 0,
    sweatLossMl: 0,
    lastLat: params.currentLat,
    lastLon: params.currentLon,
    lastTimestamp: params.currentTimestamp ?? startedAt,
    lastAccuracy: params.currentAccuracy ?? undefined,
    isRiding: true,
    calorieThreshold: params.calorieThreshold,
    waterThreshold: params.waterThreshold,
    supplyCalculationMode: params.supplyCalculationMode ?? "custom",
    calorieReminderSent: false,
    waterReminderSent: false,
    smartCalorieCountdownStartedElapsedSec: 0,
    smartWaterCountdownStartedElapsedSec: 0,
    rideStartedAt: startedAt,
    supplyEnergyTimeIntervalEnabled: params.supplyEnergyTimeIntervalEnabled,
    supplyEnergyTimeIntervalMinutes: params.supplyEnergyTimeIntervalMinutes,
    supplyEnergyDistanceIntervalEnabled: params.supplyEnergyDistanceIntervalEnabled,
    supplyEnergyDistanceIntervalKm: params.supplyEnergyDistanceIntervalKm,
    supplyWaterTimeIntervalEnabled: params.supplyWaterTimeIntervalEnabled,
    supplyWaterTimeIntervalMinutes: params.supplyWaterTimeIntervalMinutes,
    supplyWaterDistanceIntervalEnabled: params.supplyWaterDistanceIntervalEnabled,
    supplyWaterDistanceIntervalKm: params.supplyWaterDistanceIntervalKm,
    intervalLastEnergyTimeSec: 0,
    intervalLastEnergyDistanceKm: 0,
    intervalLastWaterTimeSec: 0,
    intervalLastWaterDistanceKm: 0,
    intervalEnergyTimeReminderSent: false,
    intervalEnergyDistanceReminderSent: false,
    intervalWaterTimeReminderSent: false,
    intervalWaterDistanceReminderSent: false,
    trackingMode: "full",
    gpsAccuracy: "standard",
    riderProfile: params.riderProfile,
    environment: params.environment,
  };
  await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  // 清空舊軌跡
  await AsyncStorage.setItem(BG_TRACK_KEY, JSON.stringify([]));
}

/** 前景取得新天氣時，更新背景任務的本機環境摘要；不需在背景額外發起網路請求。 */
export async function updateBackgroundEnvironment(environment: NonNullable<BackgroundState["environment"]>) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    if (!state.isRiding) return;
    state.environment = environment;
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  } catch {}
}

/** 前景倒數變動時同步到背景任務，讓鎖定期間到期可持久化為待確認提醒。 */
export async function updateBackgroundSmartSupplyCountdown(countdown: Pick<
  BackgroundState,
  "smartCalorieCountdownStartedElapsedSec" | "smartWaterCountdownStartedElapsedSec" | "smartCalorieCountdownDurationSec" | "smartWaterCountdownDurationSec"
>) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    if (!state.isRiding || state.supplyCalculationMode !== "smart") return;
    Object.assign(state, countdown);
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  } catch {}
}

/** 前景到期或背景任務到期時，持久化待確認狀態供回到前景立即恢復彈窗。 */
export async function setBackgroundSupplyReminderPending(kind: "calorie" | "water", pending: boolean) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    if (!state.isRiding) return;
    if (kind === "calorie") state.calorieReminderSent = pending;
    else state.waterReminderSent = pending;
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  } catch {}
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
export async function acknowledgeBackgroundSupplyInterval(kind: SupplyIntervalKind) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    const elapsedSec = Math.max(0, Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000));
    if (kind === "energy-time") {
      state.intervalLastEnergyTimeSec = elapsedSec;
      state.intervalEnergyTimeReminderSent = false;
    } else if (kind === "energy-distance") {
      state.intervalLastEnergyDistanceKm = state.totalDistanceM / 1000;
      state.intervalEnergyDistanceReminderSent = false;
    } else if (kind === "water-time") {
      state.intervalLastWaterTimeSec = elapsedSec;
      state.intervalWaterTimeReminderSent = false;
    } else {
      state.intervalLastWaterDistanceKm = state.totalDistanceM / 1000;
      state.intervalWaterDistanceReminderSent = false;
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
      if (state.supplyCalculationMode === "smart") {
        state.smartCalorieCountdownStartedElapsedSec = Math.max(0, Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000));
      } else {
        state.calories = 0;
      }
      state.calorieReminderSent = false;
    } else {
      if (state.supplyCalculationMode === "smart") {
        state.smartWaterCountdownStartedElapsedSec = Math.max(0, Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000));
      } else {
        state.sweatLossMl = 0;
      }
      state.waterReminderSent = false;
    }
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * 獲取背景追蹤的軌跡點（前台恢復時使用）
 */
export async function getBackgroundTrackPoints(): Promise<BackgroundTrackPoint[]> {
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
