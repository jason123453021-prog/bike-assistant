import { calculateSweatLoss } from "./hydration-calc";
import { calculatePersonalizedCalories } from "./personalized-ride-calculations";
import { createSupplyPlan } from "./smart-supply-plan";
import type { GpxRoute } from "./gpx-parser";
import { estimateRouteCompletionTime, type RouteTimeEstimate } from "./route-time-estimator";

export interface RoutePlanningPoint {
  pointIndex: number;
  distanceM: number;
  label: string;
  waterMl: number;
  energyKcal: number;
}

export interface RouteEstimateSnapshot {
  time: RouteTimeEstimate;
  estimatedCaloriesKcal: number;
  estimatedWaterLossMl: number;
  suggestedWaterMl: number;
  suggestedEnergyKcal: number;
  planningPoints: RoutePlanningPoint[];
  sourceLabel: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 路線規劃與騎乘中即時估算共用的核心輸入，所有結果均由同一 FTP、重量與環境快照導出。 */
export function buildRouteEstimateSnapshot(input: {
  route: GpxRoute;
  ftpW: number;
  riderWeightKg: number;
  bikeWeightKg: number;
  heightCm: number;
  ageYears: number;
  temperatureC?: number;
  humidityPct?: number;
  windSpeedKmh?: number;
  windDirection?: number;
  weatherCode?: number;
  precipitationProb?: number;
  sweatRateCalibrationMultiplier?: number;
}) : RouteEstimateSnapshot {
  const time = estimateRouteCompletionTime(input);
  const duration = time.estimatedDurationSeconds;
  const averageGrade = input.route.totalDistance > 0 ? (input.route.totalAscent / input.route.totalDistance) * 100 : 0;
  const calorie = calculatePersonalizedCalories({
    powerW: time.targetPowerW,
    hasMeasuredPower: false,
    speedKmh: time.movingAverageKmh,
    gradePct: averageGrade,
    riderWeightKg: input.riderWeightKg,
    ftpW: input.ftpW,
    intervalSec: duration,
    temperatureC: input.temperatureC,
    humidityPct: input.humidityPct,
    weatherCode: input.weatherCode,
    precipitationProb: input.precipitationProb,
    headwindMs: time.averageHeadwindMs,
  });
  const hydration = calculateSweatLoss({
    weightKg: input.riderWeightKg,
    heightCm: input.heightCm,
    powerW: time.targetPowerW,
    speedKmh: time.movingAverageKmh,
    ascentPerInterval: input.route.totalAscent,
    intervalSec: duration,
    temperatureC: input.temperatureC ?? 25,
    humidityPct: input.humidityPct,
    weatherCode: input.weatherCode,
    ftpW: input.ftpW,
    headwindMs: time.averageHeadwindMs,
    precipitationProb: input.precipitationProb,
    ageYears: input.ageYears,
    calibrationMultiplier: input.sweatRateCalibrationMultiplier,
  });
  const supply = createSupplyPlan({
    mode: "smart",
    calorieThresholdKcal: 300,
    waterThresholdMl: 500,
    elapsedSec: duration,
    riderWeightKg: input.riderWeightKg,
    ftpW: input.ftpW,
    intensityFactor: time.intensityFactor,
    sweatRatePerHour: hydration.sweatRatePerHour,
    environmentLoad: hydration.environmentLoad,
    weatherAvailable: input.temperatureC !== undefined,
  });
  const intervalSeconds = clamp(4200 - hydration.environmentLoad * 1200 - Math.max(0, time.intensityFactor - 0.65) * 800, 2700, 5400);
  const pointCount = Math.min(5, Math.floor(duration / intervalSeconds));
  const planningPoints = Array.from({ length: pointCount }, (_, index) => {
    const fraction = (index + 1) / (pointCount + 1);
    const pointIndex = Math.min(input.route.points.length - 1, Math.max(1, Math.round((input.route.points.length - 1) * fraction)));
    return {
      pointIndex,
      distanceM: input.route.totalDistance * fraction,
      label: `建議補給 ${index + 1}`,
      waterMl: supply.waterRecommendationMl,
      energyKcal: supply.energyRecommendationKcal,
    };
  });
  return {
    time,
    estimatedCaloriesKcal: Math.round(calorie.kcal),
    estimatedWaterLossMl: Math.round(hydration.sweatLossMl),
    suggestedWaterMl: supply.waterRecommendationMl,
    suggestedEnergyKcal: supply.energyRecommendationKcal,
    planningPoints,
    sourceLabel: "App 自動 FTP、體重、路線坡度、天氣與風向",
  };
}
