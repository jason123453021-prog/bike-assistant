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
import {
  SUPPLY_NOTIFICATION_CATEGORY,
  type SupplyNotificationKind,
} from "@/lib/supply-notification-actions";
import { createLocalizedSupplyNotificationContent } from "@/lib/supply-notification-localization";
import type { SupportedLocale } from "@/lib/i18n/types";
import {
  addTrackPoint,
  createNewRideSession,
  initializeRideSession,
  saveRideSessionSnapshot,
} from "@/lib/ride-recovery/ride-session-recovery";
import {
  calcAirDensity,
  calcGrade,
  calculatePower,
  DEFAULT_ROAD_BIKE_MASS_KG,
} from "@/lib/power-calc";
import { calculatePersonalizedCalories } from "@/lib/personalized-ride-calculations";
import { calculateSweatLoss } from "@/lib/hydration-calc";
import { getHeadwindMs } from "@/lib/weather-service";
import { createSupplyPlan, type SupplyPlan } from "@/lib/smart-supply-plan";
import {
  evaluateTrackPoint,
  type TrackQualityPoint,
} from "@/lib/track-point-quality";
import type { SupplyIntervalKind } from "@/lib/supply-interval";
import { estimateSportCalories, type SportType } from "@/lib/sport-metrics";
import {
  acceptLiveElevationDelta,
  clampVirtualPowerForRider,
  isTrustworthyVirtualPowerPeak,
} from "@/lib/live-elevation-filter";
import { resolveStatisticsIntervalSec } from "@/lib/activity-statistics";
import {
  isSmartSupplyChannelEnabled,
  resolveSmartSupplyChannels,
} from "@/lib/smart-supply-channels";
import { hasReliableRideMovement } from "@/lib/live-ride-readings";
import { reportRecoverableIssue } from "@/lib/release-safe-log";
import {
  advanceAutoLapMilestones,
  createAutoLapAnchor,
  type AutoLapAnchor,
  type AutoLapTotals,
} from "@/lib/auto-lap-milestones";
import { advanceBackgroundAutoPause } from "@/lib/background-auto-pause";
import type { RideLap } from "@/lib/ride-context";
import {
  getSupplyReminderMutationVersion,
  preserveLatestSupplyReminderMutation,
} from "@/lib/background-supply-state-guard";

export const BACKGROUND_LOCATION_TASK = "BIKE_BACKGROUND_LOCATION";
const BG_TRACK_KEY = "@bike_bg_track_points";
const BG_STATE_KEY = "@bike_bg_state";
const BG_TRACK_FLUSH_INTERVAL_MS = 5_000;
const BG_TRACK_MAX_POINTS = 10_000;

let backgroundSupplyStateMutationQueue: Promise<void> = Promise.resolve();

type BackgroundTrackPoint = {
  lat: number;
  lon: number;
  ts: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  segmentStart?: boolean;
  distanceM?: number;
  ascentM?: number;
  descentM?: number;
  acceptedElevationM?: number;
  powerW?: number;
  caloriesKcal?: number;
  intervalSec?: number;
  /** 此樣本跨過距離里程碑，前景回補時建立相同的自動 Lap。 */
  autoLapCompleted?: boolean;
};

let backgroundTrackCache: BackgroundTrackPoint[] | null = null;
let lastBackgroundTrackFlushAt = 0;

/**
 * 背景任務在同一 JS 執行個體內保留軌跡快取，避免每個位置批次都讀取並重寫完整 JSON。
 * 每次背景任務仍會保存完整騎乘快照；軌跡則在五秒內合併寫入，重新啟動時會安全從本機資料重建。
 */
async function appendBackgroundTrackBatch(
  points: BackgroundTrackPoint[],
  force = false,
): Promise<void> {
  if (!points.length) return;
  if (!backgroundTrackCache) {
    try {
      const stored = await AsyncStorage.getItem(BG_TRACK_KEY);
      backgroundTrackCache = stored
        ? (JSON.parse(stored) as BackgroundTrackPoint[])
        : [];
    } catch {
      backgroundTrackCache = [];
    }
  }
  backgroundTrackCache.push(...points);
  if (backgroundTrackCache.length > BG_TRACK_MAX_POINTS) {
    backgroundTrackCache.splice(
      0,
      backgroundTrackCache.length - BG_TRACK_MAX_POINTS,
    );
  }

  const now = Date.now();
  if (!force && now - lastBackgroundTrackFlushAt < BG_TRACK_FLUSH_INTERVAL_MS)
    return;
  await AsyncStorage.setItem(
    BG_TRACK_KEY,
    JSON.stringify(backgroundTrackCache),
  );
  lastBackgroundTrackFlushAt = now;
}

export interface BackgroundState {
  totalDistanceM: number;
  /** 背景已驗證的移動時間，不把定位中斷或靜止的牆鐘時間算入活動。 */
  movingTimeSec?: number;
  totalAscentM?: number;
  totalDescentM?: number;
  minElevationM?: number;
  maxElevationM?: number;
  elevationAnchorM?: number | null;
  powerWorkJ?: number;
  powerSampleDurationSec?: number;
  maxPowerW?: number;
  calories: number;
  sweatLossMl: number;
  lastLat: number;
  lastLon: number;
  lastTimestamp: number;
  lastAccuracy?: number;
  isRiding: boolean;
  /** 由前景語言 Provider 保存，讓背景 JS 重啟後仍可建立正確語系通知。 */
  notificationLocale?: SupportedLocale;
  calorieThreshold: number;
  waterThreshold: number;
  supplyCalculationMode?: "smart" | "custom";
  smartEnergySupplyEnabled?: boolean;
  smartWaterSupplyEnabled?: boolean;
  /** 補給與補水提醒總開關；背景定位仍記錄軌跡，但不得排程提醒。 */
  supplyReminderEnabled?: boolean;
  sportType?: SportType;
  calorieReminderSent: boolean;
  waterReminderSent: boolean;
  smartCalorieCountdownStartedElapsedSec?: number;
  smartWaterCountdownStartedElapsedSec?: number;
  smartCalorieCountdownDurationSec?: number;
  smartWaterCountdownDurationSec?: number;
  /** 已鎖定的真實時間到期點；暫停騎乘碼表不會改變本輪到期時間。 */
  smartCalorieCountdownDueAtMs?: number;
  smartWaterCountdownDueAtMs?: number;
  /** 各智慧通道本輪累計的低強度／暫停時長，僅供下一輪比例權重計算。 */
  smartCalorieCountdownPausedAtMs?: number;
  smartWaterCountdownPausedAtMs?: number;
  smartCalorieCountdownPausedTotalMs?: number;
  smartWaterCountdownPausedTotalMs?: number;
  /** 背景最新可信樣本的補給重排摘要；只保存在本機，供下一輪補水建立一致計畫。 */
  smartSupplyIntensityFactor?: number;
  smartSupplySweatRatePerHour?: number;
  smartSupplyEnvironmentLoad?: number;
  smartSupplyGradePct?: number;
  /** 舊版共享欄位僅保留已存在本機資料相容；新程式不再讀寫。 */
  supplyCountdownPausedAtMs?: number;
  supplyCountdownPausedTotalMs?: number;
  rideStartedAt: number;
  /** 前景確認／倒數調整的單調版號，供背景舊快照合併時保護最新確認結果。 */
  supplyReminderMutationVersion?: number;
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
    energyServingCarbohydrateG?: number;
    energyCarbohydrateHourlyLimitMode?: "science" | "manual";
    energyCarbohydrateHourlyLimitG?: number;
  };
  environment?: {
    temperatureC: number;
    humidityPct: number;
    windSpeedKmh: number;
    windDirection: number;
    weatherCode: number;
    precipitationProb: number;
  };
  /** 背景鎖屏期間持久化的自動距離分圈狀態。 */
  autoLapEnabled?: boolean;
  autoLapDistanceKm?: number;
  nextAutoLapDistanceM?: number | null;
  autoLapAnchor?: AutoLapAnchor;
  /** 用於把 GPS 樣本插值到固定距離里程碑的上一筆累計統計。 */
  previousAutoLapTotals?: AutoLapTotals;
  laps?: RideLap[];
  /** 與前景相同的自動暫停規則，供鎖屏 TaskManager 以 GPS 批次累積。 */
  autoPauseEnabled?: boolean;
  autoPauseSpeedBelowKmh?: number;
  autoPauseStillForSeconds?: number;
  autoPauseResumeAtOrAboveKmh?: number;
  autoPauseLowSpeedSec?: number;
  backgroundAutoPaused?: boolean;
  /** 鎖屏期間由背景 GPS 狀態機判定的自動暫停累計秒數。 */
  autoPausedSec?: number;
}

