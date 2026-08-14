import { describe, expect, it } from "vitest";
import { calculateSweatLoss } from "../lib/hydration-calc";
import { createSupplyPlan } from "../lib/smart-supply-plan";

const baseInput = {
  weightKg: 70,
  heightCm: 175,
  powerW: 180,
  ftpW: 240,
  speedKmh: 26,
  ascentPerInterval: 0,
  intervalSec: 10,
  temperatureC: 25,
  humidityPct: 60,
  weatherCode: 0,
  isDaylight: true,
  headwindMs: 2,
  precipitationProb: 0,
  ageYears: 32,
};

describe("smart hydration factors", () => {
  it("uses rider body size, FTP-derived intensity, terrain grade, weather, wind, daylight, and rainfall inputs", () => {
    const baseline = calculateSweatLoss({ ...baseInput, gradePct: 0 });
    const climb = calculateSweatLoss({ ...baseInput, gradePct: 8, ascentPerInterval: 8 });
    const coolWetNight = calculateSweatLoss({
      ...baseInput,
      gradePct: -6,
      temperatureC: 16,
      humidityPct: 50,
      weatherCode: 63,
      isDaylight: false,
      headwindMs: 5,
      precipitationProb: 90,
    });

    expect(climb.sweatRatePerHour).toBeGreaterThan(baseline.sweatRatePerHour);
    expect(coolWetNight.sweatRatePerHour).toBeLessThan(baseline.sweatRatePerHour);
  });

  it("shortens smart hydration intervals as a session becomes prolonged while retaining micro-sip tolerance", () => {
    const basePlan = createSupplyPlan({
      mode: "smart", calorieThresholdKcal: 300, waterThresholdMl: 500, elapsedSec: 30 * 60,
      riderWeightKg: 70, ftpW: 240, intensityFactor: 0.8, sweatRatePerHour: 900, environmentLoad: 0.55, weatherAvailable: true,
    });
    const longPlan = createSupplyPlan({
      mode: "smart", calorieThresholdKcal: 300, waterThresholdMl: 500, elapsedSec: 3 * 60 * 60,
      riderWeightKg: 70, ftpW: 240, intensityFactor: 0.8, sweatRatePerHour: 900, environmentLoad: 0.55, weatherAvailable: true,
    });

    expect(longPlan.waterTriggerMl).toBeLessThanOrEqual(basePlan.waterTriggerMl);
    expect(longPlan.waterRecommendationMl).toBe(basePlan.waterRecommendationMl);
    expect(longPlan.waterRecommendationMl).toBeGreaterThanOrEqual(150);
    expect(longPlan.waterRecommendationMl).toBeLessThanOrEqual(250);
    expect(longPlan.reason).toContain("長時間騎乘");
  });
});
