import { describe, expect, it } from "vitest";
import { recommendFtp } from "../lib/ftp-recommendation";
import type { RideRecord } from "../lib/ride-context";

function ride(id: string, date: number, power: number): RideRecord {
  return {
    id,
    date,
    name: id,
    duration: 25 * 60,
    movingTime: 25 * 60,
    distance: 9_000,
    avgSpeed: 21.6,
    maxSpeed: 30,
    totalAscent: 100,
    calories: 250,
    avgPower: power,
    maxPower: power + 30,
    powerZones: [0, 0, 0, 0, 0],
    powerHistory: Array.from({ length: 150 }, () => power),
    route: [],
    totalSweatMl: 400,
    refillCount: 1,
    totalPausedSec: 0,
  };
}

describe("recommendFtp", () => {
  const now = Date.UTC(2026, 7, 13);

  it("資料不足時不產生 FTP 建議", () => {
    expect(recommendFtp([ride("one", now - 1_000, 250)], 220, now)).toBeNull();
  });

  it("以至少兩次近期 20 分鐘努力建立僅供確認的候選值", () => {
    const result = recommendFtp([ride("one", now - 1_000, 250), ride("two", now - 2_000, 260)], 240, now);
    expect(result).toMatchObject({ recommendedFtpW: 242, rawEstimateW: 242, sourceRideCount: 2, confidence: "moderate" });
  });

  it("限制候選值相對目前 FTP 的單次變動幅度", () => {
    const result = recommendFtp([ride("one", now - 1_000, 400), ride("two", now - 2_000, 400)], 200, now);
    expect(result?.recommendedFtpW).toBe(230);
    expect(result?.rationale).toContain("±15%");
  });

  it("排除超過 90 天的歷史資料", () => {
    const result = recommendFtp([
      ride("old", now - 100 * 24 * 60 * 60 * 1_000, 400),
      ride("one", now - 1_000, 250),
    ], 220, now);
    expect(result).toBeNull();
  });
});
