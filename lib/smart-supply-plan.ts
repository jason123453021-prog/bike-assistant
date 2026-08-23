import { getSportModelProfile, type GovernedSportType } from "./model-governance";

export type SupplyCalculationMode = "smart" | "custom";
export type EnergyCarbohydrateHourlyLimitMode = "science" | "manual";

export interface SupplyPlanInput {
  mode: SupplyCalculationMode;
  /** 未提供時保留舊版單車相容行為。 */
  sportType?: GovernedSportType;
  /** 僅供舊版固定模式相容；智慧模式不讀取此值。 */
  calorieThresholdKcal?: number;
  /** 僅供舊版固定模式相容；智慧模式不讀取此值。 */
  waterThresholdMl?: number;
  elapsedSec: number;
  riderWeightKg: number;
  ftpW: number;
  intensityFactor: number;
  sweatRatePerHour: number;
  environmentLoad: number;
  weatherAvailable: boolean;
  /** 使用者單包能量補給可提供的碳水克數，用於推導下一次能量倒數。 */
  energyServingCarbohydrateG?: number;
  /** 每小時碳水上限可採科學建議或由使用者手動指定。 */
  energyCarbohydrateHourlyLimitMode?: EnergyCarbohydrateHourlyLimitMode;
  energyCarbohydrateHourlyLimitG?: number;
}

export interface SupplyPlan {
  calorieTriggerKcal: number;
  waterTriggerMl: number;
  /** 智慧模式下，下次補能量提醒的倒數秒數。 */
  energyCountdownSec: number;
  /** 智慧模式下，下次補水提醒的倒數秒數。 */
  waterCountdownSec: number;
  energyRecommendationKcal: number;
  carbohydrateRecommendationG: number;
  /** 套用科學建議或手動設定後的每小時碳水上限。 */
  carbohydrateHourlyLimitG: number;
  carbohydrateHourlyLimitMode: EnergyCarbohydrateHourlyLimitMode;
  waterRecommendationMl: number;
  source: "smart" | "smart-offline-fallback" | "custom";
  reason: string;
}

const SMART_ENERGY_TRIGGER_RANGE = { min: 160, max: 280 } as const;
// 觸發量依約 12.5 分鐘的估計汗液流失拆分；它是單次小口補充量，不是一次大量飲水量。
const SMART_WATER_TRIGGER_RANGE = { min: 100, max: 250 } as const;
const SMART_WATER_RECOMMENDATION_RANGE = { min: 150, max: 250 } as const;
const MICRO_SIP_INTERVAL_MINUTES = 12.5;
// 低負荷可延至 30 分鐘；高汗率、強度、熱負荷或長時間騎乘會逐步提前至 10 分鐘。
const SMART_WATER_COUNTDOWN_RANGE_SEC = { min: 10 * 60, max: 30 * 60 } as const;
// 耐力活動超過一小時開始主動補碳水；以 30–60 g/h 的分次策略轉成不帶量化處方的提醒節奏。
const SMART_ENERGY_COUNTDOWN_RANGE_SEC = { min: 30 * 60, max: 60 * 60 } as const;

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
 * 科學建議模式以約 0.7 g/kg/h 作保守上緣，再收斂至 30–90 g/h 的實用範圍。
 * 實際目標仍由時長、強度與運動類型推導；此值只負責限制上限，不會強制增加攝取量。
 */
export function resolveCarbohydrateHourlyLimit(input: Pick<SupplyPlanInput,
  "riderWeightKg" | "energyCarbohydrateHourlyLimitMode" | "energyCarbohydrateHourlyLimitG"
>): { mode: EnergyCarbohydrateHourlyLimitMode; gramsPerHour: number } {
  const mode = input.energyCarbohydrateHourlyLimitMode === "manual" ? "manual" : "science";
  if (mode === "manual") {
    return { mode, gramsPerHour: clamp(Math.round(Number(input.energyCarbohydrateHourlyLimitG) || 60), 20, 90) };
  }
  const weightKg = clamp(Number(input.riderWeightKg) || 70, 35, 150);
  return { mode, gramsPerHour: clamp(Math.round((weightKg * 0.7) / 5) * 5, 30, 90) };
}

