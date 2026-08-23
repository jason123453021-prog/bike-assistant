import { calculateSweatLoss } from "./hydration-calc";
import { calcAirDensity, calculatePower, DEFAULT_ROAD_BIKE_MASS_KG } from "./power-calc";
import type { SupplyPlanInput } from "./smart-supply-plan";
import { getHeadwindMs, type WeatherData } from "./weather-service";

export interface InitialSupplySnapshot {
  /** 以可信的最近定位樣本提供；沒有或不可靠時為 undefined。 */
  speedMs?: number | null;
  /** GPS 已提供行進方向時才使用，避免將未知方向誤判成北向。 */
  headingDeg?: number | null;
  /** 僅使用已平滑的目前坡度；沒有連續點位時保留 0。 */
  gradePct?: number | null;
  weather?: WeatherData | null;
}

export interface InitialSupplyPlanContext {
  mode: SupplyPlanInput["mode"];
  sportType: NonNullable<SupplyPlanInput["sportType"]>;
  calorieThresholdKcal: number;
  waterThresholdMl: number;
  riderWeightKg: number;
  riderHeightCm: number;
  riderAgeYears: number;
  bikeWeightKg?: number;
  ftpW: number;
  sweatRateCalibrationMultiplier?: number;
  energyServingCarbohydrateG?: number;
  energyCarbohydrateHourlyLimitMode?: SupplyPlanInput["energyCarbohydrateHourlyLimitMode"];
  energyCarbohydrateHourlyLimitG?: number;
  snapshot?: InitialSupplySnapshot;
  now?: Date;
}

function finite(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * 將騎乘開始前已可取得的個人、位置與快取天氣資料，轉成與騎乘中相同的補給模型輸入。
 * 不等待第一筆追蹤點：可信資料不足時只回退至中性離線基準，避免以舊或猜測資料放大提醒。
 */
export function buildInitialSupplyPlanInput(context: InitialSupplyPlanContext): SupplyPlanInput {
  const snapshot = context.snapshot;
  const weather = snapshot?.weather ?? null;
  const speedMs = clamp(finite(snapshot?.speedMs, 0), 0, 25);
  const speedKmh = speedMs * 3.6;
  const gradePct = clamp(finite(snapshot?.gradePct, 0), -20, 20);
  const hasHeading = typeof snapshot?.headingDeg === "number" && Number.isFinite(snapshot.headingDeg);
  const headwindMs = weather && hasHeading
    ? getHeadwindMs(snapshot.headingDeg as number, weather.windDirection, weather.windSpeed)
    : 0;
  const isCycling = context.sportType === "cycling";
  const virtualPowerW = isCycling
    ? calculatePower({
        speedMs,
        gradePct,
        windSpeedMs: headwindMs,
        riderMassKg: context.riderWeightKg,
        bikeMassKg: context.bikeWeightKg ?? DEFAULT_ROAD_BIKE_MASS_KG,
        airDensityKgM3: calcAirDensity(weather?.temperature ?? 20, weather?.humidity ?? 60),
      })
    : 0;
  const intensityFactor = isCycling
    ? clamp(virtualPowerW / Math.max(1, context.ftpW), 0.45, 1.25)
    : 1;
  const now = context.now ?? new Date();
  const sweat = calculateSweatLoss({
    weightKg: context.riderWeightKg,
    heightCm: context.riderHeightCm,
    powerW: virtualPowerW,
    speedKmh,
    ascentPerInterval: 0,
    gradePct,
    intervalSec: 60,
    temperatureC: weather?.temperature ?? 20,
    humidityPct: weather?.humidity ?? 60,
    weatherCode: weather?.weatherCode ?? 3,
    isDaylight: now.getHours() >= 6 && now.getHours() < 18,
    ftpW: context.ftpW,
    headwindMs,
    precipitationProb: weather?.precipitationProb ?? 0,
    ageYears: context.riderAgeYears,
    calibrationMultiplier: context.sweatRateCalibrationMultiplier,
    environmentSource: weather ? "live-weather" : "offline-baseline",
  });

  return {
    mode: context.mode,
    sportType: context.sportType,
    calorieThresholdKcal: context.calorieThresholdKcal,
    waterThresholdMl: context.waterThresholdMl,
    elapsedSec: 0,
    riderWeightKg: context.riderWeightKg,
    ftpW: context.ftpW,
    intensityFactor,
    sweatRatePerHour: sweat.sweatRatePerHour,
    environmentLoad: sweat.environmentLoad,
    weatherAvailable: Boolean(weather),
    temperatureC: weather?.temperature,
    humidityPct: weather?.humidity,
    weatherCode: weather?.weatherCode,
    isFirstWaterCountdown: true,
    energyServingCarbohydrateG: context.energyServingCarbohydrateG,
    energyCarbohydrateHourlyLimitMode: context.energyCarbohydrateHourlyLimitMode,
    energyCarbohydrateHourlyLimitG: context.energyCarbohydrateHourlyLimitG,
  };
}
