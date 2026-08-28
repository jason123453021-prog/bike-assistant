import { describe, expect, it } from "vitest";
import { buildLocalTrainingLog, shiftTrainingLogMonth } from "../lib/local-training-log";
import type { RideRecord } from "../lib/ride-context";

const createRide = (date: number, distance: number, tss = 0): RideRecord => ({
  id: `${date}`, date, name: "測試騎乘", duration: 3600, distance, avgSpeed: 20, maxSpeed: 30,
  totalAscent: 120, calories: 400, avgPower: 0, maxPower: 0, powerZones: [], powerHistory: [],
  route: [], totalSweatMl: 0, refillCount: 0, totalPausedSec: 0, tss,
});

describe("buildLocalTrainingLog", () => {
  it("以週一為每週起點，彙整同日騎乘的距離與 TSS", () => {
    const log = buildLocalTrainingLog([
      createRide(new Date(2026, 7, 3, 9).getTime(), 12000, 50),
      createRide(new Date(2026, 7, 3, 18).getTime(), 8000, 25),
    ], 2026, 7);
    const day = log.days.find((item) => item?.dayNumber === 3);

    expect(log.days).toHaveLength(42);
    expect(day).toMatchObject({ rideCount: 2, totalDistanceKm: 20, totalTss: 75 });
  });

  it("可安全跨年度切換月分", () => {
    const shifted = shiftTrainingLogMonth(new Date(2026, 0, 1), -1);
    expect(shifted.getFullYear()).toBe(2025);
    expect(shifted.getMonth()).toBe(11);
  });
});
