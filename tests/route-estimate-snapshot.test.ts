import { describe, expect, it } from "vitest";
import { buildRouteEstimateSnapshot } from "../lib/route-estimate-snapshot";
import type { GpxRoute } from "../lib/gpx-parser";

const route: GpxRoute = {
  name: "規劃路線",
  points: Array.from({ length: 40 }, (_, index) => ({ lat: 25 + index * 0.01, lon: 121 + index * 0.02, ele: 10 + index * 5 })),
  totalDistance: 90000,
  totalAscent: 195,
  totalDescent: 0,
  estimatedDuration: 14400,
  estimatedCalories: 0,
  elevationProfile: [], gradientDistribution: {}, avgGradient: 2, maxGradient: 5,
};

describe("route estimate snapshot", () => {
  it("uses one FTP and environment snapshot for time, calories and water", () => {
    const snapshot = buildRouteEstimateSnapshot({
      route, ftpW: 210, riderWeightKg: 70, bikeWeightKg: 10, heightCm: 175, ageYears: 35,
      temperatureC: 31, humidityPct: 75, windSpeedKmh: 15, windDirection: 90,
    });
    expect(snapshot.time.targetPowerW).toBeGreaterThan(0);
    expect(snapshot.estimatedCaloriesKcal).toBeGreaterThan(0);
    expect(snapshot.estimatedWaterLossMl).toBeGreaterThan(0);
    expect(snapshot.suggestedWaterMl).toBeGreaterThan(0);
    expect(snapshot.suggestedEnergyKcal).toBeGreaterThan(0);
    expect(snapshot.energySupplyCarry.minimumServings).toBeGreaterThan(0);
    expect(snapshot.energySupplyCarry.maximumServings).toBeGreaterThanOrEqual(snapshot.energySupplyCarry.minimumServings);
  });
});