async function persistBackgroundStatePreservingSupplyMutations(
  state: BackgroundState,
  batchSupplyReminderMutationVersion: number,
): Promise<void> {
  const latestStateStr = await AsyncStorage.getItem(BG_STATE_KEY);
  const latestState = latestStateStr
    ? (JSON.parse(latestStateStr) as BackgroundState)
    : null;
  const safeState = latestState
    ? preserveLatestSupplyReminderMutation(
        state,
        latestState,
        batchSupplyReminderMutationVersion,
      )
    : state;
  await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(safeState));
}

async function mutateBackgroundSupplyState(
  mutate: (state: BackgroundState) => boolean,
): Promise<void> {
  const operation = backgroundSupplyStateMutationQueue.then(async () => {
    try {
      const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
      if (!stateStr) return;
      const state = JSON.parse(stateStr) as BackgroundState;
      if (!mutate(state)) return;
      state.supplyReminderMutationVersion =
        getSupplyReminderMutationVersion(state) + 1;
      await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
    } catch {}
  });
  backgroundSupplyStateMutationQueue = operation.catch(() => undefined);
  await operation;
}

function markBackgroundSmartSupplyPaused(
  state: BackgroundState,
  nowMs: number,
): void {
  state.smartCalorieCountdownPausedAtMs ??= nowMs;
  state.smartWaterCountdownPausedAtMs ??= nowMs;
}

function settleBackgroundSmartSupplyPause(
  state: BackgroundState,
  nowMs: number,
): void {
  if (state.smartCalorieCountdownPausedAtMs !== undefined) {
    state.smartCalorieCountdownPausedTotalMs =
      (state.smartCalorieCountdownPausedTotalMs ?? 0) +
      Math.max(0, nowMs - state.smartCalorieCountdownPausedAtMs);
    state.smartCalorieCountdownPausedAtMs = undefined;
  }
  if (state.smartWaterCountdownPausedAtMs !== undefined) {
    state.smartWaterCountdownPausedTotalMs =
      (state.smartWaterCountdownPausedTotalMs ?? 0) +
      Math.max(0, nowMs - state.smartWaterCountdownPausedAtMs);
    state.smartWaterCountdownPausedAtMs = undefined;
  }
}

function consumeBackgroundSmartSupplyPauseSec(
  state: BackgroundState,
  kind: "calorie" | "water",
  nowMs: number,
): number {
  const isCalorie = kind === "calorie";
  const pausedAtMs = isCalorie
    ? state.smartCalorieCountdownPausedAtMs
    : state.smartWaterCountdownPausedAtMs;
  const pausedTotalMs =
    (isCalorie
      ? state.smartCalorieCountdownPausedTotalMs
      : state.smartWaterCountdownPausedTotalMs) ?? 0;
  const totalMs =
    pausedTotalMs +
    (pausedAtMs === undefined ? 0 : Math.max(0, nowMs - pausedAtMs));
  if (isCalorie) {
    state.smartCalorieCountdownPausedTotalMs = 0;
    state.smartCalorieCountdownPausedAtMs = state.backgroundAutoPaused
      ? nowMs
      : undefined;
  } else {
    state.smartWaterCountdownPausedTotalMs = 0;
    state.smartWaterCountdownPausedAtMs = state.backgroundAutoPaused
      ? nowMs
      : undefined;
  }
  return totalMs / 1_000;
}

