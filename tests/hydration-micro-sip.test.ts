import { describe, expect, it } from "vitest";
import { calculateSweatLoss } from "../lib/hydration-calc";
import { createSupplyPlan } from "../lib/smart-supply-plan";

describe("智慧補水小量分次", () => {
  it("將每次汗率補水建議限制於 150–250 mL", () => {
    const lowSweat = calculateSweatLoss({
      weightKg: 52, heightCm: 160, powerW: 70, speedKmh: 12, ascentPerInterval: 0,
      intervalSec: 10, temperatureC: 14, humidityPct: 45, isDaylight: false,
    });
    const highSweat = calculateSweatLoss({
      weightKg: 90, heightCm: 190, powerW: 450, ftpW: 280, speedKmh: 37, ascentPerInterval: 12,
      gradePct: 12, intervalSec: 10, temperatureC: 36, humidityPct: 90, weatherCode: 0,
      isDaylight: true, headwindMs: 1, precipitationProb: 0,
    });

    expect(lowSweat.recommendedRefillMl).toBeGreaterThanOrEqual(150);
    expect(lowSweat.recommendedRefillMl).toBeLessThanOrEqual(250);
    expect(highSweat.recommendedRefillMl).toBe(250);
  });

  it("智慧模式不讀取手動門檻，並在溫和天氣的小量補水安全範圍內觸發節奏", () => {
    const plan = createSupplyPlan({
      mode: "smart",
      calorieThresholdKcal: 99_999,
      waterThresholdMl: 99_999,
      elapsedSec: 90 * 60,
      riderWeightKg: 72,
      ftpW: 245,
      intensityFactor: 0.86,
      sweatRatePerHour: 1_200,
      environmentLoad: 0.65,
      weatherAvailable: true,
    });

    expect(plan.waterRecommendationMl).toBeGreaterThanOrEqual(150);
    expect(plan.waterRecommendationMl).toBeLessThanOrEqual(200);
    expect(plan.waterTriggerMl).toBeGreaterThanOrEqual(100);
    expect(plan.waterTriggerMl).toBeLessThanOrEqual(250);
    expect(plan.reason).toContain("15–20 分鐘");
  });
});
