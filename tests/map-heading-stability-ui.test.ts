import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapScreenSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");

describe("導航頁車頭朝前穩定性守門", () => {
  it("只在可信 GPS 航向通過穩定化後旋轉地圖", () => {
    expect(mapScreenSource).toContain("stabilizeMapHeading(hdg, lastMapBearingRef.current, speedKmhRaw, locationAccuracyM)");
    expect(mapScreenSource).toContain("speedKmhRaw >= 7");
    expect(mapScreenSource).toContain("locationAccuracyM <= 35");
  });

  it("不允許羅盤回呼直接驅動地圖旋轉", () => {
    expect(mapScreenSource).toContain("不直接由羅盤回呼旋轉地圖");
    expect(mapScreenSource).not.toContain("applyResponsiveMapBearing(responsiveHeading)");
  });
});