// Haversine 距離計算（背景任務中不能 import 其他模組的函數）
function bgHaversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 定義背景任務（必須在模組頂層，不能在函數內）
TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error, executionInfo }) => {
    if (error) {
      reportRecoverableIssue("[BackgroundLocation] Error", error.message);
      return;
    }
    // 前景已有 watchPositionAsync 作為唯一統計來源；背景任務若同時收到相同位置，
    // 不得再累加，否則距離、移動時間與自動分圈都會被重複計算。
    if (executionInfo?.appState === "active") return;
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      if (!locations || locations.length === 0) return;

      try {
        // 讀取背景狀態
        const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
        if (!stateStr) return; // 未啟動騎乘，忽略
        const state: BackgroundState = JSON.parse(stateStr);
        if (!state.isRiding) return;
        const batchSupplyReminderMutationVersion =
          getSupplyReminderMutationVersion(state);
        const smartChannels = resolveSmartSupplyChannels(state);
        const recoverySession =
          (await initializeRideSession()) ?? createNewRideSession();

        let activeCalorieThreshold = state.calorieThreshold;
        let activeWaterThreshold = state.waterThreshold;
        let latestSupplyPlan: SupplyPlan = createSupplyPlan({
          mode: state.supplyCalculationMode ?? "custom",
          sportType: state.sportType ?? "cycling",
          calorieThresholdKcal: state.calorieThreshold,
          waterThresholdMl: state.waterThreshold,
          elapsedSec: Math.max(
            0,
            Math.floor(
              (Date.now() - (state.rideStartedAt || Date.now())) / 1000,
            ),
          ),
          riderWeightKg: state.riderProfile?.weightKg ?? 70,
          ftpW: state.riderProfile?.ftpW ?? 245,
          intensityFactor: 0.65,
          sweatRatePerHour: 650,
          environmentLoad: 0,
          weatherAvailable: Boolean(state.environment),
          temperatureC: state.environment?.temperatureC,
          humidityPct: state.environment?.humidityPct,
          weatherCode: state.environment?.weatherCode,
          gradePct: state.smartSupplyGradePct ?? 0,
          pausedDuringRoundSec: 0,
          energyServingCarbohydrateG:
            state.riderProfile?.energyServingCarbohydrateG,
          energyCarbohydrateHourlyLimitMode:
            state.riderProfile?.energyCarbohydrateHourlyLimitMode,
          energyCarbohydrateHourlyLimitG:
            state.riderProfile?.energyCarbohydrateHourlyLimitG,
        });

        const acceptedLocations: Array<{
          loc: Location.LocationObject;
          segmentStart: boolean;
          distanceM: number;
          ascentM?: number;
          descentM?: number;
          acceptedElevationM?: number;
          powerW?: number;
          caloriesKcal?: number;
          intervalSec?: number;
          isStationary?: boolean;
          autoLapCompleted?: boolean;
        }> = [];
        let qualityAnchor: TrackQualityPoint | null =
          state.lastLat !== 0 && state.lastLon !== 0
            ? {
                latitude: state.lastLat,
                longitude: state.lastLon,
                timestamp: state.lastTimestamp,
                accuracy: state.lastAccuracy,
              }
            : null;

        // 背景／鎖定螢幕會批次交付位置，必須先依時間排序並拒絕不準、倒退或不合理高速跳點。
        for (const loc of [...locations].sort(
          (left, right) => left.timestamp - right.timestamp,
        )) {
          const decision = evaluateTrackPoint(qualityAnchor, {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: loc.timestamp,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed,
          });
          if (!decision.accepted) continue;
          acceptedLocations.push({
            loc,
            segmentStart: decision.segmentStart,
            distanceM: 0,
          });
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
          const reportedSpeedMs = Number(speed);
          const speedMs = Number.isFinite(reportedSpeedMs)
            ? Math.max(0, reportedSpeedMs)
            : 0;
          const speedKmh = speedMs * 3.6;

          // 省電監測期間只低頻確認是否重新移動，不寫入騎乘軌跡與統計。
          if ((state.trackingMode ?? "full") === "idle_monitor") {
            const movementM =
              state.lastLat !== 0 && state.lastLon !== 0
                ? bgHaversine(state.lastLat, state.lastLon, latitude, longitude)
                : 0;
            state.lastLat = latitude;
            state.lastLon = longitude;
            state.lastTimestamp = timestamp;
            markBackgroundSmartSupplyPaused(state, timestamp);
            if (speedKmh >= 3 || movementM >= 18) {
              settleBackgroundSmartSupplyPause(state, timestamp);
              state.trackingMode = "full";
              const isRegistered = await TaskManager.isTaskRegisteredAsync(
                BACKGROUND_LOCATION_TASK,
              );
              if (isRegistered)
                await Location.stopLocationUpdatesAsync(
                  BACKGROUND_LOCATION_TASK,
                );
              await Location.startLocationUpdatesAsync(
                BACKGROUND_LOCATION_TASK,
                locationTaskOptions(state.gpsAccuracy ?? "standard", "full"),
              );
            }
            await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
            continue;
          }

          const candidateDistanceM =
            !segmentStart && state.lastLat !== 0 && state.lastLon !== 0
              ? bgHaversine(state.lastLat, state.lastLon, latitude, longitude)
              : 0;
          const rawStatisticsIntervalSec = !segmentStart
            ? resolveStatisticsIntervalSec(
                state.lastTimestamp || null,
                timestamp,
              )
            : 0;
          const hasReliableMovement = hasReliableRideMovement({
            speedKmh,
            distanceM: candidateDistanceM,
            accuracyM: loc.coords.accuracy,
          });

          const wasBackgroundAutoPaused = state.backgroundAutoPaused === true;
          const autoPause = advanceBackgroundAutoPause({
            paused: wasBackgroundAutoPaused,
            accumulatedLowSpeedSec: state.autoPauseLowSpeedSec ?? 0,
            hasReliableMovement,
            speedKmh,
            intervalSec: rawStatisticsIntervalSec,
            enabled: state.autoPauseEnabled !== false,
            pauseBelowKmh: state.autoPauseSpeedBelowKmh ?? 1.08,
            pauseAfterSec: state.autoPauseStillForSeconds ?? 8,
            resumeAtOrAboveKmh: state.autoPauseResumeAtOrAboveKmh ?? 1.8,
          });
          state.backgroundAutoPaused = autoPause.paused;
          state.autoPauseLowSpeedSec = autoPause.accumulatedLowSpeedSec;
          if (autoPause.paused) {
            const autoPausedIncrementSec = wasBackgroundAutoPaused
              ? rawStatisticsIntervalSec
              : Math.max(0, autoPause.pauseStartedBeforeSampleEndSec ?? 0);
            state.autoPausedSec =
              (state.autoPausedSec ?? 0) + autoPausedIncrementSec;
          }
          const statisticsIntervalSec = autoPause.movingTimeIncrementSec;
          const isReliablyMovingForSupply =
            hasReliableMovement && !autoPause.paused;

          // 低速且沒有可靠位移時，前景會在 8 秒防抖內仍由計時器保留移動時間，
          // 但不會把 GPS 漂移寫成距離、功率或熱量。背景採相同行為：只累積門檻
          // 前的時間；真正進入暫停後只記錄恢復時長，補給倒數仍依絕對時間持續。
          if (!isReliablyMovingForSupply) {
            state.lastLat = latitude;
            state.lastLon = longitude;
            state.lastTimestamp = timestamp;
            state.lastAccuracy = loc.coords.accuracy ?? undefined;
            state.lastSpeedMs = 0;
            state.movingTimeSec =
              (state.movingTimeSec ?? 0) + statisticsIntervalSec;
            if (autoPause.paused) {
              markBackgroundSmartSupplyPaused(
                state,
                timestamp -
                  Math.round(
                    (autoPause.pauseStartedBeforeSampleEndSec ?? 0) * 1_000,
                  ),
              );
            }
            acceptedLocation.intervalSec = statisticsIntervalSec;
            acceptedLocation.isStationary = true;
            continue;
          }

          // 只累計連續且 Haversine 推導速度合理的可信 GPS 樣本。
          const impliedSpeedKmh =
            statisticsIntervalSec > 0
              ? (candidateDistanceM / statisticsIntervalSec) * 3.6
              : 0;
          if (
            !segmentStart &&
            statisticsIntervalSec > 0 &&
            candidateDistanceM >= 0.5 &&
            impliedSpeedKmh <= 110
          ) {
            state.totalDistanceM += candidateDistanceM;
            acceptedLocation.distanceM = candidateDistanceM;
          }
          state.movingTimeSec =
            (state.movingTimeSec ?? 0) + statisticsIntervalSec;

          const elevationState = {
            anchorAltitudeM: segmentStart
              ? null
              : (state.elevationAnchorM ?? null),
          };
          const elevationDelta = acceptLiveElevationDelta(
            elevationState,
            loc.coords.altitude,
            acceptedLocation.distanceM,
          );
          state.elevationAnchorM = elevationState.anchorAltitudeM;
          state.totalAscentM =
            (state.totalAscentM ?? 0) + elevationDelta.ascentM;
          state.totalDescentM =
            (state.totalDescentM ?? 0) + elevationDelta.descentM;
          acceptedLocation.ascentM = elevationDelta.ascentM;
          acceptedLocation.descentM = elevationDelta.descentM;
          acceptedLocation.acceptedElevationM =
            elevationDelta.acceptedAltitudeM;
          acceptedLocation.intervalSec = statisticsIntervalSec;
          if (elevationDelta.acceptedAltitudeM !== undefined) {
            state.minElevationM =
              state.minElevationM === undefined
                ? elevationDelta.acceptedAltitudeM
                : Math.min(
                    state.minElevationM,
                    elevationDelta.acceptedAltitudeM,
                  );
            state.maxElevationM =
              state.maxElevationM === undefined
                ? elevationDelta.acceptedAltitudeM
                : Math.max(
                    state.maxElevationM,
                    elevationDelta.acceptedAltitudeM,
                  );
          }

          if (autoPause.paused) {
            markBackgroundSmartSupplyPaused(
              state,
              timestamp -
                Math.round(
                  (autoPause.pauseStartedBeforeSampleEndSec ?? 0) * 1_000,
                ),
            );
            acceptedLocation.intervalSec = 0;
          } else {
            settleBackgroundSmartSupplyPause(state, timestamp);
          }

          // 鎖屏期間沿用前景的個人 FTP、體重與最近環境摘要；沒有天氣資料時安全回退為預設環境。
          if (
            !segmentStart &&
            hasReliableMovement &&
            statisticsIntervalSec > 0
          ) {
            const profile = state.riderProfile ?? {
              weightKg: 70,
              heightCm: 175,
              ageYears: 32,
              ftpW: 245,
              bikeWeightKg: DEFAULT_ROAD_BIKE_MASS_KG,
            };
            const environment = state.environment ?? {
              temperatureC: 25,
              humidityPct: 60,
              windSpeedKmh: 0,
              windDirection: 0,
              weatherCode: 3,
              precipitationProb: 0,
            };
            const distanceM = acceptedLocation.distanceM ?? candidateDistanceM;
            const effectiveSpeedMs =
              acceptedLocation.distanceM > 0
                ? acceptedLocation.distanceM / statisticsIntervalSec
                : speedMs;
            const effectiveSpeedKmh = effectiveSpeedMs * 3.6;
            const gradePct = calcGrade(
              (loc.coords.altitude ?? 0) -
                (state.lastAltitude ?? loc.coords.altitude ?? 0),
              distanceM,
            );
            const heading = loc.coords.heading ?? 0;
            const headwindMs = getHeadwindMs(
              heading,
              environment.windDirection,
              environment.windSpeedKmh,
            );
            const sportType = state.sportType ?? "cycling";
            const power =
              sportType === "cycling"
                ? clampVirtualPowerForRider(
                    calculatePower({
                      speedMs: effectiveSpeedMs,
                      prevSpeedMs: state.lastSpeedMs,
                      intervalSec: statisticsIntervalSec,
                      gradePct,
                      windSpeedMs: headwindMs,
                      riderMassKg: profile.weightKg,
                      bikeMassKg: profile.bikeWeightKg,
                      airDensityKgM3: calcAirDensity(
                        environment.temperatureC,
                        environment.humidityPct,
                      ),
                    }),
                    profile.ftpW,
                  )
                : 0;
            const calorieResult =
              sportType === "cycling"
                ? calculatePersonalizedCalories({
                    powerW: power,
                    hasMeasuredPower: power > 0,
                    speedKmh: effectiveSpeedKmh,
                    gradePct,
                    riderWeightKg: profile.weightKg,
                    ftpW: profile.ftpW,
                    intervalSec: statisticsIntervalSec,
                    temperatureC: environment.temperatureC,
                    humidityPct: environment.humidityPct,
                    weatherCode: environment.weatherCode,
                    precipitationProb: environment.precipitationProb,
                    headwindMs,
                  })
                : {
                    kcal: estimateSportCalories({
                      sportType,
                      weightKg: profile.weightKg,
                      durationSec: statisticsIntervalSec,
                      speedKmh: effectiveSpeedKmh,
                      gradePct,
                      vamMPerHour:
                        (elevationDelta.ascentM /
                          Math.max(1, statisticsIntervalSec)) *
                        3_600,
                    }),
                    intensityFactor: 0,
                    environmentFactor: 1,
                  };
            const hydrationResult = calculateSweatLoss({
              weightKg: profile.weightKg,
              heightCm: profile.heightCm,
              ageYears: profile.ageYears,
              ftpW: profile.ftpW,
              powerW: power,
              speedKmh: effectiveSpeedKmh,
              ascentPerInterval: elevationDelta.ascentM,
              intervalSec: statisticsIntervalSec,
              temperatureC: environment.temperatureC,
              humidityPct: environment.humidityPct,
              weatherCode: environment.weatherCode,
              headwindMs,
              precipitationProb: environment.precipitationProb,
              calibrationMultiplier: profile.sweatRateCalibrationMultiplier,
              environmentSource: state.environment
                ? "live-weather"
                : "offline-baseline",
            });
            state.calories += calorieResult.kcal;
            state.powerWorkJ =
              (state.powerWorkJ ?? 0) + power * statisticsIntervalSec;
            state.powerSampleDurationSec =
              (state.powerSampleDurationSec ?? 0) + statisticsIntervalSec;
            if (
              isTrustworthyVirtualPowerPeak(
                power,
                profile.ftpW,
                distanceM,
                statisticsIntervalSec,
              )
            ) {
              state.maxPowerW = Math.max(state.maxPowerW ?? 0, power);
            }
            acceptedLocation.powerW = power;
            acceptedLocation.caloriesKcal = calorieResult.kcal;
            state.sweatLossMl += hydrationResult.sweatLossMl;
            state.smartSupplyIntensityFactor = calorieResult.intensityFactor;
            state.smartSupplySweatRatePerHour =
              hydrationResult.sweatRatePerHour;
            state.smartSupplyEnvironmentLoad = hydrationResult.environmentLoad;
            state.smartSupplyGradePct = gradePct;
            latestSupplyPlan = createSupplyPlan({
              mode: state.supplyCalculationMode ?? "custom",
              sportType,
              calorieThresholdKcal: state.calorieThreshold,
              waterThresholdMl: state.waterThreshold,
              elapsedSec: Math.max(
                0,
                Math.floor(
                  (timestamp - (state.rideStartedAt || timestamp)) / 1000,
                ),
              ),
              riderWeightKg: profile.weightKg,
              ftpW: profile.ftpW,
              intensityFactor: calorieResult.intensityFactor,
              sweatRatePerHour: hydrationResult.sweatRatePerHour,
              environmentLoad: hydrationResult.environmentLoad,
              weatherAvailable: Boolean(state.environment),
              temperatureC: state.environment?.temperatureC,
              humidityPct: state.environment?.humidityPct,
              weatherCode: state.environment?.weatherCode,
              gradePct,
              pausedDuringRoundSec: 0,
              isFirstWaterCountdown: false,
              energyServingCarbohydrateG: profile.energyServingCarbohydrateG,
              energyCarbohydrateHourlyLimitMode:
                profile.energyCarbohydrateHourlyLimitMode,
              energyCarbohydrateHourlyLimitG:
                profile.energyCarbohydrateHourlyLimitG,
            });
            activeCalorieThreshold = latestSupplyPlan.calorieTriggerKcal;
            activeWaterThreshold = latestSupplyPlan.waterTriggerMl;
          }

          state.lastLat = latitude;
          state.lastLon = longitude;
          state.lastTimestamp = timestamp;
          state.lastAccuracy = loc.coords.accuracy ?? undefined;
          state.lastSpeedMs =
            speedMs > 0
              ? speedMs
              : candidateDistanceM / Math.max(1, statisticsIntervalSec);
          state.lastAltitude = loc.coords.altitude;

          const autoLapResult = advanceAutoLapMilestones(
            {
              elapsedSec: state.movingTimeSec ?? 0,
              distanceM: state.totalDistanceM,
              ascentM: state.totalAscentM ?? 0,
              descentM: state.totalDescentM ?? 0,
              powerWorkJ: state.powerWorkJ ?? 0,
              powerSampleDurationSec: state.powerSampleDurationSec ?? 0,
            },
            {
              enabled: state.autoLapEnabled === true,
              intervalM: Math.max(0, state.autoLapDistanceKm ?? 0) * 1_000,
              nextDistanceM: state.nextAutoLapDistanceM ?? null,
              laps: state.laps ?? [],
              anchor:
                state.autoLapAnchor ??
                createAutoLapAnchor({
                  elapsedSec: 0,
                  distanceM: 0,
                  ascentM: 0,
                  descentM: 0,
                  powerWorkJ: 0,
                  powerSampleDurationSec: 0,
                }),
              previousTotals: state.previousAutoLapTotals,
            },
          );
          state.laps = autoLapResult.laps;
          state.autoLapAnchor = autoLapResult.anchor;
          state.nextAutoLapDistanceM = autoLapResult.nextDistanceM;
          state.previousAutoLapTotals = autoLapResult.previousTotals;
          acceptedLocation.autoLapCompleted =
            autoLapResult.completedLaps.length > 0;

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

        const supplyNowMs = Date.now();
        const elapsedSec = Math.max(
          0,
          Math.floor(
            (supplyNowMs - (state.rideStartedAt || supplyNowMs)) / 1_000,
          ),
        );
        const supplyReminderEnabled = state.supplyReminderEnabled !== false;
        if (supplyReminderEnabled) {
          if (smartChannels.energy) {
            state.smartCalorieCountdownStartedElapsedSec ??= 0;
            state.smartCalorieCountdownDurationSec ??=
              latestSupplyPlan.energyCountdownSec;
            state.smartCalorieCountdownDueAtMs ??=
              (state.rideStartedAt || supplyNowMs) +
              ((state.smartCalorieCountdownStartedElapsedSec ?? 0) +
                state.smartCalorieCountdownDurationSec) *
                1_000;
          }
          if (smartChannels.water) {
            state.smartWaterCountdownStartedElapsedSec ??= 0;
            state.smartWaterCountdownDurationSec ??=
              latestSupplyPlan.waterCountdownSec;
            state.smartWaterCountdownDueAtMs ??=
              (state.rideStartedAt || supplyNowMs) +
              ((state.smartWaterCountdownStartedElapsedSec ?? 0) +
                state.smartWaterCountdownDurationSec) *
                1_000;
          }
        }
        const calorieDue =
          supplyReminderEnabled &&
          smartChannels.energy &&
          supplyNowMs >=
            (state.smartCalorieCountdownDueAtMs ??
              supplyNowMs + latestSupplyPlan.energyCountdownSec * 1_000);
        const waterDue =
          supplyReminderEnabled &&
          smartChannels.water &&
          supplyNowMs >=
            (state.smartWaterCountdownDueAtMs ??
              supplyNowMs + latestSupplyPlan.waterCountdownSec * 1_000);

        // 檢查補給提醒
        if (calorieDue && !state.calorieReminderSent) {
          state.calorieReminderSent = true;
          const Notifications = await getLocalNotifications();
          if (Notifications) {
            const content = createLocalizedSupplyNotificationContent(
              "calorie",
              undefined,
              state.notificationLocale,
            );
            await Notifications.scheduleNotificationAsync({
              content: {
                ...content,
                sound: true,
                categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
                channelId: "supply",
                data: { type: "supply_reminder", supplyKind: "calorie" },
                priority: Notifications.AndroidNotificationPriority.HIGH,
              } as any,
              trigger: null,
            });
          }
        }

        if (waterDue && !state.waterReminderSent) {
          state.waterReminderSent = true;
          const Notifications = await getLocalNotifications();
          if (Notifications) {
            const content = createLocalizedSupplyNotificationContent(
              "water",
              undefined,
              state.notificationLocale,
            );
            await Notifications.scheduleNotificationAsync({
              content: {
                ...content,
                sound: true,
                categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
                channelId: "supply",
                data: { type: "supply_reminder", supplyKind: "water" },
                priority: Notifications.AndroidNotificationPriority.HIGH,
              } as any,
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
        }> = [
          {
            kind: "energy-time",
            enabled:
              supplyReminderEnabled &&
              !smartChannels.energy &&
              state.supplyEnergyTimeIntervalEnabled,
            interval: state.supplyEnergyTimeIntervalMinutes * 60,
            since: state.intervalLastEnergyTimeSec,
            sent: state.intervalEnergyTimeReminderSent,
            markSent: () => {
              state.intervalEnergyTimeReminderSent = true;
            },
          },
          {
            kind: "energy-distance",
            enabled:
              supplyReminderEnabled &&
              !smartChannels.energy &&
              state.supplyEnergyDistanceIntervalEnabled,
            interval: state.supplyEnergyDistanceIntervalKm,
            since: state.intervalLastEnergyDistanceKm,
            sent: state.intervalEnergyDistanceReminderSent,
            markSent: () => {
              state.intervalEnergyDistanceReminderSent = true;
            },
          },
          {
            kind: "water-time",
            enabled:
              supplyReminderEnabled &&
              !smartChannels.water &&
              state.supplyWaterTimeIntervalEnabled,
            interval: state.supplyWaterTimeIntervalMinutes * 60,
            since: state.intervalLastWaterTimeSec,
            sent: state.intervalWaterTimeReminderSent,
            markSent: () => {
              state.intervalWaterTimeReminderSent = true;
            },
          },
          {
            kind: "water-distance",
            enabled:
              supplyReminderEnabled &&
              !smartChannels.water &&
              state.supplyWaterDistanceIntervalEnabled,
            interval: state.supplyWaterDistanceIntervalKm,
            since: state.intervalLastWaterDistanceKm,
            sent: state.intervalWaterDistanceReminderSent,
            markSent: () => {
              state.intervalWaterDistanceReminderSent = true;
            },
          },
        ];
        for (const rule of intervalRules) {
          const currentValue = rule.kind.endsWith("-time")
            ? elapsedSec
            : distanceKm;
          if (
            !rule.enabled ||
            rule.interval <= 0 ||
            rule.sent ||
            currentValue - rule.since < rule.interval
          )
            continue;
          rule.markSent();
          const Notifications = await getLocalNotifications();
          if (Notifications) {
            const content = createLocalizedSupplyNotificationContent(
              `interval-${rule.kind}` as SupplyNotificationKind,
              { intervalValue: rule.interval },
              state.notificationLocale,
            );
            await Notifications.scheduleNotificationAsync({
              content: {
                ...content,
                sound: true,
                categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
                channelId: "supply",
                data: {
                  type: "supply_reminder",
                  supplyKind: `interval-${rule.kind}`,
                },
                priority: Notifications.AndroidNotificationPriority.HIGH,
              } as any,
              trigger: null,
            });
          }
        }

        // 保存背景狀態；若批次處理期間前景已確認補給，保留最新確認／倒數結果。
        await persistBackgroundStatePreservingSupplyMutations(
          state,
          batchSupplyReminderMutationVersion,
        );

        // 以記憶體快取合併軌跡批次，避免每次背景回呼讀取和重寫全部歷史軌跡。
        await appendBackgroundTrackBatch(
          acceptedLocations
            .filter((point) => !point.isStationary)
            .map((point) => ({
              lat: point.loc.coords.latitude,
              lon: point.loc.coords.longitude,
              ts: point.loc.timestamp,
              accuracy: point.loc.coords.accuracy ?? undefined,
              altitude: point.loc.coords.altitude ?? undefined,
              speed: point.loc.coords.speed ?? undefined,
              segmentStart: point.segmentStart || undefined,
              distanceM: point.distanceM || undefined,
              ascentM: point.ascentM || undefined,
              descentM: point.descentM || undefined,
              acceptedElevationM: point.acceptedElevationM,
              powerW: point.powerW,
              caloriesKcal: point.caloriesKcal,
              intervalSec: point.intervalSec || undefined,
              autoLapCompleted: point.autoLapCompleted || undefined,
            })),
        );
      } catch (e) {
        reportRecoverableIssue("[BackgroundLocation] Processing error", e);
      }
    }
  },
);

/**
 * 啟動背景位置追蹤前，初始化背景狀態
 */
export async function initBackgroundState(params: {
  calorieThreshold: number;
  waterThreshold: number;
  supplyCalculationMode?: "smart" | "custom";
  notificationLocale?: SupportedLocale;
  smartEnergySupplyEnabled?: boolean;
  smartWaterSupplyEnabled?: boolean;
  supplyReminderEnabled?: boolean;
  sportType?: SportType;
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
  autoLapEnabled?: boolean;
  autoLapDistanceKm?: number;
  autoPauseEnabled?: boolean;
  autoPauseSpeedBelowKmh?: number;
  autoPauseStillForSeconds?: number;
  autoPauseResumeAtOrAboveKmh?: number;
}) {
  const startedAt = Date.now();
  const state: BackgroundState = {
    totalDistanceM: 0,
    movingTimeSec: 0,
    totalAscentM: 0,
    totalDescentM: 0,
    elevationAnchorM: null,
    powerWorkJ: 0,
    powerSampleDurationSec: 0,
    maxPowerW: 0,
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
    notificationLocale: params.notificationLocale,
    smartEnergySupplyEnabled:
      params.smartEnergySupplyEnabled ??
      params.supplyCalculationMode === "smart",
    smartWaterSupplyEnabled:
      params.smartWaterSupplyEnabled ??
      params.supplyCalculationMode === "smart",
    supplyReminderEnabled: params.supplyReminderEnabled !== false,
    sportType: params.sportType ?? "cycling",
    calorieReminderSent: false,
    waterReminderSent: false,
    smartCalorieCountdownStartedElapsedSec: 0,
    smartWaterCountdownStartedElapsedSec: 0,
    smartCalorieCountdownPausedTotalMs: 0,
    smartWaterCountdownPausedTotalMs: 0,
    rideStartedAt: startedAt,
    supplyEnergyTimeIntervalEnabled: params.supplyEnergyTimeIntervalEnabled,
    supplyEnergyTimeIntervalMinutes: params.supplyEnergyTimeIntervalMinutes,
    supplyEnergyDistanceIntervalEnabled:
      params.supplyEnergyDistanceIntervalEnabled,
    supplyEnergyDistanceIntervalKm: params.supplyEnergyDistanceIntervalKm,
    supplyWaterTimeIntervalEnabled: params.supplyWaterTimeIntervalEnabled,
    supplyWaterTimeIntervalMinutes: params.supplyWaterTimeIntervalMinutes,
    supplyWaterDistanceIntervalEnabled:
      params.supplyWaterDistanceIntervalEnabled,
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
    autoLapEnabled: params.autoLapEnabled === true,
    autoLapDistanceKm: params.autoLapDistanceKm,
    nextAutoLapDistanceM:
      params.autoLapEnabled && (params.autoLapDistanceKm ?? 0) > 0
        ? (params.autoLapDistanceKm ?? 0) * 1_000
        : null,
    autoLapAnchor: createAutoLapAnchor({
      elapsedSec: 0,
      distanceM: 0,
      ascentM: 0,
      descentM: 0,
      powerWorkJ: 0,
      powerSampleDurationSec: 0,
    }),
    laps: [],
    autoPauseEnabled: params.autoPauseEnabled !== false,
    autoPauseSpeedBelowKmh: params.autoPauseSpeedBelowKmh ?? 1.08,
    autoPauseStillForSeconds: params.autoPauseStillForSeconds ?? 8,
    autoPauseResumeAtOrAboveKmh: params.autoPauseResumeAtOrAboveKmh ?? 1.8,
    autoPauseLowSpeedSec: 0,
    backgroundAutoPaused: false,
    autoPausedSec: 0,
  };
  await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  // 清空舊軌跡
  await AsyncStorage.setItem(BG_TRACK_KEY, JSON.stringify([]));
}

/** 同步補給總開關至背景任務；切換時以當前騎乘基準重新開始，避免補開後立即補發舊提醒。 */
export async function setBackgroundSupplyReminderEnabled(enabled: boolean) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    const elapsedSec = Math.max(
      0,
      Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000),
    );
    const distanceKm = state.totalDistanceM / 1000;
    state.supplyReminderEnabled = enabled;
    state.calorieReminderSent = false;
    state.waterReminderSent = false;
    state.intervalEnergyTimeReminderSent = false;
    state.intervalEnergyDistanceReminderSent = false;
    state.intervalWaterTimeReminderSent = false;
    state.intervalWaterDistanceReminderSent = false;
    state.intervalLastEnergyTimeSec = elapsedSec;
    state.intervalLastWaterTimeSec = elapsedSec;
    state.intervalLastEnergyDistanceKm = distanceKm;
    state.intervalLastWaterDistanceKm = distanceKm;
    state.smartCalorieCountdownStartedElapsedSec = elapsedSec;
    state.smartWaterCountdownStartedElapsedSec = elapsedSec;
    state.smartCalorieCountdownDueAtMs =
      Date.now() + (state.smartCalorieCountdownDurationSec ?? 60 * 60) * 1_000;
    state.smartWaterCountdownDueAtMs =
      Date.now() + (state.smartWaterCountdownDurationSec ?? 30 * 60) * 1_000;
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  } catch {}
}

