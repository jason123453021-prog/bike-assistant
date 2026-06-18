/**
 * 虛擬功率計算模組
 * 基於 GPS 速度、坡度、風阻、滚動阻力計算估算功率
 * 支援天氣連動空氣密度（温度修正）
 */

// 物理常數
const RHO_STD = 1.225;   // 標準空氣密度 kg/m³（海平面 15°C）
export const G = 9.81;   // 重力加速度 m/s²

// 騎乘參數預設値
const CDA = 0.32;        // 空氣阻力係數 × 正面面積 (m²) — 一般公路車姿勢
const CRR = 0.004;       // 滚動阻力係數 — 公路車胎
const DRIVETRAIN_LOSS = 0.97; // 傳動效率

/**
 * 依溫度計算空氣密度（理想氣體公式）
 * 溫度越高 → 空氣密度越低 → 空氣阻力越小
 * @param tempC 環境溫度 °C
 * @returns 空氣密度 kg/m³
 */
export function calcAirDensity(tempC: number): number {
  // 公式：ρ = 1.225 × (288.15 / (273.15 + T))
  return RHO_STD * (288.15 / (273.15 + tempC));
}

export interface PowerInput {
  speedMs: number;       // 速度 m/s
  gradePct: number;      // 坡度 % (正値=上坡)
  windSpeedMs: number;   // 風速 m/s (逆風為正)
  riderMassKg: number;   // 騎士體重 kg
  bikeMassKg?: number;   // 自行車重量 kg (預設 8kg)
  /** 空氣密度 kg/m³，預設 1.225（可由 calcAirDensity(tempC) 獲得） */
  airDensityKgM3?: number;
}

// 功率計算上限（超過此值視為 GPS 誤差，截斷）
const MAX_POWER_W = 800;
// 坡度限制（GPS 高度誤差可能造成瞬間極端坡度）
const MAX_GRADE_PCT = 25;

export function calculatePower(input: PowerInput): number {
  const {
    speedMs,
    gradePct,
    windSpeedMs,
    riderMassKg,
    bikeMassKg = 8,
    airDensityKgM3 = RHO_STD,  // 預設使用標準空氣密度
  } = input;

  if (speedMs <= 0) return 0;
  // 速度上限：超過 25 m/s（90 km/h）視為 GPS 誤差
  if (speedMs > 25) return 0;

  const totalMass = riderMassKg + bikeMassKg;
  // 坡度限制：GPS 高度誤差可能造成瞬間極端坡度，限制在 ±25%
  const clampedGrade = Math.max(-MAX_GRADE_PCT, Math.min(MAX_GRADE_PCT, gradePct));
  const gradeDecimal = clampedGrade / 100;

  // 空氣阻力功率（使用天氣連動空氣密度）
  const vAir = speedMs + windSpeedMs;
  const fAero = 0.5 * airDensityKgM3 * CDA * vAir * vAir;
  const pAero = fAero * speedMs;

  // 滾動阻力功率
  const fRoll = CRR * totalMass * G * Math.cos(Math.atan(gradeDecimal));
  const pRoll = fRoll * speedMs;

  // 重力功率（爬坡）
  const pGrav = totalMass * G * gradeDecimal * speedMs;

  // 總功率（考慮傳動損耗）
  const totalPower = (pAero + pRoll + pGrav) / DRIVETRAIN_LOSS;

  // 截斷異常高功率（GPS 誤差導致）
  return Math.max(0, Math.min(MAX_POWER_W, Math.round(totalPower)));
}

/**
 * 計算卡路里消耗（基於功率和時間）
 * 使用效率係數 ~25%（人體機械效率）
 */
export function calculateCalories(powerWatts: number, durationSeconds: number): number {
  const efficiency = 0.25;
  const joules = powerWatts * durationSeconds;
  const kcal = joules / (4184 * efficiency);
  return kcal;
}

/**
 * 計算兩個 GPS 點之間的距離（Haversine 公式）
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // 地球半徑 m
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 計算坡度百分比
 */
export function calcGrade(altDiff: number, distMeters: number): number {
  if (distMeters < 1) return 0;
  return (altDiff / distMeters) * 100;
}

/**
 * 格式化時間 (秒 → HH:MM:SS)
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 格式化距離
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * 功率區間名稱
 */
export const POWER_ZONE_NAMES = ["Z1 恢復", "Z2 耐力", "Z3 節奏", "Z4 閾值", "Z5 無氧"];
export const POWER_ZONE_COLORS = ["#94A3B8", "#00C896", "#F59E0B", "#FF9500", "#FF3B30"];
