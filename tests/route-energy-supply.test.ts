import { describe, expect, it } from "vitest";
import { estimateRouteEnergySupplyCarry } from "../lib/route-energy-supply";

describe("GPX route energy supply carry planning", () => {
  it("does not force in-ride energy servings for routes of one hour or less", () => {
    const plan = estimateRouteEnergySupplyCarry({
      estimatedDurationSeconds: 3600,
      upperDurationSeconds: 3900,
      intensityFactor: 0.7,
      totalAscentM: 100,
      distanceM: 20000,
    });
    expect(plan.minimumServings).toBe(0);
    expect(plan.maximumServings).toBe(0);
  });

  it("uses time, terrain, intensity and environmental load to provide a bounded carrying range", () => {
    const plan = estimateRouteEnergySupplyCarry({
      estimatedDurationSeconds: 3 * 3600,
      upperDurationSeconds: 4 * 3600,
      intensityFactor: 0.9,
      totalAscentM: 1200,
      distanceM: 60000,
      temperatureC: 32,
      humidityPct: 75,
      averageHeadwindMs: 4,
      precipitationProb: 65,
    });
    expect(plan.standardServingCarbohydrateG).toBe(25);
    expect(plan.minimumServings).toBeGreaterThan(0);
    expect(plan.maximumServings).toBeGreaterThan(plan.minimumServings);
    expect(plan.factors).toContain("爬升與坡度負荷");
    expect(plan.factors).toContain("高溫高濕熱負荷");
    expect(plan.factors).toContain("相對逆風");
    expect(plan.factors).toContain("降雨延誤備援");
  });

  it("converts the same carbohydrate requirement into fewer or more packages using the user serving size", () => {
    const input = {
      estimatedDurationSeconds: 3 * 3600,
      upperDurationSeconds: 4 * 3600,
      intensityFactor: 0.9,
      totalAscentM: 1200,
      distanceM: 60000,
    };
    const smallServing = estimateRouteEnergySupplyCarry({ ...input, energyServingCarbohydrateG: 20 });
    const largeServing = estimateRouteEnergySupplyCarry({ ...input, energyServingCarbohydrateG: 50 });

    expect(smallServing.standardServingCarbohydrateG).toBe(20);
    expect(largeServing.standardServingCarbohydrateG).toBe(50);
    expect(smallServing.minimumServings).toBeGreaterThan(largeServing.minimumServings);
    expect(smallServing.maximumServings).toBeGreaterThan(largeServing.maximumServings);
  });
});
