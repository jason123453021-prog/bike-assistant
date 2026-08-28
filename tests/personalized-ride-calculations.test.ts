import { describe, expect, it } from "vitest";

import {
  calculateAdaptiveHydrationThreshold,
  calculatePersonalizedCalories,
} from "../lib/personalized-ride-calculations";
import { analyzeTraining } from "../lib/tss-calc";
import { calculateSweatLoss } from "../lib/hydration-calc";

describe("personalized ride calculations", () => {
  it("uses the configured FTP for normalized-power intensity and TSS", () => {
    const history = Array.from({ length: 120 }, () => 200);
    const lowerFtp = analyzeTraining(3600, 200, 220, 180, history);
    const higherFtp = analyzeTraining(3600, 200, 220, 260, history);

    expect(lowerFtp.intensityFactor).toBeGreaterThan(higherFtp.intensityFactor);
    expect(lowerFtp.tss).toBeGreaterThan(higherFtp.tss);
  });

  it("raises calorie estimation under hotter, more humid and sunnier conditions while retaining a safe offline fallback", () => {
    const coolInput = {
      powerW: 180,
      hasMeasuredPower: true,
      speedKmh: 25,
      gradePct: 1,
      riderWeightKg: 65,
      ftpW: 240,
      intervalSec: 600,
      temperatureC: 18,
      humidityPct: 45,
      weatherCode: 3,
      precipitationProb: 0,
      headwindMs: 0,
    };
    const cool = calculatePersonalizedCalories(coolInput);
    const hotHumid = calculatePersonalizedCalories({
      ...coolInput,
      temperatureC: 34,
      humidityPct: 88,
      weatherCode: 0,
    });
    const offlineFallback = calculatePersonalizedCalories({
      powerW: 0,
      hasMeasuredPower: false,
      speedKmh: 22,
      gradePct: 5,
      riderWeightKg: 82,
      ftpW: 210,
      intervalSec: 600,
    });

    expect(hotHumid.kcal).toBeGreaterThan(cool.kcal);
    expect(offlineFallback.kcal).toBeGreaterThan(0);
    expect(offlineFallback.source).toBe("met-fallback");
  });

  it("uses FTP, body profile and weather load for water-loss rate and a more frequent heat-stress reminder threshold", () => {
    const mildInput = {
      weightKg: 65,
      heightCm: 170,
      ftpW: 250,
      powerW: 150,
      speedKmh: 24,
      ascentPerInterval: 3,
      intervalSec: 180,
      temperatureC: 20,
      humidityPct: 55,
      weatherCode: 3,
      headwindMs: 0,
      precipitationProb: 0,
    };
    const mild = calculateSweatLoss(mildInput);
    const heatStress = calculateSweatLoss({
      ...mildInput,
      powerW: 220,
      temperatureC: 34,
      humidityPct: 88,
      weatherCode: 0,
      headwindMs: 1,
    });
    const mildThreshold = calculateAdaptiveHydrationThreshold(600, mild);
    const heatThreshold = calculateAdaptiveHydrationThreshold(600, heatStress);

    expect(heatStress.sweatRatePerHour).toBeGreaterThan(mild.sweatRatePerHour);
    expect(heatThreshold).toBeLessThan(mildThreshold);
    expect(heatThreshold).toBeGreaterThanOrEqual(150);
  });
});
