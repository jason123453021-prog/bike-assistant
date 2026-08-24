import React, { createContext, useCallback, useContext, useEffect, useReducer } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { analyzeTraining, estimateFTP } from "./tss-calc";
import { calculatePersonalBests, type PersonalBest } from "./personal-bests";
import { normalizeRideRecord, normalizeRideRecords } from "./ride-record-normalizer";
import { estimateAutomaticRpe } from "@/lib/automatic-rpe";
import { buildRideTimeTotals, calculatePausedSeconds } from "@/lib/ride-time-accounting";
import {
  calculateAutoPausedSeconds,
  mergeAutoPausedSeconds,
  type AutoPauseSource,
} from "@/lib/auto-pause-statistics";
import {
  buildActivityStatistics,
  type ActivityCaloriesSource,
  type ActivityPowerSource,
} from "@/lib/activity-statistics";
import {
  canPauseRide,
  canResetCompletedRide,
  canResumeRide,
  canStartRide,
  canStopRide,
  shouldAccumulateRideStatistics,
} from "./ride-lifecycle-guard";
import type { SportType } from "./sport-metrics";

export type { SportType } from "./sport-metrics";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RideStatus = "idle" | "active" | "paused" | "finished";
export type RideActivityType = "road" | "gravel" | "mountain" | "commute" | "indoor" | "other";
export type RidePauseSource = Exclude<AutoPauseSource, null>;

export interface RideActivityUpdate {
  name?: string;
  description?: string;
  mediaItems?: string[];
  /** null 代表清除使用者選擇的本機活動封面。 */
  coverPhotoUri?: string | null;
  activityType?: RideActivityType;
  equipment?: string;
  perceivedExertion?: number;
  perceivedExertionSource?: "app-estimate" | "manual";
  sportType?: SportType;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
  // 動態數據（回放時使用）
  power?: number;        // 瓦數 (W)
  heartRate?: number;    // 心率 (bpm)
  cadence?: number;      // 踏頻 (rpm)
  slope?: number;        // 坡度 (%)
  /** 背景定位長時間中斷後的下一個可靠點，不與前一段以直線相連。 */
  segmentStart?: boolean;
  /** 暫停中仍通過品質檢核的原始 GPS 點；GPX／FIT 匯出時不得因抽樣而遺失。 */
  recordedDuringPause?: boolean;
}

// 路線統計資料
export interface RouteStats {
  name: string;           // 路線名稱
  rideCount: number;      // 騎乘次數
  avgSpeed: number;       // 平均速度 km/h
  bestSpeed: number;      // 最佳速度 km/h
  bestTime: number;       // 最佳時間 秒
  totalDistance: number;  // 總距離 km
  totalAscent: number;    // 總爬升 m
  lastRideDate: number;   // 上次騎乘日期
}

/** 本次騎乘使用的個人設定與環境摘要；僅保存於裝置端，用於解釋歷史數據來源。 */
export interface RideCalculationProfile {
  riderWeightKg: number;
  bikeWeightKg: number;
  ftpW: number;
  autoRpeEnabled?: boolean;
  environment?: {
    sampleCount: number;
    averageTemperatureC?: number;
    averageHumidityPct?: number;
    averageWindSpeedKmh?: number;
    averageHeadwindMs?: number;
    averagePrecipitationProb?: number;
    weatherCode?: number;
    source: "live-weather" | "offline-fallback";
  };
}

/** 使用者在騎乘中確認的本機補給事件；不傳送至任何伺服器。 */
export interface SupplyConfirmation {
  type: "energy" | "water";
  timestamp: number;
  elapsedSec: number;
  recommendedEnergyKcal?: number;
  recommendedCarbohydrateG?: number;
  recommendedWaterMl?: number;
  source?: "smart" | "smart-offline-fallback" | "custom";
  reason?: string;
}

/** 自動距離門檻觸發時封存的本機分圈；舊資料可保留原有來源。 */
export interface RideLap {
  index: number;
  /** 新資料由距離里程碑建立；舊活動可保留既有來源供歷史相容。 */
  source?: "manual" | "auto";
  startedAtElapsedSec: number;
  endedAtElapsedSec: number;
  movingTimeSec: number;
  distanceM: number;
  ascentM: number;
  descentM: number;
  averageSpeedKmh?: number;
  maxSpeedKmh?: number;
  averagePowerW?: number;
  /** 僅在來源定位／感測器有真實步頻樣本時寫入；不由 App 推測。 */
  averageCadenceRpm?: number;
}

interface RideLapAnchor {
  elapsedSec: number;
  distanceM: number;
  ascentM: number;
  descentM: number;
  powerWorkJ: number;
  powerSampleDurationSec: number;
  routePointIndex: number;
}

