import { describe, expect, it } from "vitest";

import { createSupplyPlan, resolveCarbohydrateHourlyLimit } from "../lib/smart-supply-plan";

const baseInput = {
  calorieThresholdKcal: 360,
  waterThresholdMl: 600,
  elapsedSec: 7_200,
  riderWeightKg: 70,
  ftpW: 250,
  intensityFactor: 0.7,
  sweatRatePerHour: 650,
  environmentLoad: 0.1,
  weatherAvailable: true,
};

describe("smart supply plan", () => {
  it("keeps user-defined thresholds unchanged when custom mode is selected", () => {
    const plan = createSupplyPlan({ ...baseInput, mode: "custom" });

    expect(plan.calorieTriggerKcal).toBe(360);
    expect(plan.waterTriggerMl).toBe(600);
    expect(plan.source).toBe("custom");
    expect(plan.energyRecommendationKcal).toBeGreaterThan(0);
    expect(plan.waterRecommendationMl).toBeGreaterThanOrEqual(150);
  });

  it("raises each micro-sip amount under high intensity and heat stress without exceeding tolerance", () => {
    const mild = createSupplyPlan({ ...baseInput, mode: "smart" });
    const heatStress = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      intensityFactor: 1.03,
      sweatRatePerHour: 1_350,
      environmentLoad: 0.9,
    });

    expect(heatStress.calorieTriggerKcal).toBeLessThan(mild.calorieTriggerKcal);
    expect(heatStress.waterTriggerMl).toBeGreaterThan(mild.waterTriggerMl);
    expect(heatStress.energyRecommendationKcal).toBeGreaterThanOrEqual(mild.energyRecommendationKcal);
    expect(heatStress.waterRecommendationMl).toBeGreaterThan(mild.waterRecommendationMl);
    expect(heatStress.carbohydrateRecommendationG).toBeLessThanOrEqual(90);
    expect(heatStress.waterRecommendationMl).toBeLessThanOrEqual(250);
    expect(heatStress.waterRecommendationMl).toBeGreaterThanOrEqual(150);
    expect(heatStress.waterTriggerMl).toBeLessThanOrEqual(250);
    expect(heatStress.waterTriggerMl).toBeGreaterThanOrEqual(100);
    expect(heatStress.waterCountdownSec).toBeLessThan(mild.waterCountdownSec);
    expect(heatStress.energyCountdownSec).toBeLessThanOrEqual(mild.energyCountdownSec);
  });

  it("keeps smart triggers independent from any manual custom thresholds", () => {
    const normalManualValues = createSupplyPlan({ ...baseInput, mode: "smart" });
    const invalidManualValues = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      calorieThresholdKcal: 30_000,
      waterThresholdMl: 300_000,
    });

    expect(invalidManualValues.calorieTriggerKcal).toBe(normalManualValues.calorieTriggerKcal);
    expect(invalidManualValues.waterTriggerMl).toBe(normalManualValues.waterTriggerMl);
    expect(invalidManualValues.energyRecommendationKcal).toBe(normalManualValues.energyRecommendationKcal);
    expect(invalidManualValues.waterRecommendationMl).toBe(normalManualValues.waterRecommendationMl);
  });

  it("scales automatic carbohydrate guidance by duration and intensity without user-entered targets", () => {
    const shortEasy = createSupplyPlan({ ...baseInput, mode: "smart", elapsedSec: 30 * 60, intensityFactor: 0.5 });
    const longHard = createSupplyPlan({ ...baseInput, mode: "smart", elapsedSec: 4 * 60 * 60, intensityFactor: 1.05, environmentLoad: 0.8 });

    expect(shortEasy.carbohydrateRecommendationG).toBe(0);
    expect(longHard.carbohydrateRecommendationG).toBe(50);
    expect(longHard.carbohydrateRecommendationG).toBeLessThanOrEqual(longHard.carbohydrateHourlyLimitG);
    expect(longHard.carbohydrateHourlyLimitMode).toBe("science");
    expect(longHard.reason).toContain("全自動智慧計畫");
    expect(shortEasy.energyCountdownSec).toBeGreaterThanOrEqual(40 * 60);
    expect(longHard.energyCountdownSec).toBeLessThan(shortEasy.energyCountdownSec);
    expect(longHard.waterCountdownSec).toBeGreaterThanOrEqual(10 * 60);
    expect(longHard.waterCountdownSec).toBeLessThanOrEqual(30 * 60);
  });

  it("將每輪補水倒數限制在 10–30 分鐘，並以環境基礎區間、汗率、強度與時長動態修正", () => {
    const coldEasy = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      elapsedSec: 0,
      intensityFactor: 0.45,
      sweatRatePerHour: 350,
      environmentLoad: 0,
      temperatureC: 10,
      humidityPct: 70,
      weatherCode: 61,
    });
    const temperate = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      elapsedSec: 0,
      intensityFactor: 0.7,
      sweatRatePerHour: 650,
      environmentLoad: 0.2,
      temperatureC: 25,
      humidityPct: 60,
      weatherCode: 3,
    });
    const hotHardLong = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      elapsedSec: 3 * 60 * 60,
      intensityFactor: 1.25,
      sweatRatePerHour: 1_800,
      environmentLoad: 1,
      temperatureC: 32,
      humidityPct: 82,
      weatherCode: 0,
    });

    expect(coldEasy.waterCountdownSec).toBeGreaterThanOrEqual(20 * 60);
    expect(coldEasy.waterCountdownSec).toBeLessThanOrEqual(30 * 60);
    expect(temperate.waterCountdownSec).toBeGreaterThanOrEqual(15 * 60);
    expect(temperate.waterCountdownSec).toBeLessThanOrEqual(20 * 60);
    expect(hotHardLong.waterCountdownSec).toBeGreaterThanOrEqual(10 * 60);
    expect(hotHardLong.waterCountdownSec).toBeLessThanOrEqual(15 * 60);
    expect(hotHardLong.waterCountdownSec).toBeLessThan(temperate.waterCountdownSec);
  });

  it("首輪只採環境與預設汗率，首輪斷網則採 10 分鐘安全值", () => {
    const humidFirstRound = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      elapsedSec: 0,
      intensityFactor: 0.45,
      sweatRatePerHour: 550,
      environmentLoad: 0.65,
      weatherAvailable: true,
      temperatureC: 26,
      humidityPct: 88,
      weatherCode: 3,
      isFirstWaterCountdown: true,
    });
    const offlineFirstRound = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      elapsedSec: 0,
      intensityFactor: 1.25,
      sweatRatePerHour: 1_800,
      environmentLoad: 1,
      weatherAvailable: false,
      isFirstWaterCountdown: true,
    });

    expect(humidFirstRound.waterCountdownSec).toBeGreaterThanOrEqual(10 * 60);
    expect(humidFirstRound.waterCountdownSec).toBeLessThanOrEqual(15 * 60);
    expect(offlineFirstRound.waterCountdownSec).toBe(10 * 60);
  });

  it("uses the user-selected carbohydrate per serving to schedule the next energy countdown", () => {
    const smallServing = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      energyServingCarbohydrateG: 20,
    });
    const largeServing = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      energyServingCarbohydrateG: 50,
    });

    expect(largeServing.energyCountdownSec).toBeGreaterThan(smallServing.energyCountdownSec);
    expect(smallServing.reason).toContain("單包 20 g 碳水");
    expect(largeServing.reason).toContain("單包 50 g 碳水");
  });

  it("uses body mass for a conservative scientific hourly ceiling without forcing extra intake", () => {
    const lightRider = resolveCarbohydrateHourlyLimit({ riderWeightKg: 50, energyCarbohydrateHourlyLimitMode: "science" });
    const largerRider = resolveCarbohydrateHourlyLimit({ riderWeightKg: 90, energyCarbohydrateHourlyLimitMode: "science" });
    const shortEasy = createSupplyPlan({ ...baseInput, mode: "smart", elapsedSec: 30 * 60, intensityFactor: 0.5, riderWeightKg: 90 });

    expect(lightRider.gramsPerHour).toBe(35);
    expect(largerRider.gramsPerHour).toBe(65);
    expect(shortEasy.carbohydrateRecommendationG).toBe(0);
  });

  it("caps the smart target and next countdown with the manual hourly carbohydrate limit", () => {
    const plan = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      elapsedSec: 4 * 60 * 60,
      intensityFactor: 1.05,
      environmentLoad: 0.8,
      energyServingCarbohydrateG: 30,
      energyCarbohydrateHourlyLimitMode: "manual",
      energyCarbohydrateHourlyLimitG: 30,
    });

    expect(plan.carbohydrateHourlyLimitMode).toBe("manual");
    expect(plan.carbohydrateHourlyLimitG).toBe(30);
    expect(plan.carbohydrateRecommendationG).toBe(30);
    expect(plan.energyCountdownSec).toBe(60 * 60);
    expect(plan.reason).toContain("每小時上限 30 g，手動設定");
  });

  it("uses an explainable offline fallback when environment data is unavailable", () => {
    const plan = createSupplyPlan({ ...baseInput, mode: "smart", weatherAvailable: false });

    expect(plan.source).toBe("smart-offline-fallback");
    expect(plan.reason).toContain("本機環境基準");
    expect(plan.calorieTriggerKcal).toBeGreaterThan(0);
    expect(plan.waterTriggerMl).toBeGreaterThan(0);
  });
});
