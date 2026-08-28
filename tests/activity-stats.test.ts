import { describe, expect, it } from "vitest";

import { calculateMonthlyStats, calculateRouteRankings } from "../lib/activity-stats";
import type { RideRecord } from "../lib/ride-context";

const baseRecord: RideRecord = {
  id: "stats-1",
  date: new Date(2026, 7, 10).getTime(),
  name: "河濱路線",
  duration: 3600,
  distance: 20_000,
  avgSpeed: 20,
  maxSpeed: 42,
  totalAscent: 250,
  maxElevation: 680,
  calories: 900,
  avgPower: 160,
  maxPower: 430,
  powerZones: [1, 2, 3, 4, 5],
  powerHistory: [],
  route: [],
  totalSweatMl: 700,
  refillCount: 1,
  totalPausedSec: 0,
};

describe("activity stats", () => {
  it("uses kilometres for summaries and actual elevation for highest elevation", () => {
    const stats = calculateMonthlyStats([baseRecord], 7, 2026);

    expect(stats.totalDistance).toBe(20);
    expect(stats.averageSpeed).toBe(20);
    expect(stats.averagePace).toBe(3);
    expect(stats.maxElevation).toBe(680);
  });

  it("uses kilometres for route ranking totals", () => {
    const rankings = calculateRouteRankings([baseRecord, { ...baseRecord, id: "stats-2" }]);
    expect(rankings[0].totalDistance).toBe(40);
  });
});
