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
  } = input;

  // 體表面積（標準人 BSA ≈ 1.7 m²）
  const bsa = calcBSA(heightCm, weightKg);
  const bsaFactor = bsa / 1.7; // 相對標準人的修正

  // 強度
  const { factor: intFactor, label: intensityLabel } = intensityFactor(powerW, speedKmh);

  // 各修正係數
  const tFactor = tempFactor(temperatureC);
  const hFactor = humidityFactor(humidityPct);
  const sFactor = solarFactor(weatherCode);
  const aBonusFactor = 1 + ascentBonus(ascentPerInterval, intervalSec);

  // 基礎汗液流失率 L/h（標準人、中等強度、20°C、60%濕度）
  const BASE_RATE_LPH = 0.8;

  // 最終汗液流失率 ml/h
  const sweatRatePerHour = Math.round(
    BASE_RATE_LPH * 1000 * bsaFactor * intFactor * tFactor * hFactor * sFactor * aBonusFactor
  );

  // 本次間隔流失量 ml
  const sweatLossMl = (sweatRatePerHour / 3600) * intervalSec;

  // 建議補水量：以每次流失量的 1.2 倍補充（補充流失 + 20% 緩衝）
  // 最少 150ml，最多 500ml
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
