import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const gpxContextSource = readFileSync(resolve(process.cwd(), "lib/gpx-context.tsx"), "utf8");
const leafletSource = readFileSync(resolve(process.cwd(), "components/leaflet-map.tsx"), "utf8");

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = mapSource.indexOf(startMarker);
  const end = mapSource.indexOf(endMarker, start);
  return mapSource.slice(start, end === -1 ? undefined : end);
}

describe("導航與 GPX 的騎乘累計隔離", () => {
  it("釘選導航與清除導航圖層只變更導航狀態，不可開始、停止或重置騎乘", () => {
    const clearLayers = sourceBetween("const clearAllNavigationLayers", "const startPinnedNavigationRoute");
    const startPinned = sourceBetween("const startPinnedNavigationRoute", "const selectPinAddressDestination");

    for (const source of [clearLayers, startPinned]) {
      expect(source).not.toMatch(/dispatch\(\{\s*type:\s*"(?:START|STOP|RESET)"/);
    }
    expect(clearLayers).toContain('stateRef.current.status === "idle" || stateRef.current.status === "finished"');
    expect(startPinned).toContain("setMapRideActive(true)");
  });

  it("臨時 GPX context 只保存導航資料，不可取得或派發騎乘 reducer", () => {
    expect(gpxContextSource).toContain("setSharedRouteState(route)");
    expect(gpxContextSource).not.toContain("useRide");
    expect(gpxContextSource).not.toContain("dispatch(");
  });

  it("清除導航圖層只移除 GPX／導航標記，必須保留正在騎乘的 live trail", () => {
    const clearStart = leafletSource.indexOf("function clearNavigationGraphics()");
    const clearEnd = leafletSource.indexOf("function renderRouteOverlays", clearStart);
    const clearGraphics = leafletSource.slice(clearStart, clearEnd);

    expect(clearGraphics).toContain("clearRouteOverlays()");
    expect(clearGraphics).not.toContain("renderLiveTrailSegments([])");
    expect(clearGraphics).not.toContain("trailLayers.forEach");
  });

  it("定位計算只在 active 騎乘或剛恢復的可信點後進入，避免 GPX 導航污染累計", () => {
    const locationSection = sourceBetween("// 軌跡點始終記錄", "// ─── 騎乘計算");
    expect(locationSection).toContain('currentState.status !== "active" && !resumedFromAutomaticPause');
    expect(mapSource).toContain("resumedFromAutomaticPause = true;");
    expect(locationSection).toContain('type: "LOCATION_UPDATE"');
  });
});
