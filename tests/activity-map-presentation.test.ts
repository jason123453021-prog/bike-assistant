import { describe, expect, it } from "vitest";
import { sampleActivityMapPolyline } from "../lib/activity-map-presentation";

describe("sampleActivityMapPolyline", () => {
  it("保留短軌跡參照，避免不必要複製", () => {
    const coordinates = [{ latitude: 25, longitude: 121 }, { latitude: 25.1, longitude: 121.1 }];
    expect(sampleActivityMapPolyline(coordinates)).toBe(coordinates);
  });

  it("限制顯示軌跡點數並保留完整路線的起訖位置", () => {
    const coordinates = Array.from({ length: 500 }, (_, index) => ({
      latitude: 25 + index / 10_000,
      longitude: 121 + index / 10_000,
    }));
    const sampled = sampleActivityMapPolyline(coordinates, 220);

    expect(sampled.length).toBeLessThanOrEqual(220);
    expect(sampled[0]).toEqual(coordinates[0]);
    expect(sampled.at(-1)).toEqual(coordinates.at(-1));
  });

  it("在長軌跡抽樣後保留背景恢復的安全斷點", () => {
    const coordinates = Array.from({ length: 500 }, (_, index) => ({
      latitude: 25 + index / 10_000,
      longitude: 121 + index / 10_000,
      segmentStart: index === 333 || undefined,
    }));
    const sampled = sampleActivityMapPolyline(coordinates, 220);

    expect(sampled).toContain(coordinates[333]);
  });
});
