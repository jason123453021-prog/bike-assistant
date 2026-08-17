import React, { createContext, useCallback, useContext, useEffect, useReducer } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { analyzeTraining, estimateFTP } from "./tss-calc";
import { calculatePersonalBests, type PersonalBest } from "./personal-bests";
import { normalizeRideRecord, normalizeRideRecords } from "./ride-record-normalizer";
import { estimateAutomaticRpe } from "@/lib/automatic-rpe";
import { buildRideTimeTotals, calculatePausedSeconds } from "@/lib/ride-time-accounting";
import {
  buildActivityStatistics,
  type ActivityCaloriesSource,
  type ActivityPowerSource,
} from "@/lib/activity-statistics";
import type { SportType } from "./sport-metrics";

export type { SportType } from "./sport-metrics";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RideStatus = "idle" | "active" | "paused" | "finished";
export type RideActivityType = "road" | "gravel" | "mountain" | "commute" | "indoor" | "other";

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
}

export interface RideState {
  status: RideStatus;
  startTime: number | null;
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
  /** 暫停開始時間戳（ms），用於計算本次暫停時間 */
  pauseStartTime: number | null;
  /** 本次暫停開始前已累積的暫停秒數，避免前景計時與恢復時計算重複相加。 */
  pauseStartPausedSec: number | null;

  // 坡度區間統計
  /** 坡度區間距離統計 [1-5%, 6-10%, 11-15%, 16-20%, 21-25%, 26%+] */
  gradeDistribution: number[];
  /** 坡度區間爬升統計 [1-5%, 6-10%, 11-15%, 16-20%, 21-25%, 26%+] */
  gradeAscentDistribution: number[];

  // 自訂補給品計數
  /** 自訂補給品計數 Map: supplyItemId -> { count: 次數, lastTriggeredTime: 上次觸發時間戳 } */
  customSupplyItemCounts: Record<string, { count: number; lastTriggeredTime: number }>;
  supplyConfirmations: SupplyConfirmation[];
}

type RideAction =
  | { type: "START"; hydrationThresholdMl: number }
  | { type: "PAUSE" }
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
      /** 僅背景回補樣本使用；前景移動時間由每秒計時器維護。 */
      isBackgroundRecovery?: boolean;
      powerSource?: ActivityPowerSource;
      caloriesSource?: ActivityCaloriesSource;
    }
  | { type: "SWEAT_UPDATE"; sweatLossMl: number; sweatRatePerHour: number; intensityLabel: string }
  | { type: "CONSUME_CALORIES" }
  | { type: "CONSUME_WATER" }
  | { type: "SUPPLY_CONFIRMED"; confirmation: SupplyConfirmation }
  | { type: "LOAD_RECORDS"; records: RideRecord[] }
  | { type: "ADD_RECORD"; record: RideRecord }
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
  pauseStartTime: null,
  pauseStartPausedSec: null,
  totalCalories: 0,
  gradeDistribution: [0, 0, 0, 0, 0, 0],
  gradeAscentDistribution: [0, 0, 0, 0, 0, 0],
  customSupplyItemCounts: {},
  supplyConfirmations: [],
};

