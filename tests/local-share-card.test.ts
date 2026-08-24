import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { createRideShareCardFilename, createRideShareCardSvg } from "../lib/ride-share-card-svg";
import type { RideRecord } from "../lib/ride-context";

const record = {
  id: "share-001",
  date: new Date("2026-08-13T07:30:00+08:00").getTime(),
  name: "晨騎 <測試>",
  duration: 7200,
  distance: 45200,
  avgSpeed: 22.6,
  maxSpeed: 46.2,
  totalAscent: 620,
  calories: 1560,
  avgPower: 142,
  maxPower: 618,
  powerZones: [1, 2, 3, 4, 5],
  powerHistory: [],
  totalSweatMl: 850,
  refillCount: 2,
  totalPausedSec: 600,
  route: [
    { latitude: 25.0478, longitude: 121.5319, altitude: 12, speed: 4.2, timestamp: 1 },
    { latitude: 25.055, longitude: 121.545, altitude: 18, speed: 5.4, timestamp: 2 },
  ],
  personalBests: [{ metric: "distance", label: "最長距離", value: 45.2, unit: "km" }],
} as RideRecord;

describe("local ride share card", () => {
  it("creates a self-contained SVG with route and core activity metrics", () => {
    const svg = createRideShareCardSvg(record);
    expect(svg).toContain("<svg");
    expect(svg).toContain("polyline");
    expect(svg).toContain("45.20");
    expect(svg).toContain("晨騎 &lt;測試&gt;");
    expect(svg).toContain("活動摘要");
  });

  it("creates a safe local SVG filename", () => {
    expect(createRideShareCardFilename(record)).toBe("bike-ride-晨騎-測試-share-001.svg");
  });

  it("marks unavailable power as insufficient data instead of presenting an invented 0 W", () => {
    const svg = createRideShareCardSvg({
      ...record,
      avgPower: 0,
      maxPower: 0,
      powerSource: "unavailable",
      powerHistory: [],
    });

    expect(svg).toContain("資料不足");
    expect(svg).toContain(">--<");
  });

  it("移動時間為零時維持安全統計，且路線採用等比例 fit bounds 不拉伸", () => {
    const svg = createRideShareCardSvg({
      ...record,
      movingTime: 0,
      totalPausedSec: record.duration,
      avgPower: 9999,
      maxPower: 9999,
      powerSource: "estimated",
    });
    const source = readFileSync("lib/ride-share-card-svg.ts", "utf8");
    expect(svg).not.toContain("Infinity");
    expect(svg).toContain("資料不足");
    expect(source).toContain("const drawScale = Math.min(896 / lonSpan, 560 / latSpan);");
  });
});
