import { describe, expect, it } from "vitest";

import {
  hasReliableRideMovement,
  MAX_RIDE_STATISTICS_ACCURACY_M,
  MIN_CYCLING_MOVEMENT_SPEED_KMH,
} from "../lib/live-ride-readings";
import {
  ASPHALT_CRR,
  calculateCalories,
  calculatePower,
  DEFAULT_CYCLING_MECHANICAL_EFFICIENCY,
  DEFAULT_ROAD_BIKE_MASS_KG,
  ROAD_CDA,
} from "../lib/power-calc";

describe("本機騎乘統計物理校正", () => {
  it("保留 30 m 內、1.08 km/h 以上的極低速爬坡樣本，並拒絕超過精度上限的資料", () => {
    expect(MAX_RIDE_STATISTICS_ACCURACY_M).toBe(30);
    expect(MIN_CYCLING_MOVEMENT_SPEED_KMH).toBe(1.08);
    expect(hasReliableRideMovement({ speedKmh: 1.08, distanceM: 0.8, accuracyM: 30 })).toBe(true);
    expect(hasReliableRideMovement({ speedKmh: 1.07, distanceM: 1.5, accuracyM: 30 })).toBe(false);
    expect(hasReliableRideMovement({ speedKmh: 0, distanceM: 31, accuracyM: 30 })).toBe(true);
    expect(hasReliableRideMovement({ speedKmh: 1.08, distanceM: 2, accuracyM: 30.1 })).toBe(false);
  });

  it("以標準公路車阻力參數計算可解釋的本機虛擬功率", () => {
    expect(ROAD_CDA).toBe(0.4);
    expect(ASPHALT_CRR).toBe(0.005);
    expect(DEFAULT_ROAD_BIKE_MASS_KG).toBe(9);

    const flatRoadPower = calculatePower({
      speedMs: 20 / 3.6,
      prevSpeedMs: 20 / 3.6,
      intervalSec: 3,
      gradePct: 0,
      windSpeedMs: 0,
      riderMassKg: 65,
    });
    const gentleClimbPower = calculatePower({
      speedMs: 20 / 3.6,
      prevSpeedMs: 20 / 3.6,
      intervalSec: 3,
      gradePct: 2,
      windSpeedMs: 0,
      riderMassKg: 65,
    });

    expect(flatRoadPower).toBeGreaterThan(50);
    expect(gentleClimbPower).toBeGreaterThan(flatRoadPower + 70);
    expect(gentleClimbPower).toBeLessThan(250);
  });

  it("以 21% 機械效率將 105 W 一小時換算為約 430 kcal", () => {
    expect(DEFAULT_CYCLING_MECHANICAL_EFFICIENCY).toBe(0.21);
    expect(calculateCalories(105, 3600)).toBeCloseTo(430.21, 1);
  });
});
