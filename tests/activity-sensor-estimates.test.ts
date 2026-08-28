import { describe, expect, it } from "vitest";
import { buildActivitySensorAnalysis } from "../lib/activity-sensor-estimates";

const profile = { ftpW: 220, age: 35, maxHeartRate: 185, restingHeartRate: 58, temperatureC: 29, humidityPct: 72, headwindMs: 2 };

describe("activity sensor estimates", () => {
  it("derives deterministic local heart-rate and cadence trends when sensors are absent", () => {
    const result = buildActivitySensorAnalysis([
      { timestamp: 1, speedKmh: 12, gradePct: 1 },
      { timestamp: 2, speedKmh: 24, gradePct: 5 },
      { timestamp: 3, speedKmh: 0, gradePct: 0 },
    ], profile);

    expect(result.sources).toEqual({ speed: "measured", power: "estimated", heartRate: "estimated", cadence: "estimated" });
    expect(result.points[1].powerW).toBeGreaterThan(result.points[0].powerW);
    expect(result.points[1].heartRate).toBeGreaterThan(result.points[0].heartRate);
    expect(result.points[1].cadence).toBeGreaterThan(45);
    expect(result.points[2].cadence).toBe(0);
  });

  it("preserves recorded sensor points while using estimates only to fill unavailable values", () => {
    const result = buildActivitySensorAnalysis([
      { timestamp: 1, speedKmh: 22, powerW: 180, heartRate: 142, cadence: 88 },
      { timestamp: 2, speedKmh: 23, powerW: 190 },
    ], profile);

    expect(result.sources).toEqual({ speed: "measured", power: "estimated", heartRate: "measured", cadence: "measured" });
    expect(result.points[0].heartRate).toBe(142);
    expect(result.points[0].cadence).toBe(88);
    expect(result.points[1].heartRate).toBeGreaterThan(58);
    expect(result.points[1].cadence).toBeGreaterThan(45);
  });

  it("keeps estimates within safe human-readable ranges", () => {
    const result = buildActivitySensorAnalysis([{ timestamp: 1, speedKmh: 70, gradePct: 40 }], profile);
    expect(result.points[0].heartRate).toBeLessThanOrEqual(profile.maxHeartRate);
    expect(result.points[0].cadence).toBeLessThanOrEqual(115);
    expect(result.points[0].powerW).toBeLessThanOrEqual(900);
  });
});
