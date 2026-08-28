import { describe, expect, it } from "vitest";
import { calculateMonthlySportStats, calculateWeeklySportStats, filterRecordsBySport } from "../lib/activity-stats";
import type { RideRecord } from "../lib/ride-context";

function record(id: string, sportType: RideRecord["sportType"], date: number, distance: number): RideRecord {
  return {
    id, date, name: id, sportType, duration: 1800, distance, avgSpeed: 10, maxSpeed: 14,
    totalAscent: 100, calories: 200, avgPower: 0, maxPower: 0, powerZones: [], powerHistory: [],
    route: [], totalSweatMl: 0, refillCount: 0, totalPausedSec: 0,
  };
}

describe("multi-sport weekly and monthly statistics", () => {
  const now = new Date("2026-08-14T12:00:00Z");
  const rides = [
    record("run", "running", new Date("2026-08-13T12:00:00Z").getTime(), 5_000),
    record("trail", "trail_running", new Date("2026-08-12T12:00:00Z").getTime(), 7_000),
    record("cycle", "cycling", new Date("2026-08-10T12:00:00Z").getTime(), 20_000),
  ];

  it("keeps sport records isolated while retaining legacy cycling default", () => {
    expect(filterRecordsBySport(rides, "running").map((ride) => ride.id)).toEqual(["run"]);
    expect(calculateWeeklySportStats(rides, "running", now).totalDistance).toBe(5);
    expect(calculateWeeklySportStats(rides, "cycling", now).rideCount).toBe(1);
  });

  it("calculates selected month stats for each sport", () => {
    const monthlyTrail = calculateMonthlySportStats(rides, "trail_running", 7, 2026);
    expect(monthlyTrail.totalDistance).toBe(7);
    expect(monthlyTrail.totalElevation).toBe(100);
  });
});
