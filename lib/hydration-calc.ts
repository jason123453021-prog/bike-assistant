/**
 * 智慧水分流失計算模組
 *
 * 公式依據：
 * 1. 基礎汗液流失率（Moran & Pandolf, 1999）：
 *    SweatRate (L/h) = 基礎率 × 體重修正 × 溫度修正 × 強度修正 × 濕度修正
 *
 * 2. 體表面積（Du Bois formula）：
 *    BSA (m²) = 0.007184 × height^0.725 × weight^0.425
 *
 * 3. 強度以 MET（代謝當量）或功率估算
 *
 * 補水建議：每流失 250ml 提醒一次（可設定）
 */

export interface HydrationInput {
  /** 體重 kg */
  weightKg: number;
  /** 身高 cm */
  heightCm: number;
  /** 當前功率 W（用於計算強度） */
  powerW: number;
  /** 當前速度 km/h */
  speedKmh: number;
  /** 最近 N 秒的爬升 m（用於計算額外強度） */
  ascentPerInterval: number;
  /** 間隔秒數 */
  intervalSec: number;
  /** 環境溫度 °C */
  temperatureC: number;
  /** 相對濕度 % (0-100)，無資料時預設 60 */
  humidityPct?: number;
  /** 天氣代碼（WMO），用於判斷日照強度 */
  weatherCode?: number;
  /** 騎士年齡（用於模擬心率區間），預設 32 */
  ageYears?: number;
}

export interface HydrationResult {
  /** 本次間隔流失水分 ml */
  sweatLossMl: number;
  /** 每小時汗液流失率 ml/h（用於顯示） */
  sweatRatePerHour: number;
  /** 當前強度等級描述 */
  intensityLabel: string;
  /** 建議補水量 ml（每次提醒） */
  recommendedRefillMl: number;
}

// ─── 體表面積（Du Bois formula）────────────────────────────────────────────────
function calcBSA(heightCm: number, weightKg: number): number {
  return 0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);
}

// ─── 溫度修正係數（基準 20°C）──────────────────────────────────────────────────
// 每升高 1°C 汗液流失增加約 5-8%
function tempFactor(tempC: number): number {
  const base = 20;
  const delta = tempC - base;
  if (delta <= 0) return Math.max(0.6, 1 + delta * 0.03); // 低溫減少
  return 1 + delta * 0.065; // 高溫增加
}

// ─── 濕度修正係數（高濕度蒸發散熱效率降低，需更多汗液）──────────────────────
function humidityFactor(humidityPct: number): number {
  // 40-60% 為舒適區，>80% 明顯增加
  if (humidityPct <= 40) return 0.9;
  if (humidityPct <= 60) return 1.0;
  if (humidityPct <= 75) return 1.1;
  if (humidityPct <= 85) return 1.25;
  return 1.4;
}

// ─── 日照強度修正（晴天輻射熱增加汗液）──────────────────────────────────────
function solarFactor(weatherCode: number): number {
  if (weatherCode === 0) return 1.15;   // 晴天
  if (weatherCode <= 2) return 1.08;    // 大致晴/部分多雲
  if (weatherCode <= 3) return 1.0;     // 陰天
  return 0.95;                          // 雨天/霧天（輻射熱少）
}

// ─── 心率區間模擬（依年齡推算 MHR，由功率估算心率區間）────────────────────────
/**
 * 最大心率估算：MHR = 220 - 年齡（Haskell & Fox, 1970）
 * 不同年齡有不同的心率區間上下限
 */
function calcMHR(ageYears: number): number {
  return Math.max(160, 220 - ageYears);
}
/**
 * 依功率估算心率區間（Zone 1-5）
 * FTP 估算值 ≈ 體重 × 3.5 W/kg（一般業餘騎士）
 * Zone 1 (恢復): < 55% MHR
 * Zone 2 (耐力): 55-65% MHR
 * Zone 3 (節奏): 65-75% MHR
 * Zone 4 (乳酸閾值): 75-85% MHR
 * Zone 5 (無氧): > 85% MHR
 */
function estimateHRZone(
  powerW: number,
  riderMassKg: number,
  ageYears: number
): { zone: number; hrBpm: number } {
  const mhr = calcMHR(ageYears);
  const restHR = 60;
  const hrReserve = mhr - restHR;
  const ftpEstimate = riderMassKg * 3.5;
  const powerRatio = powerW > 0 ? powerW / ftpEstimate : 0;
  let hrPct: number;
  let zone: number;
  if (powerRatio < 0.5)       { hrPct = 0.50 + powerRatio * 0.10; zone = 1; }
  else if (powerRatio < 0.75) { hrPct = 0.55 + (powerRatio - 0.5) * 0.40; zone = 2; }
  else if (powerRatio < 0.90) { hrPct = 0.65 + (powerRatio - 0.75) * 0.667; zone = 3; }
  else if (powerRatio < 1.05) { hrPct = 0.75 + (powerRatio - 0.90) * 0.667; zone = 4; }
  else                        { hrPct = Math.min(1.0, 0.85 + (powerRatio - 1.05) * 0.5); zone = 5; }
  const hrBpm = Math.round(restHR + hrReserve * hrPct);
  return { zone, hrBpm };
}
/**
 * 心率區間汗液修正係數
 * 高心率區間 → 心血管系統高負荷 → 更多出汗
 */
