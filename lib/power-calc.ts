/**
 * 虛擬功率計算模組
 * 基於 GPS 速度、坡度、風阻、滾動阻力計算估算功率
 */

// 物理常數
const RHO = 1.225;       // 空氣密度 kg/m³ (海平面)
const G = 9.81;          // 重力加速度 m/s²

// 騎乘參數預設值
const CDA = 0.32;        // 空氣阻力係數 × 正面面積 (m²) — 一般公路車姿勢
const CRR = 0.004;       // 滾動阻力係數 — 公路車胎
const DRIVETRAIN_LOSS = 0.97; // 傳動效率

export interface PowerInput {
  speedMs: number;       // 速度 m/s
  gradePct: number;      // 坡度 % (正值=上坡)
  windSpeedMs: number;   // 風速 m/s (逆風為正)
  riderMassKg: number;   // 騎士體重 kg
  bikeMassKg?: number;   // 自行車重量 kg (預設 8kg)
}

export function calculatePower(input: PowerInput): number {
  const {
    speedMs,
    gradePct,
    windSpeedMs,
    riderMassKg,
    bikeMassKg = 8,
  } = input;

  if (speedMs <= 0) return 0;

  const totalMass = riderMassKg + bikeMassKg;
  const gradeDecimal = gradePct / 100;

  // 空氣阻力功率
  const vAir = speedMs + windSpeedMs;
  const fAero = 0.5 * RHO * CDA * vAir * vAir;
  const pAero = fAero * speedMs;

  // 滾動阻力功率
  const fRoll = CRR * totalMass * G * Math.cos(Math.atan(gradeDecimal));
  const pRoll = fRoll * speedMs;

  // 重力功率（爬坡）
  const pGrav = totalMass * G * gradeDecimal * speedMs;

  // 總功率（考慮傳動損耗）
  const totalPower = (pAero + pRoll + pGrav) / DRIVETRAIN_LOSS;

  return Math.max(0, Math.round(totalPower));
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
