import { describe, expect, it } from "vitest";

import { calculateRouteDistance, calculateRouteMaxSpeed, calculateRouteMovingTime, normalizeRideRecord, normalizeRideRecords } from "../lib/ride-record-normalizer";
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
    expect(record?.maxGrade).toBeGreaterThan(0);
    expect(record?.maxGrade).toBeLessThanOrEqual(25);
    expect(record?.normalizedPower).toBe(150);
    expect(record?.calculationProfile?.ftpW).toBe(245);
    expect(record?.calculationProfile?.environment?.averageTemperatureC).toBe(31);
    expect(record?.totalWorkKj).toBe(450);
    expect(record?.powerSource).toBe("unavailable");
    expect(record?.caloriesSource).toBe("unavailable");
  });

  it("preserves saved statistics provenance instead of claiming legacy or estimated data is measured", () => {
    const record = normalizeRideRecord({
      id: "provenance",
      distance: 10_000,
      duration: 1_800,
      totalPausedSec: 300,
      avgPower: 180,
      maxPower: 600,
      totalWorkKj: 270,
      powerSource: "estimated",
      caloriesSource: "power-estimate",
      route: [],
    });

    expect(record?.movingTime).toBe(1_500);
    expect(record?.totalWorkKj).toBe(270);
    expect(record?.powerSource).toBe("estimated");
    expect(record?.caloriesSource).toBe("power-estimate");
  });

  it("repairs legacy kilometres-as-metres distance, raw GPS ascent noise and unsupported calorie totals from its saved route", () => {
    const route = [
      { latitude: 25, longitude: 121, altitude: 100, speed: 4, timestamp: 1_000 },
      { latitude: 25.001, longitude: 121, altitude: 106, speed: 4, timestamp: 4_000 },
      { latitude: 25.002, longitude: 121, altitude: 111, speed: 4, timestamp: 7_000 },
      { latitude: 25.003, longitude: 121, altitude: 119, speed: 4, timestamp: 10_000 },
    ];
    const reconstructedDistance = calculateRouteDistance(route);
    const record = normalizeRideRecord({
      id: "recovery-unit-mismatch",
      distance: 0.32,
      duration: 1_800,
      totalAscent: 579,
      calories: 577,
      avgPower: 0,
      powerSource: "unavailable",
      route,
      calculationProfile: { riderWeightKg: 70, bikeWeightKg: 10, ftpW: 240 },
    });

    expect(record?.distance).toBeCloseTo(reconstructedDistance, 4);
    expect(record?.totalAscent).toBe(11);
    expect(record?.calories).toBeLessThan(577);
  });

  it("rebuilds a corrupted no-power calorie total even when an older record mislabeled it as a power estimate", () => {
    const record = normalizeRideRecord({
      id: "mislabelled-legacy-calories",
      distance: 0.32,
      duration: 1_800,
      totalAscent: 579,
      calories: 577,
      avgPower: 0,
      maxPower: 0,
      powerSource: "estimated",
      caloriesSource: "power-estimate",
      route: [
        { latitude: 25, longitude: 121, altitude: 100, speed: 4, timestamp: 1_000 },
        { latitude: 25.001, longitude: 121, altitude: 106, speed: 4, timestamp: 4_000 },
        { latitude: 25.002, longitude: 121, altitude: 111, speed: 4, timestamp: 7_000 },
        { latitude: 25.003, longitude: 121, altitude: 119, speed: 4, timestamp: 10_000 },
      ],
      calculationProfile: { riderWeightKg: 70, bikeWeightKg: 10, ftpW: 240 },
    });

    expect(record?.distance).toBeGreaterThan(300);
    expect(record?.totalAscent).toBe(11);
    expect(record?.powerSource).toBe("estimated");
    expect(record?.caloriesSource).toBe("power-estimate");
    expect(record?.calories).toBeLessThan(577);
  });

  it("only rebuilds virtual power from a continuous route when the rider profile is complete", () => {
    const route = [
      { latitude: 25, longitude: 121, altitude: 100, speed: 4, timestamp: 1_000 },
      { latitude: 25.001, longitude: 121, altitude: 108, speed: 4, timestamp: 4_000 },
      { latitude: 25.002, longitude: 121, altitude: 114, speed: 4, timestamp: 7_000 },
    ];
    const withoutProfile = normalizeRideRecord({ id: "no-profile", distance: 220, duration: 6, route });
    const withProfile = normalizeRideRecord({
      id: "with-profile",
      distance: 220,
      duration: 6,
      route,
      calculationProfile: { riderWeightKg: 70, bikeWeightKg: 10, ftpW: 240 },
    });

    expect(withoutProfile?.powerSource).toBe("unavailable");
    expect(withoutProfile?.avgPower).toBe(0);
    expect(withProfile?.powerSource).toBe("estimated");
    expect(withProfile?.avgPower).toBeGreaterThan(0);
    expect(withProfile?.maxPower).toBeLessThanOrEqual(600);
  });

  it("rebuilds comparable moving time from GPS while excluding a stationary drift interval", () => {
    const route = [
      { latitude: 25, longitude: 121, altitude: 100, speed: 4, timestamp: 1_000 },
      { latitude: 25.0005, longitude: 121, altitude: 102, speed: 4, timestamp: 11_000 },
      { latitude: 25.00051, longitude: 121, altitude: 102, speed: 0, timestamp: 131_000 },
      { latitude: 25.001, longitude: 121, altitude: 105, speed: 4, timestamp: 141_000 },
      { latitude: 25.0015, longitude: 121, altitude: 108, speed: 4, timestamp: 151_000 },
      { latitude: 25.002, longitude: 121, altitude: 110, speed: 4, timestamp: 161_000 },
      { latitude: 25.0025, longitude: 121, altitude: 112, speed: 4, timestamp: 171_000 },
      { latitude: 25.003, longitude: 121, altitude: 114, speed: 4, timestamp: 181_000 },
    ];
    expect(calculateRouteMovingTime(route)).toBe(60);
    const record = normalizeRideRecord({
      id: "gps-moving-time",
      distance: 350,
      duration: 180,
      totalPausedSec: 0,
      route,
    });
    expect(record?.movingTime).toBe(60);
    expect(record?.totalPausedSec).toBe(120);
  });

  it("clamps impossible virtual-power spikes to the rider FTP ceiling while retaining measured power provenance", () => {
    const estimated = normalizeRideRecord({
      id: "virtual-power-spike",
      distance: 5_000,
      duration: 900,
      avgPower: 1_800,
      maxPower: 4_000,
      powerSource: "estimated",
      powerHistory: [120, 2_000, 4_000],
      route: [],
      calculationProfile: { riderWeightKg: 70, bikeWeightKg: 10, ftpW: 240 },
    });
    const measured = normalizeRideRecord({
      id: "measured-power",
      distance: 5_000,
      duration: 900,
      avgPower: 310,
      maxPower: 1_200,
      powerSource: "measured",
      powerHistory: [300, 1_200],
      route: [],
    });

    expect(estimated?.maxPower).toBe(600);
    expect(estimated?.avgPower).toBeLessThanOrEqual(600);
    expect(measured?.maxPower).toBe(1_200);
  });

  it("重建可靠最高速度、補水確認次數與手動 Lap，並跳過無法驗證的 GPS 尖峰", () => {
    const route = [
      { latitude: 25, longitude: 121, altitude: 100, speed: 0, timestamp: 1_000 },
      { latitude: 25.0005, longitude: 121, altitude: 101, speed: 4, timestamp: 11_000 },
      { latitude: 25.001, longitude: 121, altitude: 102, speed: 5, timestamp: 21_000 },
      { latitude: 25.9, longitude: 121, altitude: 102, speed: 80, timestamp: 22_000 },
    ];
    expect(calculateRouteMaxSpeed(route)).toBeCloseTo(18, 3);
    const record = normalizeRideRecord({
      id: "detail-repair",
      duration: 20,
      distance: 100,
      maxSpeed: 0,
      route,
      supplyConfirmations: [{ type: "water", timestamp: 10_000, elapsedSec: 10 }],
      laps: [{ index: 1, startedAtElapsedSec: 0, endedAtElapsedSec: 20, movingTimeSec: 20, distanceM: 100, ascentM: 2, descentM: 0 }],
    });
    expect(record?.maxSpeed).toBeCloseTo(18, 3);
    expect(record?.refillCount).toBe(1);
    expect(record?.laps).toHaveLength(1);
    expect(record?.laps?.[0].distanceM).toBe(100);
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

  it("keeps valid local activity metadata and safely normalizes invalid values", () => {
    const valid = normalizeRideRecord({
      id: "metadata-valid",
      distance: 1_000,
      duration: 300,
      route: [],
      activityType: "gravel",
      equipment: "  鋁合金礫石車  ",
      perceivedExertion: 7.4,
      coverPhotoUri: "  file:///ride/cover.jpg  ",
    });
    const invalid = normalizeRideRecord({
      id: "metadata-invalid",
      distance: 1_000,
      duration: 300,
      route: [],
      activityType: "unsupported",
      equipment: 123,
      perceivedExertion: 12,
      coverPhotoUri: 123,
    });

    expect(valid?.activityType).toBe("gravel");
    expect(valid?.equipment).toBe("鋁合金礫石車");
    expect(valid?.perceivedExertion).toBe(7);
    expect(valid?.coverPhotoUri).toBe("file:///ride/cover.jpg");
    expect(invalid?.activityType).toBe("road");
    expect(invalid?.equipment).toBeUndefined();
    expect(invalid?.perceivedExertion).toBeUndefined();
    expect(invalid?.coverPhotoUri).toBeUndefined();
  });
});
