import { describe, expect, it } from "vitest";
import { buildActivityChartAxis } from "../lib/activity-chart-axis";
import { deriveLocalEstimationCalibration } from "../lib/activity-estimation-calibration";

describe("activity chart basis and local calibration", () => {
  it("creates time and distance axes from recorded data", () => {
    const points = [
      { timestamp: 1_000, distanceKm: 0 },
      { timestamp: 61_000, distanceKm: 2.5 },
      { timestamp: 181_000, distanceKm: 6 },
    ];
    expect(buildActivityChartAxis(points, "time")).toMatchObject({ startLabel: "0:00", endLabel: "0:03" });
    expect(buildActivityChartAxis(points, "distance")).toMatchObject({ startLabel: "0.0 km", endLabel: "6.0 km" });
  });

  it("uses only long local rides with declared RPE for conservative calibration", () => {
    const records = Array.from({ length: 4 }, (_, index) => ({
      id: `${index}`,
      date: index,
      name: "本機騎乘",
      duration: 1_800,
      distance: 10_000,
      avgSpeed: 20,
      maxSpeed: 30,
      totalAscent: 100,
      calories: 400,
      avgPower: 150,
      maxPower: 220,
      powerZones: [0, 0, 0, 0, 0],
      powerHistory: [],
      route: [],
      totalSweatMl: 0,
      refillCount: 0,
      totalPausedSec: 0,
      perceivedExertion: 8,
    }));
    const result = deriveLocalEstimationCalibration(records, 200);
    expect(result.rpeSampleCount).toBe(4);
    expect(result.confidence).toBe("medium");
    expect(result.intensityAdjustment).toBeGreaterThan(0);
  });
});
