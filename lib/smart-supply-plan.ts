export type SupplyCalculationMode = "smart" | "custom";

export interface SupplyPlanInput {
  mode: SupplyCalculationMode;
  calorieThresholdKcal: number;
  waterThresholdMl: number;
  elapsedSec: number;
  riderWeightKg: number;
  ftpW: number;
  intensityFactor: number;
  sweatRatePerHour: number;
  environmentLoad: number;
  weatherAvailable: boolean;
}

export interface SupplyPlan {
  calorieTriggerKcal: number;
  waterTriggerMl: number;
  energyRecommendationKcal: number;
  carbohydrateRecommendationG: number;
  waterRecommendationMl: number;
  source: "smart" | "smart-offline-fallback" | "custom";
  reason: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function carbohydrateTargetGPerHour(elapsedSec: number, intensityFactor: number, environmentLoad: number): number {
  if (elapsedSec < 60 * 60) return 20;
  const base = intensityFactor < 0.6 ? 25 : intensityFactor < 0.75 ? 35 : intensityFactor < 0.9 ? 50 : 65;
  const durationBonus = elapsedSec >= 3 * 60 * 60 ? 10 : elapsedSec >= 2 * 60 * 60 ? 5 : 0;
  const heatBonus = environmentLoad >= 0.7 && intensityFactor >= 0.75 ? 5 : 0;
  return clamp(base + durationBonus + heatBonus, 20, 90);
}

/**
 * 產生單次補給提醒的門檻與建議量。智慧模式只在既有個人與環境資料上做保守修正；
 * 固定模式完整尊重使用者自訂門檻，僅提供不超出安全範圍的顯示建議。
 */
export function createSupplyPlan(input: SupplyPlanInput): SupplyPlan {
  const calorieBase = Math.max(100, Math.round(input.calorieThresholdKcal || 300));
  const waterBase = Math.max(150, Math.round(input.waterThresholdMl || 500));
  const intensity = clamp(input.intensityFactor, 0, 1.25);
  const environmentLoad = clamp(input.environmentLoad, 0, 1);
  const sweatRate = clamp(input.sweatRatePerHour, 350, 1_800);
  const carbohydrateG = carbohydrateTargetGPerHour(input.elapsedSec, intensity, environmentLoad);
  const energyRecommendationKcal = Math.round(carbohydrateG * 4);
  const waterRecommendationMl = Math.round(clamp(
    sweatRate * (0.18 + environmentLoad * 0.08 + Math.max(0, intensity - 0.65) * 0.05),
    150,
    500,
  ));

  if (input.mode === "custom") {
    return {
      calorieTriggerKcal: calorieBase,
      waterTriggerMl: waterBase,
      energyRecommendationKcal,
      carbohydrateRecommendationG: carbohydrateG,
      waterRecommendationMl,
      source: "custom",
      reason: "使用自訂固定門檻；建議量只供補給規劃參考。",
    };
  }

  const intensityLoad = clamp((intensity - 0.6) / 0.55, 0, 1);
  const sweatLoad = clamp((sweatRate - 550) / 1_000, 0, 1);
  const energyReduction = clamp(Math.max(intensityLoad * 0.16, environmentLoad * 0.12), 0, 0.25);
  const waterReduction = clamp(Math.max(sweatLoad * 0.2, environmentLoad * 0.25), 0, 0.3);
  const source = input.weatherAvailable ? "smart" : "smart-offline-fallback";
  const reasonParts = [
    intensityLoad >= 0.3 ? "騎乘強度較高" : "騎乘強度一般",
    environmentLoad >= 0.4 ? "環境熱負荷提高" : input.weatherAvailable ? "環境負荷穩定" : "離線環境回退",
  ];

  return {
    calorieTriggerKcal: Math.max(Math.round(calorieBase * 0.7), Math.round(calorieBase * (1 - energyReduction))),
    waterTriggerMl: Math.max(150, Math.round(waterBase * (1 - waterReduction))),
    energyRecommendationKcal,
    carbohydrateRecommendationG: carbohydrateG,
    waterRecommendationMl,
    source,
    reason: reasonParts.join("；"),
  };
}