function rideReducer(state: RideState, action: RideAction): RideState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        records: state.records,
        status: "active",
        startTime: Date.now(),
        hydrationThresholdMl: action.hydrationThresholdMl,
      };

    case "PAUSE":
      return {
        ...state,
        status: "paused",
        currentSpeed: 0,   // 暫停時速度歸零
        currentPower: 0,   // 暫停時瓦數歸零
        pauseStartTime: Date.now(),
        pauseStartPausedSec: state.totalPausedSec,
      };

    case "RESUME": {
      return {
        ...state,
        status: "active",
        totalPausedSec: calculatePausedSeconds({
          pauseStartedAtMs: state.pauseStartTime,
          pauseStartedTotalSec: state.pauseStartPausedSec,
          currentTotalPausedSec: state.totalPausedSec,
          nowMs: Date.now(),
        }),
        pauseStartTime: null,
        pauseStartPausedSec: null,
      };
    }

    case "STOP":
      return { ...state, status: "finished" };

    case "RESET":
      return { ...initialState, records: state.records };

    case "TICK":
      return { ...state, elapsed: action.elapsed };

    case "PAUSE_TICK": {
      // elapsed 是移動時間；暫停時間以絕對時間戳重算，背景回來後不會漏算或雙算。
      if (!state.pauseStartTime) return state;
      return {
        ...state,
        totalPausedSec: calculatePausedSeconds({
          pauseStartedAtMs: state.pauseStartTime,
          pauseStartedTotalSec: state.pauseStartPausedSec,
          currentTotalPausedSec: state.totalPausedSec,
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
        isBackgroundRecovery = false,
        powerSource = "unavailable",
        caloriesSource = "unavailable",
      } = action;
      const newRoute = [...state.route, point];

      // 軌跡點始終記錄
      if (state.status === "paused") {
        return {
          ...state,
          route: newRoute,
        };
      }

      // 其他數據僅在 active 狀態下更新
      const speedKmh = (point.speed ?? 0) * 3.6;
      const newPowerHistory = [...state.powerHistory, power];
      const effectiveIntervalSec = Math.max(0, Number.isFinite(intervalSec) ? intervalSec : 0);
      const nextElapsed = state.elapsed + (isBackgroundRecovery ? effectiveIntervalSec : 0);
      const newPowerWorkJ = state.powerWorkJ + Math.max(0, power) * effectiveIntervalSec;
      const newPowerSampleDurationSec = state.powerSampleDurationSec + effectiveIntervalSec;
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
      const distance = distanceM ?? (point.speed ?? 0) * 3; // 米
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
        maxPower: Math.max(state.maxPower, power),
        powerWorkJ: newPowerWorkJ,
        powerSampleDurationSec: newPowerSampleDurationSec,
        powerSource: mergedPowerSource,
        caloriesSource: mergedCaloriesSource,
        totalAscent: state.totalAscent + ascent,
        totalDescent: state.totalDescent + descent,
        currentAltitude: point.altitude ?? state.currentAltitude,
        minElevation: nextMinElevation,
        maxElevation: nextMaxElevation,
        calories: newCalories,
        totalCalories: newTotalCalories,
        distance: state.distance + distance,
        powerHistory: newPowerHistory,
        powerZones: newZones,
        gradeDistribution: newGradeDistribution,
        gradeAscentDistribution: newGradeAscentDistribution,
      };
    }

    case "SWEAT_UPDATE": {
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

    case "LOAD_RECORDS":
      return { ...state, records: action.records };

    case "ADD_RECORD":
      return { ...state, records: [action.record, ...state.records] };

    case "SET_SPORT_TYPE":
      return state.status === "idle" ? { ...state, sportType: action.sportType } : state;

    case "UPDATE_RECORD_NAME": {
      const updated = state.records.map((r) =>
        r.id === action.id ? { ...r, name: action.name } : r
      );
      return { ...state, records: updated };
    }

    case "RESTORE":
      // 從快照恢復騎乘狀態（崩潰後重啟）
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

/** GPS 點抽樣：每隔 N 點保留一個，減少儲存大小 */
function decimateRoute(route: LocationPoint[], maxPoints = 500): LocationPoint[] {
  if (route.length <= maxPoints) return route;
  const step = Math.ceil(route.length / maxPoints);
  const result: LocationPoint[] = [];
  for (let i = 0; i < route.length; i += step) {
    result.push(route[i]);
  }
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
    const timeTotals = buildRideTimeTotals(state.elapsed, state.totalPausedSec);
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
      activityStats.maxPowerW,
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
      maxPower: activityStats.maxPowerW,
      totalWorkKj: activityStats.totalWorkKj,
      powerSource: activityStats.powerSource,
      caloriesSource: activityStats.caloriesSource,
      powerZones: state.powerZones,
      powerHistory: state.powerHistory,  // 功率時間序列（用於回放）
      route: decimateRoute(state.route),  // 抽樣壓縮，最多 500 點
      totalSweatMl: Math.round(state.totalSweatMl),
      refillCount: state.refillCount,
      totalPausedSec: timeTotals.totalPausedSec,
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
    const bestSpeed = Math.max(...routeRecords.map((r) => r.maxSpeed));
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
