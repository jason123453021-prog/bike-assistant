import React, { createContext, useCallback, useContext, useReducer } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { analyzeTraining, estimateFTP } from "./tss-calc";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RideStatus = "idle" | "active" | "paused" | "finished";

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

export interface RideRecord {
  id: string;
  date: number;
  name: string;           // 自訂路線名稱（可編輯）
  duration: number;       // seconds
  distance: number;       // meters
  avgSpeed: number;       // km/h
  maxSpeed: number;       // km/h
  totalAscent: number;    // meters
  totalDescent?: number;  // 總下降高度 meters
  maxElevation?: number;  // 最大海拔 meters
  movingTime?: number;    // 移動時間 seconds
  calories: number;
  avgPower: number;       // watts
  maxPower: number;       // watts
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
}

export interface RideState {
  status: RideStatus;
  startTime: number | null;
  elapsed: number;          // seconds
  distance: number;         // meters
  currentSpeed: number;     // km/h
  maxSpeed: number;
  avgSpeed: number;
  currentPower: number;     // watts
  avgPower: number;
  maxPower: number;
  totalAscent: number;
  currentAltitude: number;  // 目前海拔 m
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

  // 坡度區間統計
  /** 坡度區間距離統計 [1-5%, 6-10%, 11-15%, 16-20%, 21-25%, 26%+] */
  gradeDistribution: number[];
  /** 坡度區間爬升統計 [1-5%, 6-10%, 11-15%, 16-20%, 21-25%, 26%+] */
  gradeAscentDistribution: number[];
}

