import { describe, expect, it } from "vitest";
import type { RideRecord } from "../lib/ride-context";
import { buildRideSplits } from "../lib/ride-splits";
import { buildElevationBands } from "../lib/elevation-bands";

const route = [
  { latitude: 25, longitude: 121, altitude: 10, speed: 5, timestamp: 0, power: 150 },
  { latitude: 25, longitude: 121.009, altitude: 30, speed: 5, timestamp: 60_000, power: 200 },
  { latitude: 25, longitude: 121.018, altitude: 15, speed: 5, timestamp: 120_000, power: 250 },
];

const record: RideRecord = {
  id: "split-test",
  date: 1,
  name: "分段測試",
  duration: 120,
  movingTime: 120,
  distance: 2_000,
  avgSpeed: 60,
  maxSpeed: 60,
  totalAscent: 20,
  totalDescent: 15,
  calories: 100,
  avgPower: 200,
  maxPower: 250,
  powerZones: [0, 0, 0, 0, 0],
  powerHistory: [150, 200, 250],
  route,
  totalSweatMl: 100,
  refillCount: 0,
  totalPausedSec: 0,
};

describe("buildRideSplits", () => {
  it("依固定距離切分軌跡並保留時間、地形與功率資料", () => {
    const splits = buildRideSplits(record);
    expect(splits).toHaveLength(2);
    expect(splits.map((split) => split.distanceM)).toEqual([1000, 1000]);
    expect(splits.reduce((sum, split) => sum + split.movingTimeSeconds, 0)).toBe(120);
    expect(splits[0].ascentM).toBeGreaterThan(0);
    expect(splits[1].descentM).toBeGreaterThan(0);
    expect(splits[0].averagePowerW).toBeGreaterThan(0);
    expect(splits[0].paceSecondsPerKm).toBeGreaterThan(0);
  });

  it("在沒有足夠 GPS 軌跡時安全回傳空分段", () => {
    expect(buildRideSplits({ ...record, route: [route[0]] })).toEqual([]);
  });

  it("以本機軌跡建立海拔區間分布", () => {
    const bands = buildElevationBands({ ...record, route: route.map((point, index) => ({ ...point, altitude: 20 + index * 110 })) }, 100);
    expect(bands.length).toBeGreaterThan(1);
    expect(bands.reduce((sum, band) => sum + band.distanceM, 0)).toBeGreaterThan(0);
  });

  it("GPS 軌跡未附每點功率時，依保存功率序列對齊重建分段功率", () => {
    const routeWithoutPointPower = route.map(({ power: _power, ...point }) => point);
    const splits = buildRideSplits({ ...record, route: routeWithoutPointPower, powerHistory: [140, 220, 260] });
    expect(splits).toHaveLength(2);
    expect(splits.every((split) => split.averagePowerW !== undefined && split.averagePowerW > 0)).toBe(true);
    expect(splits[0].averagePowerW).not.toBe(splits[1].averagePowerW);
  });
});
