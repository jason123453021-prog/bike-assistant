import {
  getSportModelProfile,
  type GovernedSportType,
} from "./model-governance";

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
  /** 即時環境資料可用時，以明確溫／濕度建立補水基礎區間。 */
  temperatureC?: number;
  humidityPct?: number;
  weatherCode?: number;
  /** 即時坡度由已平滑的 GPS 高程資料鏈提供；只影響智慧補水建議，不會突破天氣安全區間。 */
  gradePct?: number;
  /** 本輪累計暫停僅供下一輪補水重排使用；能量倒數不讀取此值。 */
  pausedDuringRoundSec?: number;
  /** 首輪不以尚未形成的功率／時長資料修正，只採環境與預設汗率。 */
  isFirstWaterCountdown?: boolean;
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
// 每輪都限制在 10–30 分鐘；補水倒數只由溫度與濕度決定。
const SMART_WATER_COUNTDOWN_RANGE_SEC = { min: 10 * 60, max: 30 * 60 } as const;
// 耐力活動超過一小時開始主動補碳水；以 30–60 g/h 的分次策略轉成不帶量化處方的提醒節奏。
const SMART_ENERGY_COUNTDOWN_RANGE_SEC = {
  min: 30 * 60,
  max: 60 * 60,
} as const;
// 既有智慧推導在低／高碳水目標下實際允許 20–75 分鐘；恢復權重不得縮窄既有行為。
const SMART_ENERGY_COUNTDOWN_ALLOWED_RANGE_SEC = {
  min: 20 * 60,
  max: 75 * 60,
} as const;
type WaterClimateBand = "hot" | "temperate" | "cold";