type RideAction =
  | { type: "START"; hydrationThresholdMl: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "RESET" }
  | { type: "TICK"; elapsed: number }
  | { type: "PAUSE_TICK" }
  | { type: "LOCATION_UPDATE"; point: LocationPoint; power: number; calories: number; ascent: number; distanceM?: number }
  | { type: "SWEAT_UPDATE"; sweatLossMl: number; sweatRatePerHour: number; intensityLabel: string }
  | { type: "CONSUME_CALORIES" }
  | { type: "CONSUME_WATER" }
  | { type: "LOAD_RECORDS"; records: RideRecord[] }
  | { type: "ADD_RECORD"; record: RideRecord }
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
  maxSpeed: 0,
  avgSpeed: 0,
  currentPower: 0,
  avgPower: 0,
  maxPower: 0,
  totalAscent: 0,
  currentAltitude: 0,
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
  totalCalories: 0,
  gradeDistribution: [0, 0, 0, 0, 0, 0],
  gradeAscentDistribution: [0, 0, 0, 0, 0, 0],
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
      };

    case "RESUME": {
      const pausedMs = state.pauseStartTime ? Date.now() - state.pauseStartTime : 0;
      return {
        ...state,
        status: "active",
        totalPausedSec: state.totalPausedSec + Math.round(pausedMs / 1000),
        pauseStartTime: null,
      };
    }

    case "STOP":
      return { ...state, status: "finished" };

    case "RESET":
      return { ...initialState, records: state.records };

    case "TICK":
      return { ...state, elapsed: action.elapsed };

    case "PAUSE_TICK":
      // 暫停時只更新 totalPausedSec，不更新 elapsed
      return { ...state, totalPausedSec: state.totalPausedSec + 1 };

    case "LOCATION_UPDATE": {
      const { point, power, calories, ascent, distanceM } = action;
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
      const avgPower = newPowerHistory.reduce((a, b) => a + b, 0) / newPowerHistory.length;
      const zone = getPowerZone(power);
      const newZones = [...state.powerZones];
      newZones[zone]++;
      const newCalories = state.calories + calories;
      const newTotalCalories = state.totalCalories + calories;

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
        avgSpeed: newRoute.length > 1
          ? state.distance / 1000 / (state.elapsed / 3600) || 0
          : 0,
        currentPower: power,
        avgPower: Math.round(avgPower),
        maxPower: Math.max(state.maxPower, power),
        totalAscent: state.totalAscent + ascent,
        currentAltitude: point.altitude ?? state.currentAltitude,
        calories: newCalories,
        totalCalories: newTotalCalories,
        distance: state.distance + (point.speed ?? 0) * 3,
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

    case "LOAD_RECORDS":
      return { ...state, records: action.records };

    case "ADD_RECORD":
      return { ...state, records: [action.record, ...state.records] };

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
  saveRecord: (name?: string, sensorStats?: { heartRateValues: number[]; cadenceValues: number[]; maxHeartRate: number; maxCadence: number }) => Promise<void>;
  loadRecords: () => Promise<void>;
  updateRecordName: (id: string, name: string) => Promise<void>;
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
function generateDefaultName(date: number): string {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const period = hour < 6 ? "深夜" : hour < 12 ? "早晨" : hour < 18 ? "下午" : "夜間";
  return `${month}月${day}日 ${period}騎乘`;
}

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(rideReducer, initialState);

  const saveRecord = useCallback(async (name?: string, sensorStats?: { heartRateValues: number[]; cadenceValues: number[]; maxHeartRate: number; maxCadence: number }) => {
    if (state.elapsed < 10) return;
    const now = Date.now();
    // 計算感測器平均值
    const avgHeartRate = sensorStats?.heartRateValues.length ? Math.round(sensorStats.heartRateValues.reduce((a, b) => a + b, 0) / sensorStats.heartRateValues.length) : undefined;
    const avgCadence = sensorStats?.cadenceValues.length ? Math.round(sensorStats.cadenceValues.reduce((a, b) => a + b, 0) / sensorStats.cadenceValues.length) : undefined;
    // 重新計算均速，確保使用最終的 distance 和 elapsed 值
    const finalAvgSpeed = state.elapsed > 0 ? (state.distance / 1000) / (state.elapsed / 3600) : 0;
    
    // 計算訓練壓力分數（TSS）和訓練效果分析
    // 假設用戶為中級騎士，根據體重估算 FTP（預設 70kg 体重）
    const ftpW = estimateFTP(70, 'intermediate');
    const trainingAnalysis = analyzeTraining(
      state.elapsed,
      state.avgPower,
      state.maxPower,
      ftpW
    );
    
    const record: RideRecord = {
      id: now.toString(),
      date: now,
      name: (name && name.trim()) ? name.trim() : generateDefaultName(now),
      duration: state.elapsed,
      distance: state.distance,
      avgSpeed: finalAvgSpeed,
      maxSpeed: state.maxSpeed,
      totalAscent: state.totalAscent,
      calories: Math.round(state.totalCalories),  // 使用全程總卡路里（不被補給重置）
      avgPower: state.avgPower,
      maxPower: state.maxPower,
      powerZones: state.powerZones,
      powerHistory: state.powerHistory,  // 功率時間序列（用於回放）
      route: decimateRoute(state.route),  // 抽樣壓縮，最多 500 點
      totalSweatMl: Math.round(state.totalSweatMl),
      refillCount: state.refillCount,
      totalPausedSec: state.totalPausedSec,
      // 感測器數據（可選）
      avgHeartRate,
      maxHeartRate: sensorStats?.maxHeartRate,
      avgCadence,
      maxCadence: sensorStats?.maxCadence,
      // 坡度分布數據
      gradeDistribution: state.gradeDistribution,
      gradeAscentDistribution: state.gradeAscentDistribution,
      // 訓練效果分析
      tss: trainingAnalysis.tss,
      intensityFactor: trainingAnalysis.intensityFactor,
      normalizedPower: trainingAnalysis.normalizedPower,
    };
    dispatch({ type: "ADD_RECORD", record });
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const records: RideRecord[] = existing ? JSON.parse(existing) : [];
    records.unshift(record);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
  }, [state]);

  const loadRecords = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const records: RideRecord[] = JSON.parse(data);
        // 向後相容：補充缺少 name 欄位的舊記錄
        const migrated = records.map((r) => ({
          ...r,
          name: r.name ?? generateDefaultName(r.date),
        }));
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
        totalAscent: state.totalAscent,
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

  return (
    <RideContext.Provider value={{ state, dispatch, saveRecord, loadRecords, updateRecordName, saveSnapshot, clearSnapshot, checkSnapshot, getRouteStats }}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error("useRide must be used within RideProvider");
  return ctx;
}