/** 騎乘中切換個別智慧通道時，同步背景狀態並避免啟用後立刻補發舊倒數。 */
export async function updateBackgroundSmartSupplyChannels(params: {
  energyEnabled: boolean;
  waterEnabled: boolean;
}) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    if (!state.isRiding) return;
    const elapsedSec = Math.max(
      0,
      Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000),
    );
    state.smartEnergySupplyEnabled = params.energyEnabled;
    state.smartWaterSupplyEnabled = params.waterEnabled;
    state.supplyCalculationMode =
      params.energyEnabled || params.waterEnabled ? "smart" : "custom";
    if (!params.energyEnabled) {
      state.calorieReminderSent = false;
    } else {
      state.smartCalorieCountdownStartedElapsedSec = elapsedSec;
      state.smartCalorieCountdownDueAtMs =
        Date.now() +
        (state.smartCalorieCountdownDurationSec ?? 60 * 60) * 1_000;
      state.calorieReminderSent = false;
    }
    if (!params.waterEnabled) {
      state.waterReminderSent = false;
    } else {
      state.smartWaterCountdownStartedElapsedSec = elapsedSec;
      state.smartWaterCountdownDueAtMs =
        Date.now() + (state.smartWaterCountdownDurationSec ?? 30 * 60) * 1_000;
      state.waterReminderSent = false;
    }
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  } catch {}
}

