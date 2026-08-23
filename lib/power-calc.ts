/**
 * 虛擬功率計算模組 v2
 * 完整物理模型：滾動阻力 + 空氣阻力 + 重力阻力 + 加速阻力
 * 支援天氣連動空氣密度（溫度+濕度修正）
 * 下坡時功率合理降低（重力分量為負，輸出最低為 0）
 */
// 物理常數
const RHO_STD = 1.225;   // 標準空氣密度 kg/m³（海平面 15°C）
export const G = 9.81;   // 重力加速度 m/s²
// 公路車一般騎姿與一般柏油路面的保守預設值。
export const ROAD_CDA = 0.4; // 空氣阻力係數 × 正面面積 m²
export const ASPHALT_CRR = 0.005; // 滾動阻力係數
export const DEFAULT_ROAD_BIKE_MASS_KG = 9;
export const DEFAULT_CYCLING_MECHANICAL_EFFICIENCY = 0.21;
const DRIVETRAIN_LOSS = 0.97; // 傳動效率（鏈條損耗約 3%）
// 加速阻力：含旋轉質量修正（輪組等效質量 ≈ 總質量 × 1.05）
const ROTATING_MASS_FACTOR = 1.05;
/**
 * 依溫度與濕度計算空氣密度（考慮水蒸氣影響）
 * 溫度越高 → 空氣密度越低；濕度越高 → 空氣密度略降
 */
export function calcAirDensity(tempC: number, humidityPct = 60): number {
  // 飽和水蒸氣壓（Magnus 公式）
  const Psat = 6.1078 * Math.pow(10, (7.5 * tempC) / (237.3 + tempC)) * 100; // Pa
  const Pv = (humidityPct / 100) * Psat;
  const Pd = 101325 - Pv; // 乾空氣分壓
  const rho = (Pd * 0.028964 + Pv * 0.018016) / (8.314 * (273.15 + tempC));
  return Math.max(0.9, Math.min(1.4, rho)); // 合理範圍限制
}

export interface PowerInput {
  speedMs: number;          // 速度 m/s
  prevSpeedMs?: number;     // 上一次速度 m/s（用於計算加速阻力）
  intervalSec?: number;     // 採樣間隔秒數（預設 3s）
  gradePct: number;         // 坡度 % (正值=上坡，負值=下坡)
  windSpeedMs: number;      // 逆風分量 m/s (逆風為正，順風為負)
  riderMassKg: number;      // 騎士體重 kg
  bikeMassKg?: number;      // 自行車重量 kg (預設 9kg)
  /** 空氣密度 kg/m³，預設 1.225（可由 calcAirDensity(tempC, humidityPct) 獲得） */
  airDensityKgM3?: number;
}

// 功率計算上限（超過此值視為 GPS 誤差，截斷）
const MAX_POWER_W = 900;
// 坡度限制（GPS 高度誤差可能造成瞬間極端坡度）
const MAX_GRADE_PCT = 28;
// 手機 GPS 的瞬時速度不適合作為衝刺功率計；限制正向加速度，避免跳點主導整段平均功率。
const MAX_VIRTUAL_POSITIVE_ACCELERATION_MS2 = 0.25;

