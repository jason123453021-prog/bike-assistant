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

  it("brings reminders forward and raises suggestion amounts under high intensity and heat stress", () => {
    const mild = createSupplyPlan({ ...baseInput, mode: "smart" });
    const heatStress = createSupplyPlan({
      ...baseInput,
      mode: "smart",
      intensityFactor: 1.03,
      sweatRatePerHour: 1_350,
      environmentLoad: 0.9,
    });

    expect(heatStress.calorieTriggerKcal).toBeLessThan(mild.calorieTriggerKcal);
    expect(heatStress.waterTriggerMl).toBeLessThan(mild.waterTriggerMl);
    expect(heatStress.energyRecommendationKcal).toBeGreaterThan(mild.energyRecommendationKcal);
    expect(heatStress.waterRecommendationMl).toBeGreaterThan(mild.waterRecommendationMl);
    expect(heatStress.carbohydrateRecommendationG).toBeLessThanOrEqual(90);
    expect(heatStress.waterRecommendationMl).toBeLessThanOrEqual(500);
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
  });

  it("uses an explainable offline fallback when environment data is unavailable", () => {
    const plan = createSupplyPlan({ ...baseInput, mode: "smart", weatherAvailable: false });

    expect(plan.source).toBe("smart-offline-fallback");
    expect(plan.reason).toContain("離線");
    expect(plan.calorieTriggerKcal).toBeGreaterThan(0);
    expect(plan.waterTriggerMl).toBeGreaterThan(0);
  });
});