export interface RideRecord {
  id: string;
  date: number;
  name: string;           // 自訂路線名稱（可編輯）
  /** 開始至結束的活動總經過時間（seconds = movingTime + totalPausedSec）。 */
  duration: number;
  distance: number;       // meters
  avgSpeed: number;       // km/h
  maxSpeed: number;       // km/h
  totalAscent: number;    // meters
  totalDescent?: number;  // 總下降高度 meters
  maxElevation?: number;  // 最大海拔 meters
  minElevation?: number;  // 最小海拔 meters
  averageGrade?: number;  // 平均上坡坡度 percent
  maxGrade?: number;      // 最大上坡坡度 percent
  movingTime?: number;    // 移動時間 seconds
  calories: number;
  avgPower: number;       // watts
  maxPower: number;       // watts
  /** 有效移動時間內的機械工作量（kJ）；估算功率時同樣標示為估算。 */
  totalWorkKj?: number;
  /** 功率為功率計量測、本機物理模型估算或不可用。 */
  powerSource?: ActivityPowerSource;
  /** 卡路里為功率模型、MET 模型、混合估算或不可用。 */
  caloriesSource?: ActivityCaloriesSource;
  normalizedPower?: number; // 標準化功率 watts
  intensityFactor?: number; // 強度係數 IF
  tss?: number;           // 訓練壓力分數 TSS
  powerZones: number[];   // [z1, z2, z3, z4, z5] percentage
  powerHistory: number[];  // 功率時間序列 (W)
  route: LocationPoint[];
  totalSweatMl: number;   // 總汗液流失量 ml
  refillCount: number;    // 補水次數
  totalPausedSec: number; // 總暂停時間（秒）
  /** 自動暫停的總時間（秒）；舊活動安全回退為 0，不以總暫停時間臆測來源。 */
  autoPausedSec?: number;
  avgHeartRate?: number;  // 平均心率 bpm（感測器）
  maxHeartRate?: number;  // 最高心率 bpm（感測器）
  avgCadence?: number;    // 平均踏頻 rpm（感測器）
  maxCadence?: number;    // 最高踏頻 rpm（感測器）
  gradeDistribution?: number[];  // 坡度區間距離統計 [1-5%, 6-10%, 11-15%, 16-20%, 21-25%, 26%+]
  gradeAscentDistribution?: number[];  // 坡度區間爬升統計 [1-5%, 6-10%, 11-15%, 16-20%, 21-25%, 26%+]
  /** 僅與裝置內既有騎乘紀錄比較後得到的個人最佳成績 */
  personalBests?: PersonalBest[];
  /** 儲存時計算 TSS、能量與補給所用的個人設定及環境摘要 */
  calculationProfile?: RideCalculationProfile;
  /** 本機補給確認紀錄，可解釋歷史中的智慧補給建議。 */
  supplyConfirmations?: SupplyConfirmation[];
  /** Strava 風格活動心得描述 */
  description?: string;
  /** 完全本機保存的活動分類，不用於任何社群資料交換。 */
  activityType?: RideActivityType;
  /** 多運動主類型；舊版單車紀錄安全回填為 cycling。 */
  sportType?: SportType;
  /** 使用者自行輸入的車輛或裝備備註。 */
  equipment?: string;
  /** 主觀用力程度（RPE，1–10）。 */
  perceivedExertion?: number;
  /** App 推定或使用者在活動編輯中覆寫的 RPE 來源。 */
  perceivedExertionSource?: "app-estimate" | "manual";
  /** 用戶自行新增的本機相片／影片 URI 清單 */
  mediaItems?: string[];
  /** 使用者從本機活動相片選出的主視覺，來源移除時畫面會安全回退為路線。 */
  coverPhotoUri?: string;
  /** 路段成就與瓦數統計列表 */
  segmentAchievements?: {
    id: string;
    segmentName: string;
    distance: number;       // 公里
    time: string;           // 耗時 "10:33"
    avgSpeed: number;       // km/h
    avgPower: number;       // watts 瓦數
    isPR: boolean;          // 是否為個人紀錄 PR
    date: string;
  }[];
  /** 自動距離記圈與舊活動既有分圈。 */
  laps?: RideLap[];
}

export interface RideState {
  status: RideStatus;
  startTime: number | null;
  /** 實際停止時間；完成活動後固定，避免詳情頁停留時間污染 elapsed time。 */
  endTime: number | null;
  elapsed: number;          // seconds
  distance: number;         // meters
  currentSpeed: number;     // km/h
  sportType: SportType;
  maxSpeed: number;
  avgSpeed: number;
  currentPower: number;     // watts
  avgPower: number;
  maxPower: number;
  /** 有效移動樣本的功率時間積分（J），用於時間加權平均功率與工作量。 */
  powerWorkJ: number;
  /** 已被功率樣本覆蓋的有效移動秒數。 */
  powerSampleDurationSec: number;
  powerSource: ActivityPowerSource;
  caloriesSource: ActivityCaloriesSource;
  totalAscent: number;
  totalDescent: number;
  currentAltitude: number;  // 目前海拔 m
  minElevation: number | null;
  maxElevation: number | null;
  calories: number;         // 自上次補給後累計（觸發補給提醒用）
  totalCalories: number;     // 全程總卡路里（不被補給重置）
  calorieProgress: number;  // 0-1

  // ─── 水分流失追蹤 ─────────────────────────────────────────────────────────
  /** 累計汗液流失量 ml（自上次補水後重置） */
  sweatSinceLastRefill: number;
  /** 騎乘全程累計汗液流失量 ml */
  totalSweatMl: number;
  /** 當前每小時汗液流失率 ml/h */
  currentSweatRatePerHour: number;
  /** 當前強度標籤 */
  intensityLabel: string;
  /** 補水次數 */
  refillCount: number;
  /** 補水閾值 ml（動態，由設定決定） */
  hydrationThresholdMl: number;

