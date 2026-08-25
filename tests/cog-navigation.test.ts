import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  calculateCourseOverGround,
  findNextRouteTurn,
  resolveNavigationCog,
  stabilizeCogHeading,
  shouldWakeForUpcomingTurn,
} from "../lib/cog-navigation";

describe("純 GPS COG 軌跡導航", () => {
  it("使用最近三秒的 GPS 軌跡計算 COG，而非硬體 heading", () => {
    const cog = calculateCourseOverGround([
      { lat: 25, lon: 121, timestamp: 1_000 },
      { lat: 25.0001, lon: 121, timestamp: 2_000 },
      { lat: 25.0002, lon: 121, timestamp: 4_000 },
    ]);
    expect(cog).not.toBeNull();
    expect(cog!).toBeLessThan(5);
  });

  it("在路線上採用前方路線方位，偏離超過 20 公尺時回退自由騎乘 COG", () => {
    const route = [
      { lat: 25, lon: 121 },
      { lat: 25.0005, lon: 121 },
      { lat: 25.0005, lon: 121.0005 },
    ];
    const onTrack = resolveNavigationCog({
      position: { lat: 25.00005, lon: 121 },
      route,
      fallbackCog: 280,
    });
    const offTrack = resolveNavigationCog({
      position: { lat: 25.01, lon: 121.01 },
      route,
      fallbackCog: 280,
    });
    expect(onTrack.onTrack).toBe(true);
    expect(onTrack.heading).toBeLessThan(15);
    expect(offTrack.onTrack).toBe(false);
    expect(offTrack.heading).toBe(280);
  });

  it("忽略小幅 GPS 航向跳動，並限制單次較大方向偏差以避免地圖頻繁抖動", () => {
    expect(stabilizeCogHeading(90, 96)).toBe(90);
    expect(stabilizeCogHeading(90, 84)).toBe(90);

    const firstTurn = stabilizeCogHeading(0, 150);
    expect(firstTurn).toBeCloseTo(18.9, 5);
    expect(firstTurn).toBeLessThan(45);
    expect(stabilizeCogHeading(355, 2)).toBe(355);
  });

  it("在連續可信樣本下仍可平順追上真正的轉彎方向", () => {
    let heading = 0;
    for (let index = 0; index < 8; index += 1) {
      heading = stabilizeCogHeading(heading, 90);
    }
    expect(heading).toBeGreaterThan(80);
    expect(heading).toBeLessThanOrEqual(90);
  });

  it("依相鄰 GPX 向量的有號夾角正確辨識左轉／右轉並於 100 公尺內喚醒", () => {
    const rightRoute = [
      { lat: 25, lon: 121 },
      { lat: 25.0002, lon: 121 },
      { lat: 25.0002, lon: 121.0002 },
    ];
    const leftRoute = [
      { lat: 25, lon: 121 },
      { lat: 25.0002, lon: 121 },
      { lat: 25.0002, lon: 120.9998 },
    ];
    const rightTurn = findNextRouteTurn(rightRoute, 0);
    const leftTurn = findNextRouteTurn(leftRoute, 0);
    expect(rightTurn?.direction).toBe("right");
    expect(leftTurn?.direction).toBe("left");
    expect(shouldWakeForUpcomingTurn(rightTurn)).toBe(true);
  });

  it("地圖頁僅以 GPS COG 與 GPX 幾何進行旋轉及導航，不讀取硬體羅盤航向", () => {
    const mapSource = readFileSync("app/(tabs)/map.tsx", "utf8");
    expect(mapSource).toContain("calculateCourseOverGround");
    expect(mapSource).toContain("resolveNavigationCog");
    expect(mapSource).toContain("stabilizeCogHeading");
    expect(mapSource).not.toContain("coords.heading");
    expect(mapSource).not.toContain("Magnetometer");
    expect(mapSource).not.toContain("DeviceOrientation");
  });
});