/** 騎乘中更新自動距離記圈設定；只影響尚未建立的圈，不覆寫已封存分段。 */
export async function updateBackgroundAutoLapSettings(params: {
  enabled: boolean;
  distanceKm: number;
}) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    if (!state.isRiding) return;
    const intervalM = Math.max(0, params.distanceKm) * 1_000;
    state.autoLapEnabled = params.enabled;
    state.autoLapDistanceKm = params.distanceKm;
    state.nextAutoLapDistanceM =
      params.enabled && intervalM > 0
        ? (Math.floor(state.totalDistanceM / intervalM) + 1) * intervalM
        : null;
    state.autoLapAnchor ??= createAutoLapAnchor({
      elapsedSec: 0,
      distanceM: 0,
      ascentM: 0,
      descentM: 0,
      powerWorkJ: 0,
      powerSampleDurationSec: 0,
    });
    state.laps ??= [];
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * App 退到背景前，把前景已驗證的累計統計與固定里程分圈檢查點交接給背景任務。
 * 後續鎖屏更新由相同累計基準續算，不會重新從零分圈或和前景雙重累加。
 */
export async function syncBackgroundRideCheckpoint(params: {
  totalDistanceM: number;
  movingTimeSec: number;
  totalAscentM: number;
  totalDescentM: number;
  powerWorkJ: number;
  powerSampleDurationSec: number;
  maxPowerW: number;
  calories: number;
  sweatLossMl: number;
  autoPausedSec?: number;
  autoLapAnchor?: AutoLapAnchor;
  previousAutoLapTotals?: AutoLapTotals;
  nextAutoLapDistanceM?: number | null;
  laps?: RideLap[];
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy?: number | null;
    altitude?: number | null;
    speed?: number | null;
  } | null;
}) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    if (!state.isRiding) return;
    const startedAtSupplyReminderMutationVersion =
      getSupplyReminderMutationVersion(state);
    state.totalDistanceM = Math.max(0, params.totalDistanceM);
    state.movingTimeSec = Math.max(0, params.movingTimeSec);
    state.totalAscentM = Math.max(0, params.totalAscentM);
    state.totalDescentM = Math.max(0, params.totalDescentM);
    state.powerWorkJ = Math.max(0, params.powerWorkJ);
    state.powerSampleDurationSec = Math.max(0, params.powerSampleDurationSec);
    state.maxPowerW = Math.max(0, params.maxPowerW);
    state.calories = Math.max(0, params.calories);
    state.sweatLossMl = Math.max(0, params.sweatLossMl);
    state.autoPausedSec = Math.max(
      state.autoPausedSec ?? 0,
      Math.max(0, params.autoPausedSec ?? 0),
    );
    if (params.autoLapAnchor) state.autoLapAnchor = params.autoLapAnchor;
    if (params.previousAutoLapTotals)
      state.previousAutoLapTotals = params.previousAutoLapTotals;
    if (params.nextAutoLapDistanceM !== undefined)
      state.nextAutoLapDistanceM = params.nextAutoLapDistanceM;
    if (params.laps) state.laps = params.laps;
    if (params.lastLocation) {
      state.lastLat = params.lastLocation.latitude;
      state.lastLon = params.lastLocation.longitude;
      state.lastTimestamp = params.lastLocation.timestamp;
      state.lastAccuracy = params.lastLocation.accuracy ?? undefined;
      state.lastAltitude = params.lastLocation.altitude ?? undefined;
      state.lastSpeedMs = params.lastLocation.speed ?? undefined;
    }
    await persistBackgroundStatePreservingSupplyMutations(
      state,
      startedAtSupplyReminderMutationVersion,
    );
  } catch {}
}

