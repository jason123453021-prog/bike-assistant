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

const SMART_ENERGY_TRIGGER_RANGE = { min: 160, max: 280 } as const;
const SMART_WATER_TRIGGER_RANGE = { min: 180, max: 420 } as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function carbohydrateTargetGPerHour(elapsedSec: number, intensityFactor: number, environmentLoad: number): number {
  // 依耐力運動時長與相對強度分層：短時低強度不強制進食；> 1 小時起逐步進入 30–60 g/h，
  // 長時間且高強度時才接近 90 g/h，避免沒有腸胃適應時過度補給。
  if (elapsedSec < 45 * 60) return intensityFactor >= 0.9 ? 20 : 0;
  if (elapsedSec < 2 * 60 * 60) {
    return intensityFactor < 0.6 ? 20 : intensityFactor < 0.75 ? 30 : intensityFactor < 0.9 ? 45 : 60;
  }
  const base = intensityFactor < 0.6 ? 35 : intensityFactor < 0.75 ? 50 : intensityFactor < 0.9 ? 65 : 80;
  const durationBonus = elapsedSec >= 4 * 60 * 60 ? 10 : elapsedSec >= 3 * 60 * 60 ? 5 : 0;
  const heatBonus = environmentLoad >= 0.7 && intensityFactor >= 0.75 ? 5 : 0;
  return clamp(base + durationBonus + heatBonus, 20, 90);
}

/**
 * 產生單次補給提醒的門檻與建議量。智慧模式只在既有個人與環境資料上做保守修正；
 * 固定模式完整尊重使用者自訂門檻，僅提供不超出安全範圍的顯示建議。
 */
export function createSupplyPlan(input: SupplyPlanInput): SupplyPlan {
  const calorieBase = clamp(Math.round(input.calorieThresholdKcal || 300), 100, 2_000);
  const waterBase = clamp(Math.round(input.waterThresholdMl || 500), 150, 3_000);
  const intensity = clamp(input.intensityFactor, 0, 1.25);
  const environmentLoad = clamp(input.environmentLoad, 0, 1);
  const sweatRate = clamp(input.sweatRatePerHour, 350, 1_800);
  const carbohydrateG = carbohydrateTargetGPerHour(input.elapsedSec, intensity, environmentLoad);
  const energyRecommendationKcal = Math.round(carbohydrateG * 4);
  const durationHydrationLoad = input.elapsedSec >= 3 * 60 * 60 ? 0.08 : input.elapsedSec >= 2 * 60 * 60 ? 0.05 : input.elapsedSec >= 60 * 60 ? 0.02 : 0;
  const waterRecommendationMl = Math.round(clamp(
    sweatRate * (0.18 + environmentLoad * 0.08 + Math.max(0, intensity - 0.65) * 0.05 + durationHydrationLoad),
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
  const durationEnergyLoad = input.elapsedSec >= 3 * 60 * 60 ? 0.08 : input.elapsedSec >= 2 * 60 * 60 ? 0.05 : 0;
  const smartEnergyTriggerKcal = Math.round(clamp(
    260 - intensityLoad * 48 - environmentLoad * 28 - durationEnergyLoad * 180,
    SMART_ENERGY_TRIGGER_RANGE.min,
    SMART_ENERGY_TRIGGER_RANGE.max,
  ));
  const smartWaterTriggerMl = Math.round(clamp(
    400 - sweatLoad * 120 - environmentLoad * 85 - durationHydrationLoad * 600,
    SMART_WATER_TRIGGER_RANGE.min,
    SMART_WATER_TRIGGER_RANGE.max,
  ));
  const source = input.weatherAvailable ? "smart" : "smart-offline-fallback";
  const reasonParts = [
    "全自動智慧計畫",
    intensityLoad >= 0.3 ? "騎乘強度較高" : "騎乘強度一般",
    environmentLoad >= 0.4 ? "環境熱負荷提高" : input.weatherAvailable ? "環境負荷穩定" : "離線環境回退",
    input.elapsedSec >= 2 * 60 * 60 ? "長時間騎乘" : "騎乘時間尚短",
  ];

  return {
    // 智慧模式永遠只由個人、騎乘與環境資料決定；絕不讀取手動自訂門檻。
    calorieTriggerKcal: smartEnergyTriggerKcal,
    waterTriggerMl: smartWaterTriggerMl,
    energyRecommendationKcal,
    carbohydrateRecommendationG: carbohydrateG,
    waterRecommendationMl,
    source,
    reason: reasonParts.join("；"),
  };
}