/**
 * 將既有的科學化補給模型轉為下一次提醒的時間。
 * 補水倒數維持 10–30 分鐘：低負荷延長以減少不必要提示，高汗率、強度、熱負荷與長時段會提前。
 * 能量則依每小時碳水目標推導，保守維持 30–60 分鐘提醒，避免以單次大量補給取代規律分次。
 */
function deriveCountdowns(
  elapsedSec: number,
  intensity: number,
  sweatRatePerHour: number,
  environmentLoad: number,
  carbohydrateGPerHour: number,
  energyServingCarbohydrateG: number,
): { energyCountdownSec: number; waterCountdownSec: number } {
  const intensityLoad = clamp((intensity - 0.6) / 0.55, 0, 1);
  const sweatLoad = clamp((sweatRatePerHour - 350) / 1_450, 0, 1);
  const durationLoad = elapsedSec >= 3 * 60 * 60 ? 1 : elapsedSec >= 2 * 60 * 60 ? 0.6 : elapsedSec >= 60 * 60 ? 0.25 : 0;
  const waterCountdownSec = Math.round(clamp(
    30 * 60 - sweatLoad * 10 * 60 - intensityLoad * 4 * 60 - environmentLoad * 4 * 60 - durationLoad * 2 * 60,
    SMART_WATER_COUNTDOWN_RANGE_SEC.min,
    SMART_WATER_COUNTDOWN_RANGE_SEC.max,
  ));
  const energyCountdownSec = carbohydrateGPerHour <= 0
    ? SMART_ENERGY_COUNTDOWN_RANGE_SEC.max
    : Math.round(clamp(
        (energyServingCarbohydrateG / Math.max(1, carbohydrateGPerHour)) * 3600,
        20 * 60,
        75 * 60,
      ));
  return { energyCountdownSec, waterCountdownSec };
}

/**
 * 產生單次補給提醒的門檻與建議量。智慧模式僅以個人、騎乘及環境資料動態推導，
 * 補水倒數會依負荷維持於每 10–30 分鐘，而每次仍提供 150–250 mL 的可耐受小量建議；
 * 固定模式僅保留舊版資料相容。
 */
