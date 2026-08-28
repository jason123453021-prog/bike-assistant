import { describe, expect, it } from "vitest";
import { estimateRouteCompletionTime } from "../lib/route-time-estimator";
import type { GpxRoute } from "../lib/gpx-parser";

const route = (elevations: number[]): GpxRoute => ({
  name: "測試路線",
  points: elevations.map((ele, index) => ({ lat: 25, lon: 121 + index * 0.01, ele })),
  totalDistance: (elevations.length - 1) * 1010,
  totalAscent: Math.max(0, elevations.at(-1)! - elevations[0]),
  totalDescent: 0,
  estimatedDuration: 3600,
  estimatedCalories: 0,
  elevationProfile: [],
  gradientDistribution: {},
  avgGradient: 0,
  maxGradient: 0,
});

describe("route completion time estimator", () => {
  it("predicts a shorter moving duration when FTP is higher", () => {
    const input = { route: route([10, 20, 30, 40]), riderWeightKg: 70, bikeWeightKg: 10 };
    const low = estimateRouteCompletionTime({ ...input, ftpW: 150 });
    const high = estimateRouteCompletionTime({ ...input, ftpW: 250 });
    expect(high.estimatedDurationSeconds).toBeLessThan(low.estimatedDurationSeconds);
  });

  it("accounts for climbing and returns a conservative time range", () => {
    const flat = estimateRouteCompletionTime({ route: route([10, 10, 10, 10]), ftpW: 200, riderWeightKg: 70 });
    const climb = estimateRouteCompletionTime({ route: route([10, 80, 150, 220]), ftpW: 200, riderWeightKg: 70 });
    expect(climb.estimatedDurationSeconds).toBeGreaterThan(flat.estimatedDurationSeconds);
    expect(climb.lowerDurationSeconds).toBeLessThan(climb.estimatedDurationSeconds);
    expect(climb.upperDurationSeconds).toBeGreaterThan(climb.estimatedDurationSeconds);
  });
});
