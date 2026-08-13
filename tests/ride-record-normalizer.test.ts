import { describe, expect, it } from "vitest";

import { normalizeRideRecord, normalizeRideRecords } from "../lib/ride-record-normalizer";
import { calculateNormalizedPowerFromHistory } from "../lib/tss-calc";

describe("ride record normalizer", () => {
  it("derives complete terrain and moving metrics from a legacy local record", () => {
    const record = normalizeRideRecord({
      id: "legacy-ride",
      date: 1_700_000_000_000,
      name: "舊版海拔紀錄",
      duration: 3600,
      distance: 10_000,
      avgSpeed: 99,
      maxSpeed: 35,
      totalAscent: 0,
      calories: 650,
      avgPower: 150,
      maxPower: 200,
      powerZones: [1, 2, 3, 4, 5],
      powerHistory: Array.from({ length: 60 }, () => 150),
      totalPausedSec: 600,
      totalSweatMl: 800,
      refillCount: 1,
      calculationProfile: {
        riderWeightKg: 68,
        bikeWeightKg: 9,
        ftpW: 245,
        environment: {
          sampleCount: 12,
          averageTemperatureC: 31,
          averageHumidityPct: 78,
          averageWindSpeedKmh: 18,
          averageHeadwindMs: 2,
          averagePrecipitationProb: 15,
          weatherCode: 1,
          source: "live-weather",
        },
      },
      route: [
        { latitude: 25.0, longitude: 121.0, altitude: 100, speed: 4, timestamp: 1 },
        { latitude: 25.001, longitude: 121.0, altitude: 120, speed: 4, timestamp: 2 },
        { latitude: 25.002, longitude: 121.0, altitude: 110, speed: 4, timestamp: 3 },
        { latitude: 25.003, longitude: 121.0, altitude: 140, speed: 4, timestamp: 4 },
      ],
    });

    expect(record).not.toBeNull();
    expect(record?.totalAscent).toBe(50);
    expect(record?.totalDescent).toBe(10);
    expect(record?.maxElevation).toBe(140);
    expect(record?.minElevation).toBe(100);
    expect(record?.movingTime).toBe(3000);
    expect(record?.avgSpeed).toBeCloseTo(12, 4);
    expect(record?.averageGrade).toBeGreaterThan(14);
    expect(record?.maxGrade).toBeGreaterThan(25);
    expect(record?.normalizedPower).toBe(150);
    expect(record?.calculationProfile?.ftpW).toBe(245);
    expect(record?.calculationProfile?.environment?.averageTemperatureC).toBe(31);
  });

  it("keeps valid local records only, fills safe defaults, deduplicates IDs and sorts newest first", () => {
    const records = normalizeRideRecords([
      { id: "invalid", distance: "x", route: [] },
      {
        id: "older",
        date: 10,
        distance: 500,
        duration: 120,
        route: [],
      },
      {
        id: "newer",
        date: 20,
        distance: 1000,
        duration: 240,
        route: [{ latitude: 25, longitude: 121, altitude: null, speed: null, timestamp: 20 }],
      },
      {
        id: "older",
        date: 30,
        distance: 9999,
        duration: 999,
        route: [],
      },
    ]);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.id)).toEqual(["newer", "older"]);
    expect(records[0].name).toBe("匯入騎乘紀錄");
    expect(records[0].powerZones).toEqual([0, 0, 0, 0, 0]);
    expect(records[0].route).toHaveLength(1);
  });

  it("calculates normalized power from rolling power data without treating peak power as the result", () => {
    const fluctuating = [
      ...Array.from({ length: 30 }, () => 100),
      ...Array.from({ length: 30 }, () => 200),
    ];
    const normalizedPower = calculateNormalizedPowerFromHistory(fluctuating, 60);

    expect(normalizedPower).toBeDefined();
    expect(normalizedPower).toBeGreaterThan(150);
    expect(normalizedPower).toBeLessThan(200);
  });
});