export function createSupplyPlan(input: SupplyPlanInput): SupplyPlan {
  const sportProfile = getSportModelProfile(input.sportType ?? "cycling");
  const intensity = clamp(input.intensityFactor, 0, 1.25);
  const environmentLoad = clamp(input.environmentLoad, 0, 1);
  const sweatRate = clamp(input.sweatRatePerHour, 350, 1_800);
  const carbohydrateHourlyLimit = resolveCarbohydrateHourlyLimit(input);
  const carbohydrateModelTargetG = carbohydrateTargetGPerHour(input.elapsedSec, intensity, environmentLoad)
    * sportProfile.supply.carbohydrateRateMultiplier;
  const carbohydrateG = Math.min(carbohydrateModelTargetG, carbohydrateHourlyLimit.gramsPerHour);
  const energyServingCarbohydrateG = clamp(
    Number(input.energyServingCarbohydrateG) || 25,
    10,
    100,
  );
  const energyRecommendationKcal = Math.round(carbohydrateG * 4);
  const durationHydrationLoad = input.elapsedSec >= 3 * 60 * 60 ? 0.08 : input.elapsedSec >= 2 * 60 * 60 ? 0.05 : input.elapsedSec >= 60 * 60 ? 0.02 : 0;
  const waterRecommendationMl = Math.round(clamp(
    sweatRate * sportProfile.supply.hydrationRateMultiplier * (MICRO_SIP_INTERVAL_MINUTES / 60),
    SMART_WATER_RECOMMENDATION_RANGE.min,
    SMART_WATER_RECOMMENDATION_RANGE.max,
  ));

  if (input.mode === "custom") {
    const calorieBase = clamp(Math.round(input.calorieThresholdKcal || 300), 100, 2_000);
    const waterBase = clamp(Math.round(input.waterThresholdMl || 500), 150, 3_000);
    return {
      calorieTriggerKcal: calorieBase,
      waterTriggerMl: waterBase,
      energyCountdownSec: SMART_ENERGY_COUNTDOWN_RANGE_SEC.max,
      waterCountdownSec: SMART_WATER_COUNTDOWN_RANGE_SEC.max,
      energyRecommendationKcal,
      carbohydrateRecommendationG: carbohydrateG,
      carbohydrateHourlyLimitG: carbohydrateHourlyLimit.gramsPerHour,
      carbohydrateHourlyLimitMode: carbohydrateHourlyLimit.mode,
      waterRecommendationMl,
      source: "custom",
      reason: "使用自訂固定門檻；建議量只供補給規劃參考。",
    };
  }

  const intensityLoad = clamp((intensity - 0.6) / 0.55, 0, 1);
  const durationEnergyLoad = input.elapsedSec >= 3 * 60 * 60 ? 0.08 : input.elapsedSec >= 2 * 60 * 60 ? 0.05 : 0;
  const smartEnergyTriggerKcal = Math.round(clamp(
    260 - intensityLoad * 48 - environmentLoad * 28 - durationEnergyLoad * 180,
    SMART_ENERGY_TRIGGER_RANGE.min,
    SMART_ENERGY_TRIGGER_RANGE.max,
  ));
  const smartWaterTriggerMl = Math.round(clamp(
    // 汗率 × 約 12.5 分鐘，再依熱負荷／長時段稍微提前提醒。
    sweatRate * sportProfile.supply.hydrationRateMultiplier * (MICRO_SIP_INTERVAL_MINUTES / 60) * (1 - environmentLoad * 0.12 - durationHydrationLoad),
    SMART_WATER_TRIGGER_RANGE.min,
    SMART_WATER_TRIGGER_RANGE.max,
  ));
  const source = input.weatherAvailable ? "smart" : "smart-offline-fallback";
  const { energyCountdownSec, waterCountdownSec } = deriveCountdowns(
    input.elapsedSec,
    intensity,
    sweatRate,
    environmentLoad,
    carbohydrateG,
    energyServingCarbohydrateG,
  );
  const reasonParts = [
    `全自動智慧計畫（單包 ${energyServingCarbohydrateG} g 碳水；每小時上限 ${carbohydrateHourlyLimit.gramsPerHour} g${carbohydrateHourlyLimit.mode === "science" ? "，科學建議" : "，手動設定"}；補水約每 10–30 分鐘）`,
    intensityLoad >= 0.3 ? "騎乘強度較高" : "騎乘強度一般",
    environmentLoad >= 0.4 ? "環境熱負荷提高" : input.weatherAvailable ? "環境負荷穩定" : "本機環境基準",
    input.elapsedSec >= 2 * 60 * 60 ? "長時間騎乘" : "騎乘時間尚短",
  ];

  return {
    // 智慧模式永遠只由個人、騎乘與環境資料決定；絕不讀取手動自訂門檻。
    calorieTriggerKcal: smartEnergyTriggerKcal,
    waterTriggerMl: smartWaterTriggerMl,
    energyCountdownSec,
    waterCountdownSec,
    energyRecommendationKcal,
    carbohydrateRecommendationG: carbohydrateG,
    carbohydrateHourlyLimitG: carbohydrateHourlyLimit.gramsPerHour,
    carbohydrateHourlyLimitMode: carbohydrateHourlyLimit.mode,
    waterRecommendationMl,
    source,
    reason: reasonParts.join("；"),
  };
}
