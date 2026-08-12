import { describe, expect, it } from "vitest";
import { createRouteFromRideRecord } from "../lib/history-route";
import type { RideRecord } from "../lib/ride-context";

const record: RideRecord = {
  id: "ride-1", date: 1_700_000_000_000, name: "河濱晨騎", duration: 3600,
  distance: 24_000, avgSpeed: 24, maxSpeed: 38, totalAscent: 150, calories: 700,
  avgPower: 0, maxPower: 0, powerZones: [], powerHistory: [], totalSweatMl: 600,
  refillCount: 1, totalPausedSec: 0,
  route: [
    { latitude: 25.03, longitude: 121.53, altitude: 10, speed: 0, timestamp: 1_700_000_000_000 },
    { latitude: 25.04, longitude: 121.54, altitude: 20, speed: 0, timestamp: 1_700_000_300_000 },
  ],
};

describe("createRouteFromRideRecord", () => {
  it("將本機歷史軌跡轉為導航路線並保留關鍵統計", () => {
    const route = createRouteFromRideRecord(record);
    expect(route).toMatchObject({ name: "河濱晨騎", totalDistance: 24000, totalAscent: 150, estimatedDuration: 3600 });
    expect(route?.points).toHaveLength(2);
    expect(route?.elevationProfile.at(-1)?.distance).toBe(24000);
  });

  it("拒絕沒有足夠軌跡點的紀錄", () => {
    expect(createRouteFromRideRecord({ ...record, route: [record.route[0]] })).toBeNull();
  });
});