  route: LocationPoint[];
  powerHistory: number[];
  powerZones: number[];     // [z1, z2, z3, z4, z5] count
  records: RideRecord[];
  /** 總暫停時間（秒） */
  totalPausedSec: number;
  /** 本次活動由 GPS／動作判定自動暫停的累計時間（秒）。 */
  autoPausedSec: number;
  /** 暫停開始時間戳（ms），用於計算本次暫停時間 */
  pauseStartTime: number | null;
  /** 本次暫停開始前已累積的暫停秒數，避免前景計時與恢復時計算重複相加。 */
  pauseStartPausedSec: number | null;
  /** 目前暫停來源；只有 automatic 才計入 autoPausedSec。 */
  pauseSource: RidePauseSource | null;
  autoPauseStartTime: number | null;
  autoPauseStartPausedSec: number | null;

  // 坡度區間統計
  /** 坡度區間距離統計 [1-5%, 6-10%, 11-15%, 16-20%, 21-25%, 26%+] */
  gradeDistribution: number[];
  /** 坡度區間爬升統計 [1-5%, 6-10%, 11-15%, 16-20%, 21-25%, 26%+] */
  gradeAscentDistribution: number[];

  // 自訂補給品計數
  /** 自訂補給品計數 Map: supplyItemId -> { count: 次數, lastTriggeredTime: 上次觸發時間戳 } */
  customSupplyItemCounts: Record<string, { count: number; lastTriggeredTime: number }>;
  supplyConfirmations: SupplyConfirmation[];
  laps: RideLap[];
  lapAnchor: RideLapAnchor;
}

type RideAction =
  | { type: "START"; hydrationThresholdMl: number }
  | { type: "PAUSE"; source?: RidePauseSource }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "RESET" }
  | { type: "TICK"; elapsed: number }
  | { type: "PAUSE_TICK" }
  /** 停止或室內定位漂移時只重設畫面上的即時讀數，不寫入軌跡或統計。 */
  | { type: "LIVE_READINGS_STATIONARY" }
  | {
      type: "LOCATION_UPDATE";
      point: LocationPoint;
      power: number;
      calories: number;
      ascent: number;
      descent?: number;
      acceptedElevationM?: number;
      distanceM?: number;
      intervalSec?: number;
      /** 已通過可信 GPS 位移／速度品質閘門，才計入移動時間及衍生統計。 */
      countMovingTime?: boolean;
      /** 舊背景回補樣本的相容預設；若未明示 countMovingTime，仍採其已判定區間。 */
      isBackgroundRecovery?: boolean;
      powerSource?: ActivityPowerSource;
      caloriesSource?: ActivityCaloriesSource;
      /** 經虛擬功率峰值品質閘門後才可寫入活動最大功率。 */
      maxPowerCandidate?: number;
    }
  | { type: "SWEAT_UPDATE"; sweatLossMl: number; sweatRatePerHour: number; intensityLabel: string }
  | { type: "CONSUME_CALORIES" }
  | { type: "CONSUME_WATER" }
  | { type: "SUPPLY_CONFIRMED"; confirmation: SupplyConfirmation }
  /** 以固定里程邊界工具產生的完整自動分圈覆寫同步；僅採用圈數不較少的來源。 */
  | { type: "SYNC_AUTO_LAPS"; laps: RideLap[]; anchor?: Omit<RideLapAnchor, "routePointIndex"> }
  | { type: "LOAD_RECORDS"; records: RideRecord[] }
  | { type: "ADD_RECORD"; record: RideRecord }
  | { type: "SET_AUTO_PAUSED_SECONDS"; totalSec: number }
  | { type: "SET_SPORT_TYPE"; sportType: SportType }
  | { type: "UPDATE_RECORD_NAME"; id: string; name: string }
  | { type: "RESTORE"; snapshot: Partial<RideState> };

// ─── Power Zone Thresholds ────────────────────────────────────────────────────
const ZONE_THRESHOLDS = [110, 150, 180, 210, 999];