export interface WaterCountdownBounds {
  minSec: number;
  maxSec: number;
  climateBand: WaterClimateBand;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * v2 起，能量與補水倒數均以絕對時間持續計時；能量的下一輪不再套用暫停補償。
 * 此函式保留為舊本機資料呼叫相容，且必定回傳未調整的原計畫。
 */
export function applyPausedRecoveryToNextSupplyPlan(
  plan: SupplyPlan,
  _pausedDuringRoundSec: number,
): SupplyPlan {
  return plan;
}

/** v2 起不再將暫停轉換成能量倒數延長秒數。 */
export function calculatePausedRecoveryExtensionSec(
  _pausedDuringRoundSec: number,
): number {
  return 0;
}

function carbohydrateTargetGPerHour(
  elapsedSec: number,
  intensityFactor: number,
  environmentLoad: number,
): number {
  // 依耐力運動時長與相對強度分層：短時低強度不強制進食；> 1 小時起逐步進入 30–60 g/h，
  // 長時間且高強度時才接近 90 g/h，避免沒有腸胃適應時過度補給。
  if (elapsedSec < 45 * 60) return intensityFactor >= 0.9 ? 20 : 0;
  if (elapsedSec < 2 * 60 * 60) {
    return intensityFactor < 0.6
      ? 20
      : intensityFactor < 0.75
        ? 30
        : intensityFactor < 0.9
          ? 45
          : 60;
  }
  const base =
    intensityFactor < 0.6
      ? 35
      : intensityFactor < 0.75
        ? 50
        : intensityFactor < 0.9
          ? 65
          : 80;
  const durationBonus =
    elapsedSec >= 4 * 60 * 60 ? 10 : elapsedSec >= 3 * 60 * 60 ? 5 : 0;
  const heatBonus = environmentLoad >= 0.7 && intensityFactor >= 0.75 ? 5 : 0;
  return clamp(base + durationBonus + heatBonus, 20, 90);
}

/**
 * 科學建議模式以約 0.7 g/kg/h 作保守上緣，再收斂至 30–90 g/h 的實用範圍。
 * 實際目標仍由時長、強度與運動類型推導；此值只負責限制上限，不會強制增加攝取量。
 */
export function resolveCarbohydrateHourlyLimit(
  input: Pick<
    SupplyPlanInput,
    | "riderWeightKg"
    | "energyCarbohydrateHourlyLimitMode"
    | "energyCarbohydrateHourlyLimitG"
  >,
): { mode: EnergyCarbohydrateHourlyLimitMode; gramsPerHour: number } {
  const mode =
    input.energyCarbohydrateHourlyLimitMode === "manual" ? "manual" : "science";
  if (mode === "manual") {
    return {
      mode,
      gramsPerHour: clamp(
        Math.round(Number(input.energyCarbohydrateHourlyLimitG) || 60),
        20,
        90,
      ),
    };
  }
  const weightKg = clamp(Number(input.riderWeightKg) || 70, 35, 150);
  return {
    mode,
    gramsPerHour: clamp(Math.round((weightKg * 0.7) / 5) * 5, 30, 90),
  };
}

/**
 * 將既有的科學化補給模型轉為下一次提醒的時間。
 * 補水先由 FTP、體重、強度、時長、坡度、環境、汗率與本輪暫停進行重排，
 * 再由當前溫濕度帶硬性箝制在安全時間窗內；能量則依每小時碳水目標推導。
 * 能量則依每小時碳水目標推導，保守維持 30–60 分鐘提醒，避免以單次大量補給取代規律分次。
 */
export function resolveWaterCountdownBounds(
  input: Pick<
    SupplyPlanInput,
    "weatherAvailable" | "temperatureC" | "humidityPct"
  >,
): WaterCountdownBounds {
  const cold = {
    minSec: 20 * 60,
    maxSec: 30 * 60,
    climateBand: "cold" as const,
  };
  const temperate = {
    minSec: 15 * 60,
    maxSec: 20 * 60,
    climateBand: "temperate" as const,
  };
  const hot = { minSec: 10 * 60, maxSec: 15 * 60, climateBand: "hot" as const };
  if (!input.weatherAvailable || !Number.isFinite(Number(input.temperatureC))) {
    return temperate;
  }

  const temperatureC = Number(input.temperatureC);
  const humidityPct = clamp(Number(input.humidityPct) || 60, 0, 100);
  if (temperatureC <= 15) return cold;
  if (temperatureC >= 30 || humidityPct >= 85) return hot;
  if (temperatureC < 20) {
    const ratio = (temperatureC - 15) / 5;
    return {
      minSec: Math.round(
        cold.minSec + (temperate.minSec - cold.minSec) * ratio,
      ),
      maxSec: Math.round(
        cold.maxSec + (temperate.maxSec - cold.maxSec) * ratio,
      ),
      climateBand: "temperate",
    };
  }
  if (temperatureC > 28) {
    const ratio = (temperatureC - 28) / 2;
    return {
      minSec: Math.round(
        temperate.minSec + (hot.minSec - temperate.minSec) * ratio,
      ),
      maxSec: Math.round(
        temperate.maxSec + (hot.maxSec - temperate.maxSec) * ratio,
      ),
      climateBand: "temperate",
    };
  }
  return temperate;
}

function calculateWaterEffortLoad(
  input: Pick<
    SupplyPlanInput,
    | "elapsedSec"
    | "riderWeightKg"
    | "ftpW"
    | "intensityFactor"
    | "sweatRatePerHour"
    | "environmentLoad"
    | "gradePct"
  >,
): number {
  const intensityLoad = clamp(
    ((Number(input.intensityFactor) || 0.6) - 0.45) / 0.8,
    0,
    1,
  );
  const sweatLoad = clamp(
    ((Number(input.sweatRatePerHour) || 650) - 350) / 1_450,
    0,
    1,
  );
  const durationLoad = clamp(
    (Number(input.elapsedSec) || 0) / (4 * 60 * 60),
    0,
    1,
  );
  const gradeLoad = clamp(Math.max(0, Number(input.gradePct) || 0) / 10, 0, 1);
  const environmentLoad = clamp(Number(input.environmentLoad) || 0, 0, 1);
  const riderMassLoad = clamp(
    ((Number(input.riderWeightKg) || 70) - 55) / 55,
    0,
    1,
  );
  const ftpLoad = clamp(((Number(input.ftpW) || 245) - 160) / 220, 0, 1);
  return clamp(
    intensityLoad * 0.26 +
      sweatLoad * 0.22 +
      durationLoad * 0.14 +
      gradeLoad * 0.12 +
      environmentLoad * 0.12 +
      riderMassLoad * 0.07 +
      ftpLoad * 0.07,
    0,
    1,
  );
}

function resolveSmartWaterRecommendationMl(
  input: Pick<
    SupplyPlanInput,
    | "weatherAvailable"
    | "temperatureC"
    | "humidityPct"
    | "elapsedSec"
    | "riderWeightKg"
    | "ftpW"
    | "intensityFactor"
    | "sweatRatePerHour"
    | "environmentLoad"
    | "gradePct"
    | "sportType"
  >,
): number {
  const { climateBand } = resolveWaterCountdownBounds(input);
  const effortLoad = calculateWaterEffortLoad(input);
  const sportProfile = getSportModelProfile(input.sportType ?? "cycling");
  const minimum = climateBand === "temperate" ? 150 : 100;
  const maximum = climateBand === "temperate" ? 200 : 150;
  const sportAdjustedLoad = clamp(
    effortLoad * sportProfile.supply.hydrationRateMultiplier,
    0,
    1,
  );
  return Math.round(minimum + (maximum - minimum) * sportAdjustedLoad);
}

function deriveCountdowns(
  input: Pick<
    SupplyPlanInput,
    | "elapsedSec"
    | "intensityFactor"
    | "weatherAvailable"
    | "temperatureC"
    | "humidityPct"
    | "riderWeightKg"
    | "ftpW"
    | "sweatRatePerHour"
    | "environmentLoad"
    | "gradePct"
    | "pausedDuringRoundSec"
  >,
  carbohydrateGPerHour: number,
  energyServingCarbohydrateG: number,
): { energyCountdownSec: number; waterCountdownSec: number } {
  const waterBounds = resolveWaterCountdownBounds(input);
  const midpointSec = (waterBounds.minSec + waterBounds.maxSec) / 2;
  const effortLoad = calculateWaterEffortLoad(input);
  const pauseRecoveryLoad = clamp(
    (Number(input.pausedDuringRoundSec) || 0) / (15 * 60),
    0,
    1,
  );
  const rawWaterCountdownSec =
    midpointSec -
    (waterBounds.maxSec - waterBounds.minSec) *
      (effortLoad * 0.55 - pauseRecoveryLoad * 0.2);
  const waterCountdownSec = Math.round(
    clamp(rawWaterCountdownSec, waterBounds.minSec, waterBounds.maxSec),
  );
  const energyCountdownSec =
    carbohydrateGPerHour <= 0
      ? SMART_ENERGY_COUNTDOWN_RANGE_SEC.max
      : Math.round(
          clamp(
            (energyServingCarbohydrateG / Math.max(1, carbohydrateGPerHour)) *
              3600,
            20 * 60,
            75 * 60,
          ),
        );
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
  const carbohydrateModelTargetG =
    carbohydrateTargetGPerHour(input.elapsedSec, intensity, environmentLoad) *
    sportProfile.supply.carbohydrateRateMultiplier;
  const carbohydrateG = Math.min(
    carbohydrateModelTargetG,
    carbohydrateHourlyLimit.gramsPerHour,
  );
  const energyServingCarbohydrateG = clamp(
    Number(input.energyServingCarbohydrateG) || 25,
    10,
    100,
  );
  const energyRecommendationKcal = Math.round(carbohydrateG * 4);
  const waterRecommendationMl = Math.round(
    clamp(
      sweatRate *
        sportProfile.supply.hydrationRateMultiplier *
        (MICRO_SIP_INTERVAL_MINUTES / 60),
      SMART_WATER_RECOMMENDATION_RANGE.min,
      SMART_WATER_RECOMMENDATION_RANGE.max,
    ),
  );

  if (input.mode === "custom") {
    const calorieBase = clamp(
      Math.round(input.calorieThresholdKcal || 300),
      100,
      2_000,
    );
    const waterBase = clamp(
      Math.round(input.waterThresholdMl || 500),
      150,
      3_000,
    );
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
  const durationEnergyLoad =
    input.elapsedSec >= 3 * 60 * 60
      ? 0.08
      : input.elapsedSec >= 2 * 60 * 60
        ? 0.05
        : 0;
  const smartEnergyTriggerKcal = Math.round(
    clamp(
      260 -
        intensityLoad * 48 -
        environmentLoad * 28 -
        durationEnergyLoad * 180,
      SMART_ENERGY_TRIGGER_RANGE.min,
      SMART_ENERGY_TRIGGER_RANGE.max,
    ),
  );
  const smartWaterTriggerMl = Math.round(
    clamp(
      // 建議量可持續以汗率估算，但倒數時間不受它影響。
      sweatRate *
        sportProfile.supply.hydrationRateMultiplier *
        (MICRO_SIP_INTERVAL_MINUTES / 60),
      SMART_WATER_TRIGGER_RANGE.min,
      SMART_WATER_TRIGGER_RANGE.max,
    ),
  );
  const source = input.weatherAvailable ? "smart" : "smart-offline-fallback";
  const { energyCountdownSec, waterCountdownSec } = deriveCountdowns(
    {
      elapsedSec: input.elapsedSec,
      intensityFactor: intensity,
      weatherAvailable: input.weatherAvailable,
      temperatureC: input.temperatureC,
      humidityPct: input.humidityPct,
      riderWeightKg: input.riderWeightKg,
      ftpW: input.ftpW,
      sweatRatePerHour: sweatRate,
      environmentLoad,
      gradePct: input.gradePct,
      pausedDuringRoundSec: input.pausedDuringRoundSec,
    },
    carbohydrateG,
    energyServingCarbohydrateG,
  );
  const smartWaterRecommendationMl = resolveSmartWaterRecommendationMl({
    weatherAvailable: input.weatherAvailable,
    temperatureC: input.temperatureC,
    humidityPct: input.humidityPct,
    elapsedSec: input.elapsedSec,
    riderWeightKg: input.riderWeightKg,
    ftpW: input.ftpW,
    intensityFactor: intensity,
    sweatRatePerHour: sweatRate,
    environmentLoad,
    gradePct: input.gradePct,
    sportType: input.sportType,
  });
  const waterBounds = resolveWaterCountdownBounds(input);
  const reasonParts = [
    `全自動智慧計畫（單包 ${energyServingCarbohydrateG} g 碳水；每小時上限 ${carbohydrateHourlyLimit.gramsPerHour} g${carbohydrateHourlyLimit.mode === "science" ? "，科學建議" : "，手動設定"}；補水 ${Math.round(waterCountdownSec / 60)} 分鐘，嚴格限制於 ${Math.round(waterBounds.minSec / 60)}–${Math.round(waterBounds.maxSec / 60)} 分鐘）`,
    `補水重排綜合 FTP、體重、強度、時長、坡度、環境、汗率與暫停；目前溫度 ${Number.isFinite(Number(input.temperatureC)) ? Math.round(Number(input.temperatureC)) : "—"}°C、濕度 ${Number.isFinite(Number(input.humidityPct)) ? Math.round(Number(input.humidityPct)) : "—"}% 僅用於安全區間箝制`,
  ];
  if (waterBounds.climateBand === "hot") {
    reasonParts.push("單次建議 100–150 mL，建議搭配電解質或鹽錠");
  }

  return {
    // 智慧模式永遠只由個人、騎乘與環境資料決定；絕不讀取手動自訂門檻。
    calorieTriggerKcal: smartEnergyTriggerKcal,
    waterTriggerMl: Math.round(
      clamp(
        smartWaterRecommendationMl,
        SMART_WATER_TRIGGER_RANGE.min,
        SMART_WATER_TRIGGER_RANGE.max,
      ),
    ),
    energyCountdownSec,
    waterCountdownSec,
    energyRecommendationKcal,
    carbohydrateRecommendationG: carbohydrateG,
    carbohydrateHourlyLimitG: carbohydrateHourlyLimit.gramsPerHour,
    carbohydrateHourlyLimitMode: carbohydrateHourlyLimit.mode,
    waterRecommendationMl: smartWaterRecommendationMl,
    source,
    reason: reasonParts.join("；"),
  };
}
