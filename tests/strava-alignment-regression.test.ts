import { describe, expect, it } from "vitest";
import {
  calculateRouteDistance,
  calculateRouteMovingTime,
  normalizeRideRecord,
} from "../lib/ride-record-normalizer";

const longitudeForMeters = (meters: number) => meters / 111_195;

describe("Strava 公開統計原則對齊", () => {
  it("保留 30 秒內連續 GPS 區間的距離與移動時間，避免背景合併交付造成均速偏高", () => {
    const route = [
      { latitude: 0, longitude: 0, altitude: 10, speed: 10, timestamp: 1_000 },
      { latitude: 0, longitude: longitudeForMeters(200), altitude: 10, speed: 10, timestamp: 21_000 },
      { latitude: 0, longitude: longitudeForMeters(400), altitude: 10, speed: 10, timestamp: 41_000 },
    ];
    expect(calculateRouteDistance(route)).toBeCloseTo(400, 0);
    expect(calculateRouteMovingTime(route)).toBe(40);

    const record = normalizeRideRecord({
      id: "continuous-30-second-route",
      distance: 360,
      duration: 35,
      totalPausedSec: 0,
      route,
    });
    expect(record?.distance).toBeCloseTo(400, 0);
    expect(record?.movingTime).toBe(40);
    expect(record?.avgSpeed).toBeCloseTo(36, 1);
  });

  it("以平滑高度窗口重建虛擬功率，避免短段高度跳動抬高整趟平均功率與熱量", () => {
    const route = Array.from({ length: 8 }, (_, index) => ({
      latitude: 0,
      longitude: longitudeForMeters(index * 20),
      altitude: index % 2 === 0 ? 10 : 16,
      speed: 5,
      timestamp: index * 4_000,
    }));
    const record = normalizeRideRecord({
      id: "smoothed-virtual-power",
      distance: 140,
      duration: 28,
      totalPausedSec: 0,
      powerSource: "estimated",
      caloriesSource: "power-estimate",
      avgPower: 500,
      maxPower: 650,
      calories: 500,
      route,
      calculationProfile: {
        riderWeightKg: 70,
        bikeWeightKg: 9,
        ftpW: 240,
        environment: { sampleCount: 1, averageHeadwindMs: 0, source: "offline-fallback" },
      },
    });
    expect(record?.avgPower).toBeGreaterThan(0);
    expect(record?.avgPower).toBeLessThan(250);
    expect(record?.calories).toBeLessThan(100);
  });
});