export function calculatePower(input: PowerInput): number {
  const {
    speedMs,
    prevSpeedMs,
    intervalSec = 3,
    gradePct,
    windSpeedMs,
    riderMassKg,
    bikeMassKg = DEFAULT_ROAD_BIKE_MASS_KG,
    airDensityKgM3 = RHO_STD,
  } = input;

  if (speedMs <= 0.3) return 0; // 幾乎靜止，功率為 0
  if (speedMs > 25) return 0;   // GPS 誤差保護

  const totalMass = riderMassKg + bikeMassKg;
  const clampedGrade = Math.max(-MAX_GRADE_PCT, Math.min(MAX_GRADE_PCT, gradePct));
  const gradeDecimal = clampedGrade / 100;
  const slopeAngle = Math.atan(gradeDecimal);

  // ── 1. 空氣阻力功率 ──────────────────────────────────────────────────────
  // 相對風速 = 騎行速度 + 逆風分量（順風時為負）
  const vAir = speedMs + windSpeedMs;
  const fAero = 0.5 * airDensityKgM3 * ROAD_CDA * vAir * Math.abs(vAir);
  const pAero = Math.max(0, fAero * speedMs);

  // ── 2. 滾動阻力功率 ──────────────────────────────────────────────────────
  const fRoll = ASPHALT_CRR * totalMass * G * Math.cos(slopeAngle);
  const pRoll = fRoll * speedMs;

  // ── 3. 重力阻力功率（下坡時為負值，騎士少踩踏）────────────────────────────
  const pGrav = totalMass * G * Math.sin(slopeAngle) * speedMs;

  // ── 4. 加速阻力功率（含旋轉質量修正）────────────────────────────────────
  let pAcc = 0;
  if (prevSpeedMs !== undefined && intervalSec > 0) {
    const rawAcceleration = (speedMs - prevSpeedMs) / intervalSec;
    const accel = Math.min(MAX_VIRTUAL_POSITIVE_ACCELERATION_MS2, Math.max(-1, rawAcceleration));
    const mEff = totalMass * ROTATING_MASS_FACTOR;
    pAcc = mEff * accel * speedMs;
  }

  // ── 總功率（考慮傳動損耗，下坡時輸出最低為 0）────────────────────────────
  const rawPower = (pAero + pRoll + pGrav + pAcc) / DRIVETRAIN_LOSS;
  return Math.max(0, Math.min(MAX_POWER_W, Math.round(rawPower)));
}

/**
 * 計算卡路里消耗（基於功率和時間）
 * 人體機械效率預設 21%（接受 21–24% 的一般單車騎乘範圍）
 * 公式：kcal = (W × s) / (4184 × efficiency)
 */
export function calculateCalories(
  powerWatts: number,
  durationSeconds: number,
  mechanicalEfficiency = DEFAULT_CYCLING_MECHANICAL_EFFICIENCY,
): number {
  if (powerWatts <= 0 || durationSeconds <= 0) return 0;
  const efficiency = Math.min(0.24, Math.max(0.21, mechanicalEfficiency));
  const joules = powerWatts * durationSeconds;
  const kcal = joules / (4184 * efficiency);
  return kcal;
}

/**
 * 基於速度估算 MET 值（騎乘專用）
 * MET = 代謝當量（相對於靜息代謝率的倍數）
 */
function estimateMETFromSpeed(speedKmh: number, gradePct: number = 0): number {
  let met = 4; // 基礎 MET
  
  // 根據速度估算 MET
  if (speedKmh < 10) met = 4;
  else if (speedKmh < 15) met = 6;
  else if (speedKmh < 20) met = 8;
  else if (speedKmh < 25) met = 12;
  else if (speedKmh < 30) met = 16;
  else met = 20;
  
  // 爬升修正（爬升時 MET 增加 20-50%）
  if (gradePct > 2) {
    const gradeBonus = 1 + Math.min(0.5, gradePct / 100 * 0.3);
    met *= gradeBonus;
  }
  
  return met;
}

/**
 * 計算卡路里消耗（基於 MET 和體重）
 * 公式：kcal = 體重(kg) × MET × 時間(小時)
 * 此方法更準確，直接考慮體重和運動強度
 */
export function calculateCaloriesMET(
  speedKmh: number,
  weightKg: number,
  durationSeconds: number,
  gradePct: number = 0
): number {
  if (speedKmh <= 0 || durationSeconds <= 0 || weightKg <= 0) return 0;
  
  const met = estimateMETFromSpeed(speedKmh, gradePct);
  const hours = durationSeconds / 3600;
  const kcal = weightKg * met * hours;
  
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
