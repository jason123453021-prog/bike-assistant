import React, { createContext, useContext, useReducer, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RideStatus = "idle" | "active" | "paused" | "finished";

export interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
}

export interface RideRecord {
  id: string;
  date: number;
  duration: number;       // seconds
  distance: number;       // meters
  avgSpeed: number;       // km/h
  maxSpeed: number;       // km/h
  totalAscent: number;    // meters
  calories: number;
  avgPower: number;       // watts
  maxPower: number;       // watts
  powerZones: number[];   // [z1, z2, z3, z4, z5] percentage
  route: LocationPoint[];
  totalSweatMl: number;   // 總汗液流失量 ml
  refillCount: number;    // 補水次數
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
  calories: number;
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
}

type RideAction =
  | { type: "START"; hydrationThresholdMl: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "RESET" }
  | { type: "TICK"; elapsed: number }
  | { type: "LOCATION_UPDATE"; point: LocationPoint; power: number; calories: number; ascent: number }
  | { type: "SWEAT_UPDATE"; sweatLossMl: number; sweatRatePerHour: number; intensityLabel: string }
  | { type: "CONSUME_CALORIES" }
  | { type: "CONSUME_WATER" }
  | { type: "LOAD_RECORDS"; records: RideRecord[] }
  | { type: "ADD_RECORD"; record: RideRecord };

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
      return { ...state, status: "paused" };

    case "RESUME":
      return { ...state, status: "active" };

    case "STOP":
      return { ...state, status: "finished" };

    case "RESET":
      return { ...initialState, records: state.records };

    case "TICK":
      return { ...state, elapsed: action.elapsed };

    case "LOCATION_UPDATE": {
      const { point, power, calories, ascent } = action;
      const newRoute = [...state.route, point];
      const speedKmh = (point.speed ?? 0) * 3.6;
      const newPowerHistory = [...state.powerHistory, power];
      const avgPower = newPowerHistory.reduce((a, b) => a + b, 0) / newPowerHistory.length;
      const zone = getPowerZone(power);
      const newZones = [...state.powerZones];
      newZones[zone]++;
      const newCalories = state.calories + calories;

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
        calories: newCalories,
        distance: state.distance + (point.speed ?? 0) * 3,
        powerHistory: newPowerHistory,
        powerZones: newZones,
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
      return { ...state, calorieProgress: 0 };

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

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface RideContextValue {
  state: RideState;
  dispatch: React.Dispatch<RideAction>;
  saveRecord: () => Promise<void>;
  loadRecords: () => Promise<void>;
}

const RideContext = createContext<RideContextValue | null>(null);

const STORAGE_KEY = "@bike_records";

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(rideReducer, initialState);

  const saveRecord = useCallback(async () => {
    if (state.elapsed < 10) return;
    const record: RideRecord = {
      id: Date.now().toString(),
      date: Date.now(),
      duration: state.elapsed,
      distance: state.distance,
      avgSpeed: state.avgSpeed,
      maxSpeed: state.maxSpeed,
      totalAscent: state.totalAscent,
      calories: Math.round(state.calories),
      avgPower: state.avgPower,
      maxPower: state.maxPower,
      powerZones: state.powerZones,
      route: state.route,
      totalSweatMl: Math.round(state.totalSweatMl),
      refillCount: state.refillCount,
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
        dispatch({ type: "LOAD_RECORDS", records: JSON.parse(data) });
      }
    } catch (_) {}
  }, []);

  return (
    <RideContext.Provider value={{ state, dispatch, saveRecord, loadRecords }}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error("useRide must be used within RideProvider");
  return ctx;
}