function hrZoneSweatFactor(zone: number): number {
  const factors = [0.85, 1.0, 1.15, 1.35, 1.60];
  return factors[Math.max(0, Math.min(4, zone - 1))];
}
// ─── 強度係數（基於功率 W 或速度）──────────────────────────────────────────────
// 參考：休息~0.5 L/h, 輕鬆騎~0.8 L/h, 中等~1.2 L/h, 激烈~1.8 L/h, 極限~2.5 L/h
function intensityFactor(powerW: number, speedKmh: number): { factor: number; label: string } {
  const effectivePower = powerW > 0 ? powerW : speedKmh * 3.5; // 無功率時用速度估算

  if (effectivePower < 80)  return { factor: 0.55, label: "休息" };
  if (effectivePower < 130) return { factor: 0.80, label: "輕鬆" };
  if (effectivePower < 180) return { factor: 1.10, label: "中等" };
  if (effectivePower < 240) return { factor: 1.50, label: "激烈" };
  if (effectivePower < 320) return { factor: 1.90, label: "高強度" };
  return { factor: 2.40, label: "極限" };
}

// ─── 爬升強度加成（爬坡時額外出汗）──────────────────────────────────────────
function ascentBonus(ascentPerInterval: number, intervalSec: number): number {
  const ascentPerHour = (ascentPerInterval / intervalSec) * 3600; // m/h
  if (ascentPerHour < 100) return 0;
  if (ascentPerHour < 300) return 0.05;
  if (ascentPerHour < 600) return 0.12;
  return 0.20;
}

// ─── 主計算函數 ────────────────────────────────────────────────────────────────
export function calculateSweatLoss(input: HydrationInput): HydrationResult {
  const {
    weightKg,
    heightCm,
    powerW,
    speedKmh,
    ascentPerInterval,
    intervalSec,
    temperatureC,
    humidityPct = 60,
    weatherCode = 1,
    ageYears = 32,
  } = input;

  // 體表面積（標準人 BSA ≈ 1.7 m²）
  const bsa = calcBSA(heightCm, weightKg);
  const bsaFactor = bsa / 1.7;

  // 強度係數（基於功率/速度）
  const { factor: intFactor, label: intensityLabel } = intensityFactor(powerW, speedKmh);

  // 心率區間模擬（依年齡推算 MHR，由功率估算心率區間）
  const { zone: hrZone } = estimateHRZone(powerW, weightKg, ageYears);
  const hrFactor = hrZoneSweatFactor(hrZone);

  // 各環境修正係數
  const tFactor = tempFactor(temperatureC);
  const hFactor = humidityFactor(humidityPct);
  const sFactor = solarFactor(weatherCode);
  const aBonusFactor = 1 + ascentBonus(ascentPerInterval, intervalSec);

  // 基礎汗液流失率 L/h（標準人、中等強度、20°C、60%濕度）
  const BASE_RATE_LPH = 0.8;

  // 最終汗液流失率 ml/h（整合心率區間修正）
  const sweatRatePerHour = Math.round(
    BASE_RATE_LPH * 1000 * bsaFactor * intFactor * hrFactor * tFactor * hFactor * sFactor * aBonusFactor
  );

  // 本次間隔流失量 ml
  const sweatLossMl = (sweatRatePerHour / 3600) * intervalSec;

  // 建議補水量：最少 150ml，最多 500ml
  const recommendedRefillMl = Math.min(500, Math.max(150, Math.round(sweatRatePerHour * 0.25)));

  return {
    sweatLossMl,
    sweatRatePerHour,
    intensityLabel,
    recommendedRefillMl,
  };
}

// ─── 補水閾值（預設：每流失 250ml 提醒一次）──────────────────────────────────
export const DEFAULT_HYDRATION_THRESHOLD_ML = 250;

// ─── 格式化顯示 ────────────────────────────────────────────────────────────────
export function formatSweatRate(mlPerHour: number): string {
  if (mlPerHour < 100) return "低";
  if (mlPerHour < 500) return `${mlPerHour} ml/h`;
  if (mlPerHour < 1000) return `${(mlPerHour / 1000).toFixed(1)} L/h`;
  return `${(mlPerHour / 1000).toFixed(1)} L/h`;
}