function getPowerZone(watts: number): number {
  for (let i = 0; i < ZONE_THRESHOLDS.length; i++) {
    if (watts < ZONE_THRESHOLDS[i]) return i;
  }
  return 4;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

const initialState: RideState = {
  status: "idle",
  startTime: null,
  endTime: null,
  elapsed: 0,
  distance: 0,
  currentSpeed: 0,
  sportType: "cycling",
  maxSpeed: 0,
  avgSpeed: 0,
  currentPower: 0,
  avgPower: 0,
  maxPower: 0,
  powerWorkJ: 0,
  powerSampleDurationSec: 0,
  powerSource: "unavailable",
  caloriesSource: "unavailable",
  totalAscent: 0,
  totalDescent: 0,
  currentAltitude: 0,
  minElevation: null,
  maxElevation: null,
  calories: 0,
  calorieProgress: 0,
  sweatSinceLastRefill: 0,
  totalSweatMl: 0,
  currentSweatRatePerHour: 0,
  intensityLabel: "休息",
  refillCount: 0,
  hydrationThresholdMl: 250,
  route: [],
  powerHistory: [],
  powerZones: [0, 0, 0, 0, 0],
  records: [],
  totalPausedSec: 0,
  autoPausedSec: 0,
  pauseStartTime: null,
  pauseStartPausedSec: null,
  pauseSource: null,
  autoPauseStartTime: null,
  autoPauseStartPausedSec: null,
  totalCalories: 0,
  gradeDistribution: [0, 0, 0, 0, 0, 0],
  gradeAscentDistribution: [0, 0, 0, 0, 0, 0],
  customSupplyItemCounts: {},
  supplyConfirmations: [],
  laps: [],
  lapAnchor: {
    elapsedSec: 0,
    distanceM: 0,
    ascentM: 0,
    descentM: 0,
    powerWorkJ: 0,
    powerSampleDurationSec: 0,
    routePointIndex: 0,
  },
};

export function rideReducer(state: RideState, action: RideAction): RideState {
  switch (action.type) {
    case "START":
      // 路線、釘選、GPX 與地圖操作絕不可重設進行中的騎乘。
      if (!canStartRide(state.status)) return state;
      return {
        ...initialState,
        records: state.records,
        status: "active",
        startTime: Date.now(),
        endTime: null,
        hydrationThresholdMl: action.hydrationThresholdMl,
      };

    case "PAUSE":
      if (!canPauseRide(state.status)) return state;
      {
        const pausedAtMs = Date.now();
        const pauseSource = action.source ?? "manual";
      return {
        ...state,
        status: "paused",
        currentSpeed: 0,   // 暫停時速度歸零
        currentPower: 0,   // 暫停時瓦數歸零
        pauseStartTime: pausedAtMs,
        pauseStartPausedSec: state.totalPausedSec,
        pauseSource,
        autoPauseStartTime: pauseSource === "automatic" ? pausedAtMs : null,
        autoPauseStartPausedSec: pauseSource === "automatic" ? state.autoPausedSec : null,
      };
      }

    case "RESUME": {
      if (!canResumeRide(state.status)) return state;
      return {
        ...state,
        status: "active",
        totalPausedSec: calculatePausedSeconds({
          pauseStartedAtMs: state.pauseStartTime,
          pauseStartedTotalSec: state.pauseStartPausedSec,
          currentTotalPausedSec: state.totalPausedSec,
          nowMs: Date.now(),
        }),
        autoPausedSec: calculateAutoPausedSeconds({
          source: state.pauseSource,
          autoPauseStartedAtMs: state.autoPauseStartTime,
          autoPauseStartedTotalSec: state.autoPauseStartPausedSec,
          currentAutoPausedSec: state.autoPausedSec,
          nowMs: Date.now(),
        }),
        pauseStartTime: null,
        pauseStartPausedSec: null,
        pauseSource: null,
        autoPauseStartTime: null,
        autoPauseStartPausedSec: null,
      };
    }

    case "STOP": {
      // 僅可由實際進行中的騎乘結束；其他狀態維持原樣。
      if (!canStopRide(state.status)) return state;
      const nowMs = Date.now();
      const totalPausedSec = calculatePausedSeconds({
        pauseStartedAtMs: state.pauseStartTime,
        pauseStartedTotalSec: state.pauseStartPausedSec,
        currentTotalPausedSec: state.totalPausedSec,
        nowMs,
      });
      const autoPausedSec = calculateAutoPausedSeconds({
        source: state.pauseSource,
        autoPauseStartedAtMs: state.autoPauseStartTime,
        autoPauseStartedTotalSec: state.autoPauseStartPausedSec,
        currentAutoPausedSec: state.autoPausedSec,
        nowMs,
      });
      return {
        ...state,
        status: "finished",
        endTime: nowMs,
        totalPausedSec,
        autoPausedSec,
        pauseStartTime: null,
        pauseStartPausedSec: null,
        pauseSource: null,
        autoPauseStartTime: null,
        autoPauseStartPausedSec: null,
      };
    }

    case "RESET":
      // 累計只會在 STOP 後進入 finished 的明確完成流程中重置。
      return canResetCompletedRide(state.status)
        ? { ...initialState, records: state.records }
        : state;

    case "TICK":
      // 移動時間唯一由 LOCATION_UPDATE 的可信 GPS 時間差積分；保留 action 只為相容
      // 既有呼叫端，不能再用牆鐘 timer 覆寫或重複累積它。
      return state;

    case "PAUSE_TICK": {
      // elapsed 是移動時間；暫停時間以絕對時間戳重算，背景回來後不會漏算或雙算。
      if (!canResumeRide(state.status) || !state.pauseStartTime) return state;
      return {
        ...state,
        totalPausedSec: calculatePausedSeconds({
          pauseStartedAtMs: state.pauseStartTime,
          pauseStartedTotalSec: state.pauseStartPausedSec,
          currentTotalPausedSec: state.totalPausedSec,
          nowMs: Date.now(),
        }),
        autoPausedSec: calculateAutoPausedSeconds({
          source: state.pauseSource,
          autoPauseStartedAtMs: state.autoPauseStartTime,
          autoPauseStartedTotalSec: state.autoPauseStartPausedSec,
          currentAutoPausedSec: state.autoPausedSec,
          nowMs: Date.now(),
        }),
      };
    }

    case "LIVE_READINGS_STATIONARY":
      return {
        ...state,
        currentSpeed: 0,
        currentPower: 0,
      };

    case "LOCATION_UPDATE": {
      const {
        point,
        power,
        calories,
        ascent,
        descent = 0,
        acceptedElevationM,
        distanceM,
        intervalSec = 0,
        countMovingTime,
        isBackgroundRecovery = false,
        powerSource = "unavailable",
        caloriesSource = "unavailable",
        maxPowerCandidate,
      } = action;
      const newRoute = [...state.route, point];

      // 暫停期間可保留軌跡供地圖呈現，但不得增加任何活動統計。
      if (state.status === "paused") {
        return {
          ...state,
          route: newRoute,
        };
      }

      // 只有明確開始且尚未停止的活動可寫入距離、時間、地形、功率與卡路里。
      // 因此釘選導航、臨時 GPX、地圖定位或任何導航切換都不能在 idle／finished 狀態污染累計。
      if (!shouldAccumulateRideStatistics(state.status)) return state;

      const speedKmh = (point.speed ?? 0) * 3.6;
      const newPowerHistory = [...state.powerHistory, power];
      const effectiveIntervalSec = Math.max(0, Number.isFinite(intervalSec) ? intervalSec : 0);
      // 前景與背景都由相同的、已通過品質閘門的 GPS 區間累積移動時間。
      // 這消除 timer tick 與自動暫停狀態競爭造成的短移動時間與衍生數值暴衝。
      const shouldCountMovingTime = countMovingTime ?? isBackgroundRecovery;
      const movingIntervalSec = shouldCountMovingTime ? effectiveIntervalSec : 0;
      const countedDistanceM = shouldCountMovingTime ? Math.max(0, distanceM ?? 0) : 0;
      const nextElapsed = state.elapsed + movingIntervalSec;
      const newPowerWorkJ = state.powerWorkJ + Math.max(0, power) * movingIntervalSec;
      const newPowerSampleDurationSec = state.powerSampleDurationSec + movingIntervalSec;
      const avgPower = newPowerSampleDurationSec > 0 ? newPowerWorkJ / newPowerSampleDurationSec : 0;
      const zone = getPowerZone(power);
      const newZones = [...state.powerZones];
      newZones[zone]++;
      const newCalories = state.calories + calories;
      const newTotalCalories = state.totalCalories + calories;
      const mergedPowerSource: ActivityPowerSource = state.powerSource === "measured" || powerSource === "measured"
        ? "measured"
        : state.powerSource === "estimated" || powerSource === "estimated"
          ? "estimated"
          : "unavailable";
      const mergedCaloriesSource: ActivityCaloriesSource = state.caloriesSource === "unavailable"
        ? caloriesSource
        : caloriesSource === "unavailable" || caloriesSource === state.caloriesSource
          ? state.caloriesSource
          : "mixed-estimate";
      const nextMinElevation = acceptedElevationM === undefined
        ? state.minElevation
        : state.minElevation === null ? acceptedElevationM : Math.min(state.minElevation, acceptedElevationM);
      const nextMaxElevation = acceptedElevationM === undefined
        ? state.maxElevation
        : state.maxElevation === null ? acceptedElevationM : Math.max(state.maxElevation, acceptedElevationM);

      // 坡度區間統計（使用真實 GPS 距離）
      const newGradeDistribution = [...state.gradeDistribution];
      const newGradeAscentDistribution = [...state.gradeAscentDistribution];
      // 優先使用傳入的真實距離，其次使用速度推算
      const distance = countedDistanceM;
      let gradeIndex = 0; // 預設為 1-5%（平坦路段）
      if (distance > 0 && ascent > 0) {
        const grade = (ascent / distance) * 100;
        if (grade >= 1 && grade < 6) gradeIndex = 0;
        else if (grade >= 6 && grade < 11) gradeIndex = 1;
        else if (grade >= 11 && grade < 16) gradeIndex = 2;
        else if (grade >= 16 && grade < 21) gradeIndex = 3;
        else if (grade >= 21 && grade < 26) gradeIndex = 4;
        else if (grade >= 26) gradeIndex = 5;
      }
      // 當 ascent <= 0 時，gradeIndex 保持為 0（平坦或下坡）
      newGradeDistribution[gradeIndex] += distance;
      newGradeAscentDistribution[gradeIndex] += Math.max(0, ascent);

      return {
        ...state,
        route: newRoute,
        currentSpeed: speedKmh,
        maxSpeed: Math.max(state.maxSpeed, speedKmh),
        elapsed: nextElapsed,
        avgSpeed: nextElapsed > 0 ? (state.distance + distance) / 1000 / (nextElapsed / 3600) : 0,
        currentPower: power,
        avgPower: Math.round(avgPower),
        maxPower: Math.max(state.maxPower, Math.max(0, maxPowerCandidate ?? power)),
        powerWorkJ: newPowerWorkJ,
        powerSampleDurationSec: newPowerSampleDurationSec,
        powerSource: mergedPowerSource,
        caloriesSource: mergedCaloriesSource,
        totalAscent: state.totalAscent + (shouldCountMovingTime ? ascent : 0),
        totalDescent: state.totalDescent + (shouldCountMovingTime ? descent : 0),
        currentAltitude: point.altitude ?? state.currentAltitude,
        minElevation: nextMinElevation,
        maxElevation: nextMaxElevation,
        calories: shouldCountMovingTime ? newCalories : state.calories,
        totalCalories: shouldCountMovingTime ? newTotalCalories : state.totalCalories,
        distance: state.distance + distance,
        powerHistory: shouldCountMovingTime ? newPowerHistory : state.powerHistory,
        powerZones: newZones,
        gradeDistribution: newGradeDistribution,
        gradeAscentDistribution: newGradeAscentDistribution,
      };
    }

    case "SWEAT_UPDATE": {
      if (!shouldAccumulateRideStatistics(state.status)) return state;
      const { sweatLossMl, sweatRatePerHour, intensityLabel } = action;
      const newSweatSince = state.sweatSinceLastRefill + sweatLossMl;
      const newTotalSweat = state.totalSweatMl + sweatLossMl;
      return {
        ...state,
        sweatSinceLastRefill: newSweatSince,
        totalSweatMl: newTotalSweat,
        currentSweatRatePerHour: sweatRatePerHour,
        intensityLabel,
      };
    }

    case "CONSUME_CALORIES":
      // 重置補給間卡路里累計（totalCalories 保留全程累計）
      return { ...state, calories: 0, calorieProgress: 0 };

    case "CONSUME_WATER":
      return {
        ...state,
        sweatSinceLastRefill: 0,
        refillCount: state.refillCount + 1,
      };

    case "SUPPLY_CONFIRMED":
      return {
        ...state,
        supplyConfirmations: [...state.supplyConfirmations, action.confirmation].slice(-100),
      };

    case "SYNC_AUTO_LAPS": {
      // 前景與背景皆使用同一套固定里程工具；若背景快照較舊，不能覆蓋掉已封存的新圈。
      if (action.laps.length < state.laps.length) return state;
      return {
        ...state,
        laps: action.laps.map((lap, index) => ({ ...lap, index: index + 1, source: "auto" })),
        lapAnchor: action.anchor
          ? { ...action.anchor, routePointIndex: state.route.length }
          : state.lapAnchor,
      };
    }

    case "LOAD_RECORDS":
      return { ...state, records: action.records };

    case "ADD_RECORD":
      return { ...state, records: [action.record, ...state.records] };

    case "SET_AUTO_PAUSED_SECONDS":
      {
        const merged = mergeAutoPausedSeconds(state.totalPausedSec, state.autoPausedSec, Math.round(action.totalSec));
        return {
          ...state,
          ...merged,
        };
      }

    case "SET_SPORT_TYPE":
      // 活動進行或暫停時不可變更運動類型，避免同一筆統計混入兩種運動模型；
      // 已完成但尚未關閉摘要的狀態仍可預先選擇下一次活動的運動類型。
      return state.status === "active" || state.status === "paused"
        ? state
        : { ...state, sportType: action.sportType };

    case "UPDATE_RECORD_NAME": {
      const updated = state.records.map((r) =>
        r.id === action.id ? { ...r, name: action.name } : r
      );
      return { ...state, records: updated };
    }

    case "RESTORE":
      // 從快照恢復騎乘狀態（崩潰後重啟）
      if (!canStartRide(state.status)) return state;
      return {
        ...state,
        ...action.snapshot,
        status: "paused", // 恢復後狀態為暫停，等待使用者手動繼續
        records: state.records, // 保留現有記錄
      };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface RideContextValue {
  state: RideState;
  dispatch: React.Dispatch<RideAction>;
  saveRecord: (
    name?: string,
    calculationProfile?: RideCalculationProfile,
  ) => Promise<string | null>;
  loadRecords: () => Promise<void>;
  updateRecordName: (id: string, name: string) => Promise<void>;
  updateRideActivity: (id: string, updates: RideActivityUpdate) => Promise<void>;
  setSportType: (sportType: SportType) => void;
  /** 儲存騎乘進度快照（每 10 秒呼叫一次） */
  saveSnapshot: () => Promise<void>;
  /** 清除進度快照（騎乘結束後呼叫） */
  clearSnapshot: () => Promise<void>;
  /** 檢查是否有未完成的騎乘快照 */
  checkSnapshot: () => Promise<Partial<RideState> | null>;
  /** 計算路線統計 */
  getRouteStats: (routeName: string) => RouteStats | null;
}

const RideContext = createContext<RideContextValue | null>(null);

const STORAGE_KEY = "@bike_records";
const SPORT_TYPE_STORAGE_KEY = "@bike_selected_sport";

/**
 * GPS 點抽樣：減少一般連續移動路段的儲存量，但不捨棄已接受的暫停期間原始點，
 * 以保留 GPX／FIT 可重建的時間戳資料鏈。
 */
function decimateRoute(route: LocationPoint[], maxPoints = 500): LocationPoint[] {
  if (route.length <= maxPoints) return route;
  const step = Math.ceil(route.length / maxPoints);
  const result: LocationPoint[] = [];
  for (let i = 0; i < route.length; i += step) {
    result.push(route[i]);
  }
  for (const point of route) {
    if (point.recordedDuringPause && !result.includes(point)) result.push(point);
  }
  result.sort((a, b) => a.timestamp - b.timestamp);
  // 確保最後一點保留
  if (result[result.length - 1] !== route[route.length - 1]) {
    result.push(route[route.length - 1]);
  }
  return result;
}

/** 生成預設路線名稱（依日期時間） */
function generateDefaultName(date: number, sportType: SportType = "cycling"): string {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const period = hour < 6 ? "深夜" : hour < 12 ? "早晨" : hour < 18 ? "下午" : "夜間";
  const sportLabel: Record<SportType, string> = {
    cycling: "騎乘",
    running: "跑步",
    hiking: "登山",
    trail_running: "越野跑",
  };
  return `${month}月${day}日 ${period}${sportLabel[sportType]}`;
}

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(rideReducer, initialState);

  useEffect(() => {
    void AsyncStorage.getItem(SPORT_TYPE_STORAGE_KEY).then((stored) => {
      if (stored === "cycling" || stored === "running" || stored === "hiking" || stored === "trail_running") {
        dispatch({ type: "SET_SPORT_TYPE", sportType: stored });
      }
    }).catch(() => {});
  }, []);

  const saveRecord = useCallback(async (
    name?: string,
    calculationProfile?: RideCalculationProfile,
  ) => {
    if (state.elapsed < 10) return null;
    const now = Date.now();
    
    // 優先使用使用者設定 FTP；只有舊流程缺少設定時才以體重做相容性估算。
    const ftpW = Math.max(
      1,
      calculationProfile?.ftpW
        ?? estimateFTP(calculationProfile?.riderWeightKg ?? 70, "intermediate"),
    );
    const elapsedDurationSec = state.startTime
      ? Math.max(0, Math.round(((state.endTime ?? now) - state.startTime) / 1000))
      : state.elapsed + state.totalPausedSec;
    const pausedForActivitySec = Math.max(0, elapsedDurationSec - state.elapsed);
    const timeTotals = buildRideTimeTotals(state.elapsed, pausedForActivitySec);
    const movingTime = timeTotals.movingTime;
    const activityStats = buildActivityStatistics({
      distanceM: state.distance,
      movingTimeSec: movingTime,
      pausedTimeSec: timeTotals.totalPausedSec,
      totalAscentM: state.totalAscent,
      totalDescentM: state.totalDescent,
      minElevationM: state.minElevation ?? undefined,
      maxElevationM: state.maxElevation ?? undefined,
      maxSpeedKmh: state.maxSpeed,
      maxPowerW: state.maxPower,
      powerWorkJ: state.powerWorkJ,
      powerSampleDurationSec: state.powerSampleDurationSec,
      caloriesKcal: state.totalCalories,
      powerSource: state.powerSource,
      caloriesSource: state.caloriesSource,
    });
    const trainingAnalysis = analyzeTraining(
      movingTime,
      activityStats.averagePowerW ?? 0,
      activityStats.maxPowerW ?? 0,
      ftpW,
      state.powerHistory,
    );
    const automaticRpe = estimateAutomaticRpe({
      intensityFactor: trainingAnalysis.intensityFactor,
      averagePowerW: activityStats.averagePowerW ?? 0,
      ftpW,
      movingTimeSec: movingTime,
      distanceMeters: state.distance,
      totalAscentMeters: state.totalAscent,
      temperatureC: calculationProfile?.environment?.averageTemperatureC,
      humidityPct: calculationProfile?.environment?.averageHumidityPct,
      powerSampleCount: state.powerHistory.length,
    });
    
    const recordBase: RideRecord = {
      id: now.toString(),
      date: now,
      name: (name && name.trim()) ? name.trim() : generateDefaultName(now, state.sportType),
      duration: activityStats.elapsedTimeSec,
      distance: activityStats.distanceM,
      avgSpeed: activityStats.averageSpeedKmh,
      maxSpeed: activityStats.maxSpeedKmh,
      totalAscent: activityStats.totalAscentM,
      totalDescent: activityStats.totalDescentM,
      maxElevation: activityStats.maxElevationM,
      minElevation: activityStats.minElevationM,
      averageGrade: activityStats.averageGradePct,
      calories: Math.round(activityStats.caloriesKcal),  // 使用全程總卡路里（不被補給重置）
      avgPower: Math.round(activityStats.averagePowerW ?? 0),
      maxPower: activityStats.maxPowerW ?? 0,
      totalWorkKj: activityStats.totalWorkKj,
      powerSource: activityStats.powerSource,
      caloriesSource: activityStats.caloriesSource,
      powerZones: state.powerZones,
      powerHistory: state.powerHistory,  // 功率時間序列（用於回放）
      route: decimateRoute(state.route),  // 抽樣壓縮，最多 500 點
      totalSweatMl: Math.round(state.totalSweatMl),
      refillCount: state.refillCount,
      totalPausedSec: timeTotals.totalPausedSec,
      autoPausedSec: Math.min(timeTotals.totalPausedSec, Math.max(0, state.autoPausedSec)),
      movingTime,
      // 坡度分布數據
      gradeDistribution: state.gradeDistribution,
      gradeAscentDistribution: state.gradeAscentDistribution,
      description: "",
      activityType: "road",
      sportType: state.sportType,
      mediaItems: [],
      // 訓練效果分析
      tss: trainingAnalysis.tss,
      intensityFactor: trainingAnalysis.intensityFactor,
      normalizedPower: trainingAnalysis.normalizedPower,
      perceivedExertion: calculationProfile?.autoRpeEnabled === false ? undefined : automaticRpe.value,
      perceivedExertionSource: calculationProfile?.autoRpeEnabled === false ? undefined : "app-estimate",
      calculationProfile: calculationProfile
        ? { ...calculationProfile, ftpW }
        : undefined,
      supplyConfirmations: state.supplyConfirmations,
      laps: state.laps,
    };
    const normalizedRecord = normalizeRideRecord(recordBase) ?? recordBase;
    const record: RideRecord = {
      ...normalizedRecord,
      personalBests: calculatePersonalBests(normalizedRecord, state.records),
    };
    dispatch({ type: "ADD_RECORD", record });
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const records: RideRecord[] = existing ? JSON.parse(existing) : [];
    records.unshift(record);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
    return record.id;
  }, [state]);

  const loadRecords = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const migrated = normalizeRideRecords(JSON.parse(data)).map((record) => ({
          ...record,
          name: record.name || generateDefaultName(record.date, record.sportType),
        }));
        if (JSON.stringify(migrated) !== data) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated.slice(0, 100)));
        }
        dispatch({ type: "LOAD_RECORDS", records: migrated });
      }
    } catch (_) {}
  }, []);

  const updateRecordName = useCallback(async (id: string, name: string) => {
    dispatch({ type: "UPDATE_RECORD_NAME", id, name });
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const records: RideRecord[] = JSON.parse(data);
        const updated = records.map((r) => (r.id === id ? { ...r, name } : r));
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (_) {}
  }, []);

  const updateRideActivity = useCallback(async (
    id: string,
    updates: RideActivityUpdate
  ) => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const records: RideRecord[] = JSON.parse(data);
        const updated = records.map((r) => {
          if (r.id === id) {
            return {
              ...r,
              ...(updates.name !== undefined ? { name: updates.name } : {}),
              ...(updates.description !== undefined ? { description: updates.description } : {}),
              ...(updates.mediaItems !== undefined ? { mediaItems: updates.mediaItems } : {}),
              ...(updates.coverPhotoUri !== undefined ? { coverPhotoUri: updates.coverPhotoUri ?? undefined } : {}),
              ...(updates.activityType !== undefined ? { activityType: updates.activityType } : {}),
              ...(updates.sportType !== undefined ? { sportType: updates.sportType } : {}),
              ...(updates.equipment !== undefined ? { equipment: updates.equipment } : {}),
              ...(updates.perceivedExertion !== undefined ? { perceivedExertion: updates.perceivedExertion } : {}),
              ...(updates.perceivedExertionSource !== undefined ? { perceivedExertionSource: updates.perceivedExertionSource } : {}),
            };
          }
          return r;
        });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        dispatch({ type: "LOAD_RECORDS", records: updated });
      }
    } catch (_) {}
  }, []);

  const SNAPSHOT_KEY = "@bike_ride_snapshot";

  const saveSnapshot = useCallback(async () => {
    if (state.status !== "active" && state.status !== "paused") return;
    try {
      const snapshot = {
        status: state.status,
        startTime: state.startTime,
        elapsed: state.elapsed,
        distance: state.distance,
        currentSpeed: state.currentSpeed,
        maxSpeed: state.maxSpeed,
        avgSpeed: state.avgSpeed,
        currentPower: state.currentPower,
        avgPower: state.avgPower,
        maxPower: state.maxPower,
        powerWorkJ: state.powerWorkJ,
        powerSampleDurationSec: state.powerSampleDurationSec,
        powerSource: state.powerSource,
        caloriesSource: state.caloriesSource,
        totalAscent: state.totalAscent,
        totalDescent: state.totalDescent,
        minElevation: state.minElevation,
        maxElevation: state.maxElevation,
        calories: state.calories,
        calorieProgress: state.calorieProgress,
        sweatSinceLastRefill: state.sweatSinceLastRefill,
        totalSweatMl: state.totalSweatMl,
        refillCount: state.refillCount,
        hydrationThresholdMl: state.hydrationThresholdMl,
        // route 太大，只儲存最後 100 點
        route: state.route.slice(-100),
        powerHistory: state.powerHistory.slice(-50),
        powerZones: state.powerZones,
        sportType: state.sportType,
        supplyConfirmations: state.supplyConfirmations,
        totalPausedSec: state.totalPausedSec,
        autoPausedSec: state.autoPausedSec,
        pauseStartTime: state.pauseStartTime,
        pauseStartPausedSec: state.pauseStartPausedSec,
        pauseSource: state.pauseSource,
        autoPauseStartTime: state.autoPauseStartTime,
        autoPauseStartPausedSec: state.autoPauseStartPausedSec,
        laps: state.laps,
        lapAnchor: state.lapAnchor,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (_) {}
  }, [state]);

  const clearSnapshot = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SNAPSHOT_KEY);
    } catch (_) {}
  }, []);

  const checkSnapshot = useCallback(async (): Promise<Partial<RideState> | null> => {
    try {
      const data = await AsyncStorage.getItem(SNAPSHOT_KEY);
      if (!data) return null;
      const snapshot = JSON.parse(data);
      // 超過 2 小時的快照視為過期
      if (Date.now() - snapshot.savedAt > 2 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(SNAPSHOT_KEY);
        return null;
      }
      return snapshot;
    } catch (_) { return null; }
  }, []);

  // 計算路線統計
  const getRouteStats = useCallback((routeName: string): RouteStats | null => {
    const routeRecords = state.records.filter((r) => r.name === routeName);
    if (routeRecords.length === 0) return null;

    const rideCount = routeRecords.length;
    const avgSpeed = routeRecords.reduce((sum, r) => sum + r.avgSpeed, 0) / rideCount;
    // 路線「最佳速度」採完整活動的平均移動速度，而不是容易受 GPS 尖峰影響的瞬時最高速。
    const bestSpeed = Math.max(...routeRecords.map((r) => r.avgSpeed));
    const bestTime = Math.min(...routeRecords.map((r) => r.duration));
    const totalDistance = routeRecords.reduce((sum, r) => sum + r.distance / 1000, 0);
    const totalAscent = routeRecords.reduce((sum, r) => sum + r.totalAscent, 0);
    const lastRideDate = Math.max(...routeRecords.map((r) => r.date));

    return {
      name: routeName,
      rideCount,
      avgSpeed,
      bestSpeed,
      bestTime,
      totalDistance,
      totalAscent,
      lastRideDate,
    };
  }, [state.records]);

  const setSportType = useCallback((sportType: SportType) => {
    dispatch({ type: "SET_SPORT_TYPE", sportType });
    void AsyncStorage.setItem(SPORT_TYPE_STORAGE_KEY, sportType).catch(() => {});
  }, []);

  return (
    <RideContext.Provider value={{ state, dispatch, saveRecord, loadRecords, updateRecordName, updateRideActivity, setSportType, saveSnapshot, clearSnapshot, checkSnapshot, getRouteStats }}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error("useRide must be used within RideProvider");
  return ctx;
}
