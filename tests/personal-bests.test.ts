import { describe, expect, it } from "vitest";
import { calculatePersonalBests } from "../lib/personal-bests";

describe("calculatePersonalBests", () => {
  it("標記超越裝置內既有最長距離與爬升的騎乘", () => {
    const bests = calculatePersonalBests(
      { distance: 42500, totalAscent: 780, avgSpeed: 23.6, duration: 7200 },
      [{ distance: 38000, totalAscent: 640, avgSpeed: 22.8, duration: 7200 }],
    );

    expect(bests).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: "distance", value: 42.5, previousValue: 38 }),
      expect.objectContaining({ metric: "ascent", value: 780, previousValue: 640 }),
      expect.objectContaining({ metric: "averageSpeed", value: 23.6, previousValue: 22.8 }),
    ]));
  });

  it("排除短距離與短時間騎乘的均速，避免 GPS 尖峰誤判", () => {
    const bests = calculatePersonalBests(
      { distance: 800, totalAscent: 5, avgSpeed: 58, duration: 75 },
      [{ distance: 20000, totalAscent: 300, avgSpeed: 25, duration: 3600 }],
    );

    expect(bests).toHaveLength(0);
  });
});
