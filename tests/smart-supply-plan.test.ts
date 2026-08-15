import { describe, expect, it } from "vitest";

import { createSupplyPlan } from "../lib/smart-supply-plan";

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
    expect(heatStress.energyRecommendationKcal).toBeGreaterThan(mild.energyRecommendationKcal);
    expect(heatStress.waterRecommendationMl).toBeGreaterThan(mild.waterRecommendationMl);
    expect(heatStress.carbohydrateRecommendationG).toBeLessThanOrEqual(90);
    expect(heatStress.waterRecommendationMl).toBeLessThanOrEqual(250);
    expect(heatStress.waterRecommendationMl).toBeGreaterThanOrEqual(150);
    expect(heatStress.waterTriggerMl).toBeLessThanOrEqual(250);
    expect(heatStress.waterTriggerMl).toBeGreaterThanOrEqual(100);
    expect(heatStress.waterCountdownSec).toBeLessThan(mild.waterCountdownSec);
    expect(heatStress.energyCountdownSec).toBeLessThan(mild.energyCountdownSec);
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
    expect(longHard.carbohydrateRecommendationG).toBeGreaterThanOrEqual(80);
    expect(longHard.carbohydrateRecommendationG).toBeLessThanOrEqual(90);
    expect(longHard.reason).toContain("全自動智慧計畫");
    expect(shortEasy.energyCountdownSec).toBeGreaterThanOrEqual(40 * 60);
    expect(longHard.energyCountdownSec).toBeLessThan(shortEasy.energyCountdownSec);
    expect(longHard.waterCountdownSec).toBeGreaterThanOrEqual(10 * 60);
    expect(longHard.waterCountdownSec).toBeLessThanOrEqual(15 * 60);
  });

  it("uses an explainable offline fallback when environment data is unavailable", () => {
    const plan = createSupplyPlan({ ...baseInput, mode: "smart", weatherAvailable: false });

    expect(plan.source).toBe("smart-offline-fallback");
    expect(plan.reason).toContain("離線");
    expect(plan.calorieTriggerKcal).toBeGreaterThan(0);
    expect(plan.waterTriggerMl).toBeGreaterThan(0);
  });
});
