import { calculateCalories, calculateCaloriesMET } from "./power-calc";
import type { HydrationResult } from "./hydration-calc";

export interface PersonalizedCalorieInput {
  powerW: number;
  hasMeasuredPower: boolean;
  speedKmh: number;
  gradePct: number;
  riderWeightKg: number;
  ftpW: number;
  intervalSec: number;
  temperatureC?: number;
  humidityPct?: number;
  weatherCode?: number;
  precipitationProb?: number;
  headwindMs?: number;
}

export interface PersonalizedCalorieResult {
  kcal: number;
  source: "power" | "met-fallback";
  intensityFactor: number;
  environmentFactor: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function thermalEnvironmentFactor(input: PersonalizedCalorieInput): number {
  const temperature = input.temperatureC ?? 25;
  const humidity = input.humidityPct ?? 60;
  const weatherCode = input.weatherCode ?? 3;
  const heatFactor = Math.max(0, temperature - 20) * 0.0075;
  const humidityFactor = Math.max(0, humidity - 60) * 0.0025;
  const solarFactor = weatherCode <= 2 ? 0.02 : 0;
  return clamp(1 + heatFactor + humidityFactor + solarFactor, 0.95, 1.22);
}

/**
 * 在有功率資料時以功率／機械效率為主；缺乏功率時以體重、速度與坡度的 MET 回退。
 * 高溫、濕度與日照只反映額外熱調節代謝，不重複計入已由功率量測到的爬坡或逆風工作。
 */
export function calculatePersonalizedCalories(input: PersonalizedCalorieInput): PersonalizedCalorieResult {
  const ftpW = Math.max(1, input.ftpW || input.riderWeightKg * 3.5);
  const intensityFactor = clamp(Math.max(0, input.powerW) / ftpW, 0, 1.5);
  const environmentFactor = thermalEnvironmentFactor(input);
  const hasUsablePower = input.hasMeasuredPower && input.powerW > 0;

  if (hasUsablePower) {
    // 本機預設以 21% 機械效率由外部作功反推代謝能量；避免對未量測的熱調節成本重複計入坡度或風阻。
    const efficiency = 0.21;
    const baseKcal = calculateCalories(input.powerW, input.intervalSec, efficiency);
    return {
      kcal: baseKcal * environmentFactor,
      source: "power",
      intensityFactor,
      environmentFactor,
    };
  }

  const windLoad = Math.max(0, input.headwindMs ?? 0) * 0.018;
  const slopeLoad = Math.max(0, input.gradePct) * 0.012;
  const fallbackKcal = calculateCaloriesMET(
    Math.max(0, input.speedKmh),
    Math.max(1, input.riderWeightKg),
    input.intervalSec,
    input.gradePct,
  );
  return {
    kcal: fallbackKcal * clamp(1 + windLoad + slopeLoad, 1, 1.25) * environmentFactor,
    source: "met-fallback",
    intensityFactor,
    environmentFactor,
  };
}

/** 高熱、潮濕及高強度狀態下提前補水；仍不低於可安全辨識的 150 ml。 */
export function calculateAdaptiveHydrationThreshold(baseThresholdMl: number, hydration: HydrationResult): number {
  const base = Math.max(150, baseThresholdMl || 250);
  const rateLoad = clamp((hydration.sweatRatePerHour - 500) / 1500, 0, 1);
  const heatLoad = clamp(hydration.environmentLoad ?? 0, 0, 1);
  const reduction = Math.max(rateLoad * 0.2, heatLoad * 0.25);
  return Math.max(150, Math.round(base * (1 - reduction)));
}

/** 高熱／高濕或高強度時提早能量提醒；維持使用者設定的至少 70%。 */
export function calculateAdaptiveCalorieThreshold(baseThresholdKcal: number, result: PersonalizedCalorieResult): number {
  const base = Math.max(100, baseThresholdKcal || 300);
  const intensityLoad = clamp((result.intensityFactor - 0.65) / 0.65, 0, 1);
  const environmentLoad = clamp((result.environmentFactor - 1) / 0.22, 0, 1);
  return Math.max(Math.round(base * 0.7), Math.round(base * (1 - Math.max(intensityLoad * 0.12, environmentLoad * 0.15))));
}
