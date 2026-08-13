import { describe, expect, it } from "vitest";
import { deriveAutoPersonalMetrics } from "../lib/auto-personal-metrics";
import { estimateAutomaticRpe } from "../lib/automatic-rpe";

describe("automatic personal metrics", () => {
  it("uses conservative age baselines when recorded heart data is unavailable", () => {
    const result = deriveAutoPersonalMetrics([], { ftpW: 200, age: 40 });
    expect(result.maxHeartRate).toBe(180);
    expect(result.restingHeartRate).toBeGreaterThanOrEqual(45);
    expect(result.sources).toMatchObject({ ftp: "fallback", maxHeartRate: "age-baseline" });
  });

  it("keeps automatic RPE in a 1 to 10 range and increases with load", () => {
    const easy = estimateAutomaticRpe({ averagePowerW: 100, ftpW: 200, movingTimeSec: 1_800, distanceMeters: 10_000, totalAscentMeters: 80, powerSampleCount: 30 });
    const hard = estimateAutomaticRpe({ averagePowerW: 190, ftpW: 200, movingTimeSec: 7_200, distanceMeters: 60_000, totalAscentMeters: 1_400, temperatureC: 30, humidityPct: 80, powerSampleCount: 100 });
    expect(easy.value).toBeGreaterThanOrEqual(1);
    expect(hard.value).toBeGreaterThan(easy.value);
    expect(hard.confidence).toBe("high");
  });
});
