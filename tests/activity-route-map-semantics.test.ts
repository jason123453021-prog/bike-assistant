import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("活動路線地圖語意", () => {
  const source = readFileSync(resolve(process.cwd(), "components/leaflet-map.tsx"), "utf8");

  it("使用不同顏色與形狀標示起點、終點和行進方向", () => {
    expect(source).toContain("makeRouteStartIcon");
    expect(source).toContain("#19B56B");
    expect(source).toContain("route-start-marker");
    expect(source).toContain("makeRouteEndIcon");
    expect(source).toContain("#E5484D");
    expect(source).toContain("route-end-marker");
    expect(source).toContain("makeRouteDirectionIcon(bearing)");
    expect(source).toContain("#1D2730");
  });
});
