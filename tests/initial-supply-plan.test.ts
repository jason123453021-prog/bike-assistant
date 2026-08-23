import { describe, expect, it } from "vitest";

import { buildInitialSupplyPlanInput } from "../lib/initial-supply-plan";
import { createSupplyPlan } from "../lib/smart-supply-plan";

const baseContext = {
  mode: "smart" as const,
  sportType: "cycling" as const,
  calorieThresholdKcal: 300,
  waterThresholdMl: 500,
  riderWeightKg: 70,
  riderHeightCm: 175,
  riderAgeYears: 32,
  bikeWeightKg: 9,
  ftpW: 250,
  sweatRateCalibrationMultiplier: 1,
  energyServingCarbohydrateG: 30,
  energyCarbohydrateHourlyLimitMode: "science" as const,
  now: new Date("2026-08-23T05:00:00.000Z"),
};

describe("個人化首輪補給模型輸入", () => {
  it("以可信位置速度與快取天氣產生首輪汗率、環境負荷與強度，而非固定離線常數", () => {
    const offline = buildInitialSupplyPlanInput(baseContext);
    const live = buildInitialSupplyPlanInput({
      ...baseContext,
      snapshot: {
        speedMs: 8,
        headingDeg: 90,
        gradePct: 4,
        weather: {
          temperature: 34,
          humidity: 85,
          windSpeed: 12,
          windDirection: 90,
          precipitationProb: 0,
          weatherCode: 0,
          description: "晴天",
          forecast: [],
        },
      },
    });

    expect(offline.weatherAvailable).toBe(false);
    expect(live.weatherAvailable).toBe(true);
    expect(live.environmentLoad).toBeGreaterThan(offline.environmentLoad);
    expect(live.sweatRatePerHour).toBeGreaterThan(offline.sweatRatePerHour);
    expect(live.intensityFactor).toBeGreaterThan(0.45);
  });

  it("保留使用者體重、單包碳水與每小時上限設定，並在缺少快取資料時安全回退", () => {
    const input = buildInitialSupplyPlanInput({
      ...baseContext,
      riderWeightKg: 84,
      energyServingCarbohydrateG: 42,
      energyCarbohydrateHourlyLimitMode: "manual",
      energyCarbohydrateHourlyLimitG: 75,
      snapshot: { speedMs: Number.NaN, gradePct: Number.POSITIVE_INFINITY },
    });

    expect(input.elapsedSec).toBe(0);
    expect(input.riderWeightKg).toBe(84);
    expect(input.energyServingCarbohydrateG).toBe(42);
    expect(input.energyCarbohydrateHourlyLimitMode).toBe("manual");
    expect(input.energyCarbohydrateHourlyLimitG).toBe(75);
    expect(input.weatherAvailable).toBe(false);
    expect(input.environmentLoad).toBe(0);
  });

  it("在尚未移動的首輪，仍會以暖熱高濕天氣提前補水倒數", () => {
    const input = buildInitialSupplyPlanInput({
      ...baseContext,
      now: new Date("2026-08-23T14:15:00.000Z"),
      snapshot: {
        speedMs: 0,
        weather: {
          temperature: 26,
          humidity: 88,
          windSpeed: 4,
          windDirection: 0,
          precipitationProb: 0,
          weatherCode: 3,
          description: "多雲",
          forecast: [],
        },
      },
    });
    const plan = createSupplyPlan(input);

    expect(input.environmentLoad).toBeGreaterThanOrEqual(0.6);
    expect(plan.waterCountdownSec).toBeLessThanOrEqual(15 * 60);
    expect(plan.waterCountdownSec).toBeGreaterThanOrEqual(10 * 60);
  });
});
