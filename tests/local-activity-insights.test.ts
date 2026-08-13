import { describe, expect, it } from "vitest";
import { buildLocalActivityHighlights, calculateBestPowerEfforts, calculateRideDayStreak, calculateWeeklyGoalProgress } from "../lib/local-activity-insights";
import type { RideRecord } from "../lib/ride-context";

function record(overrides: Partial<RideRecord> = {}): RideRecord {
  return {
    id: "ride-1",
    date: new Date("2026-08-12T09:00:00").getTime(),
    name: "測試騎乘",
    duration: 3600,
    movingTime: 3300,
    distance: 30000,
    avgSpeed: 30,
    maxSpeed: 40,
    totalAscent: 500,
    calories: 700,
    avgPower: 180,
    maxPower: 380,
    powerZones: [1, 2, 3, 4, 5],
    powerHistory: [100, 200, 300, 200, 100, 250, 350, 150],
    route: [],
    totalSweatMl: 0,
    refillCount: 0,
    totalPausedSec: 300,
    ...overrides,
  } as RideRecord;
}

describe("local activity insights", () => {
  it("calculates a weekly goal from local ride records", () => {
    const rides = [record(), record({ id: "ride-2", date: new Date("2026-08-11T10:00:00").getTime(), distance: 25000 })];
    const result = calculateWeeklyGoalProgress(rides, { rideTarget: 3, distanceTargetKm: 50 }, new Date("2026-08-12T12:00:00"));
    expect(result.rideCount).toBe(2);
    expect(result.distanceKm).toBe(55);
    expect(result.completed).toBe(true);
  });

  it("counts consecutive local ride days", () => {
    const rides = [record({ date: new Date("2026-08-12T09:00:00").getTime() }), record({ id: "ride-2", date: new Date("2026-08-11T09:00:00").getTime() })];
    expect(calculateRideDayStreak(rides, new Date("2026-08-12T18:00:00"))).toBe(2);
  });

  it("builds best power efforts only from collected power history", () => {
    expect(calculateBestPowerEfforts(record()).length).toBeGreaterThan(0);
    expect(calculateBestPowerEfforts(record({ powerHistory: [] }))).toEqual([]);
  });

  it("creates local achievements without using remote segment data", () => {
    const ride = record({ personalBests: [{ metric: "distance", label: "最長距離", value: 30, unit: "km" }] });
    expect(buildLocalActivityHighlights(ride, [ride], { rideTarget: 3, distanceTargetKm: 20 })[0]?.kind).toBe("personal-best");
  });
});