/** 騎乘中調整個人能量設定時，同步背景倒數模型；既有倒數維持至下一次確認才重算。 */
export async function updateBackgroundRiderProfile(
  profile: NonNullable<BackgroundState["riderProfile"]>,
) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    if (!state.isRiding) return;
    state.riderProfile = { ...state.riderProfile, ...profile };
    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
  } catch {}
}

/** 前景取得新天氣時，更新背景任務的本機環境摘要；不需在背景額外發起網路請求。 */
export async function updateBackgroundEnvironment(
  environment: NonNullable<BackgroundState["environment"]>,
) {
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
export async function updateBackgroundSmartSupplyCountdown(
  countdown: Pick<
    BackgroundState,
    | "smartCalorieCountdownStartedElapsedSec"
    | "smartWaterCountdownStartedElapsedSec"
    | "smartCalorieCountdownDurationSec"
    | "smartWaterCountdownDurationSec"
    | "smartCalorieCountdownDueAtMs"
    | "smartWaterCountdownDueAtMs"
    | "smartCalorieCountdownPausedAtMs"
    | "smartWaterCountdownPausedAtMs"
    | "smartCalorieCountdownPausedTotalMs"
    | "smartWaterCountdownPausedTotalMs"
  >,
) {
  await mutateBackgroundSupplyState((state) => {
    const channels = resolveSmartSupplyChannels(state);
    if (!state.isRiding || (!channels.energy && !channels.water)) return false;
    Object.assign(state, countdown);
    return true;
  });
}

/** 前景切換語言時保存目前 locale，並保留所有倒數與待確認狀態。 */
export async function updateBackgroundNotificationLocale(
  notificationLocale: SupportedLocale,
) {
  await mutateBackgroundSupplyState((state) => {
    if (!state.isRiding) return false;
    state.notificationLocale = notificationLocale;
    return true;
  });
}

/** 前景到期或背景任務到期時，持久化待確認狀態供回到前景立即恢復彈窗。 */
export async function setBackgroundSupplyReminderPending(
  kind: "calorie" | "water",
  pending: boolean,
) {
  await mutateBackgroundSupplyState((state) => {
    if (!state.isRiding) return false;
    if (kind === "calorie") state.calorieReminderSent = pending;
    else state.waterReminderSent = pending;
    return true;
  });
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
export async function acknowledgeBackgroundSupplyInterval(
  kind: SupplyIntervalKind,
) {
  try {
    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (!stateStr) return;
    const state: BackgroundState = JSON.parse(stateStr);
    const elapsedSec = Math.max(
      0,
      Math.floor((Date.now() - (state.rideStartedAt || Date.now())) / 1000),
    );
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
export async function acknowledgeBackgroundSupplyReminder(
  kind: "calorie" | "water",
  options?: { preserveForegroundCountdown?: boolean },
) {
  await mutateBackgroundSupplyState((state) => {
    const nowMs = Date.now();
    if (options?.preserveForegroundCountdown) {
      if (kind === "calorie") state.calorieReminderSent = false;
      else state.waterReminderSent = false;
      return true;
    }
    if (kind === "calorie") {
      if (isSmartSupplyChannelEnabled(state, "calorie")) {
        state.smartCalorieCountdownStartedElapsedSec = Math.max(
          0,
          Math.floor((nowMs - (state.rideStartedAt || nowMs)) / 1000),
        );
        consumeBackgroundSmartSupplyPauseSec(state, "calorie", nowMs);
        // v2：能量下一輪沿用既有計畫，不把暫停時間補償到倒數。
        state.smartCalorieCountdownDurationSec = Math.max(
          1,
          state.smartCalorieCountdownDurationSec ?? 60 * 60,
        );
        state.smartCalorieCountdownDueAtMs =
          nowMs + state.smartCalorieCountdownDurationSec * 1_000;
      } else {
        state.calories = 0;
      }
      state.calorieReminderSent = false;
    } else {
      if (isSmartSupplyChannelEnabled(state, "water")) {
        state.smartWaterCountdownStartedElapsedSec = Math.max(
          0,
          Math.floor((nowMs - (state.rideStartedAt || nowMs)) / 1000),
        );
        const pausedDuringRoundSec = consumeBackgroundSmartSupplyPauseSec(
          state,
          "water",
          nowMs,
        );
        const profile = state.riderProfile ?? {
          weightKg: 70,
          ftpW: 245,
          energyServingCarbohydrateG: undefined,
          energyCarbohydrateHourlyLimitMode: undefined,
          energyCarbohydrateHourlyLimitG: undefined,
        };
        const environment = state.environment;
        const nextPlan = createSupplyPlan({
          mode: state.supplyCalculationMode ?? "custom",
          sportType: state.sportType ?? "cycling",
          calorieThresholdKcal: state.calorieThreshold,
          waterThresholdMl: state.waterThreshold,
          elapsedSec: state.smartWaterCountdownStartedElapsedSec,
          riderWeightKg: profile.weightKg,
          ftpW: profile.ftpW,
          intensityFactor: state.smartSupplyIntensityFactor ?? 0.65,
          sweatRatePerHour: state.smartSupplySweatRatePerHour ?? 650,
          environmentLoad: state.smartSupplyEnvironmentLoad ?? 0,
          weatherAvailable: Boolean(environment),
          temperatureC: environment?.temperatureC,
          humidityPct: environment?.humidityPct,
          weatherCode: environment?.weatherCode,
          gradePct: state.smartSupplyGradePct ?? 0,
          pausedDuringRoundSec,
          energyServingCarbohydrateG: profile.energyServingCarbohydrateG,
          energyCarbohydrateHourlyLimitMode:
            profile.energyCarbohydrateHourlyLimitMode,
          energyCarbohydrateHourlyLimitG:
            profile.energyCarbohydrateHourlyLimitG,
        });
        state.smartWaterCountdownDurationSec = Math.max(
          1,
          nextPlan.waterCountdownSec,
        );
        state.smartWaterCountdownDueAtMs =
          nowMs + state.smartWaterCountdownDurationSec * 1_000;
      } else {
        state.sweatLossMl = 0;
      }
      state.waterReminderSent = false;
    }
    return true;
  });
}

/**
 * 獲取背景追蹤的軌跡點（前台恢復時使用）
 */
export async function getBackgroundTrackPoints(): Promise<
  BackgroundTrackPoint[]
> {
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

const ACCURACY_CONFIG: Record<
  GpsAccuracyLevel,
  {
    accuracy: Location.Accuracy;
    timeInterval: number;
    distanceInterval: number;
  }
> = {
  power_saving: {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000,
    distanceInterval: 30,
  },
  standard: {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
  },
  high_accuracy: {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 3000,
    distanceInterval: 5,
  },
};

const IDLE_MONITOR_CONFIG = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 60_000,
  distanceInterval: 18,
};

function locationTaskOptions(
  gpsAccuracy: GpsAccuracyLevel,
  mode: BackgroundTrackingMode,
) {
  const config =
    mode === "idle_monitor"
      ? IDLE_MONITOR_CONFIG
      : ACCURACY_CONFIG[gpsAccuracy];
  return {
    accuracy: config.accuracy,
    timeInterval: config.timeInterval,
    distanceInterval: config.distanceInterval,
    foregroundService: {
      notificationTitle:
        mode === "idle_monitor"
          ? "🚴 單車助手省電監測中"
          : "🚴 單車助手正在追蹤",
      notificationBody:
        mode === "idle_monitor"
          ? "靜止中；重新移動會自動恢復完整追蹤"
          : "GPS 追蹤中，點擊返回應用",
      notificationColor: "#00C896",
      killServiceOnDestroy: false,
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  };
}

export async function startBackgroundLocationTracking(
  gpsAccuracy: GpsAccuracyLevel = "standard",
) {
  try {
    const {
      accuracy: accuracyLevel,
      timeInterval: timeIntervalMs,
      distanceInterval: distanceIntervalM,
    } = ACCURACY_CONFIG[gpsAccuracy];
    const foregroundPermission =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundPermission.status !== "granted") {
      return false;
    }
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") {
      return false;
    }

    const isTracking = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
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
    reportRecoverableIssue("[BackgroundLocation] Start failed", e);
    return false;
  }
}

/** 在完整追蹤與靜止省電監測間更新同一背景定位任務。 */
export async function setBackgroundLocationTrackingMode(
  gpsAccuracy: GpsAccuracyLevel = "standard",
  mode: BackgroundTrackingMode = "full",
) {
  try {
    const foregroundPermission =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundPermission.status !== "granted") return false;
    const backgroundPermission =
      await Location.requestBackgroundPermissionsAsync();
    if (backgroundPermission.status !== "granted") return false;

    const stateStr = await AsyncStorage.getItem(BG_STATE_KEY);
    if (stateStr) {
      const state: BackgroundState = JSON.parse(stateStr);
      state.isRiding = true;
      state.trackingMode = mode;
      state.gpsAccuracy = gpsAccuracy;
      await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isRegistered)
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    await Location.startLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
      locationTaskOptions(gpsAccuracy, mode),
    );
    return true;
  } catch (e) {
    reportRecoverableIssue("[BackgroundLocation] Idle monitor start failed", e);
    return false;
  }
}

export async function stopBackgroundLocationTracking() {
  try {
    await stopBackgroundState();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (e) {
    reportRecoverableIssue("[BackgroundLocation] Stop failed", e);
  }
}

/**
 * 清除背景軌跡數據（騎乘結束時調用）
 */
export async function clearBackgroundData() {
  try {
    await AsyncStorage.multiRemove([BG_TRACK_KEY, BG_STATE_KEY]);
  } catch (e) {
    reportRecoverableIssue("[BackgroundLocation] 清除背景數據失敗", e);
  }
}
