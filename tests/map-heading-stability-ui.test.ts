import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapScreenSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
);
const leafletSource = readFileSync(
  resolve(process.cwd(), "components/leaflet-map.tsx"),
  "utf8",
);
const simplifiedNavigationSource = readFileSync(
  resolve(process.cwd(), "components/simplified-nav-overlay.tsx"),
  "utf8",
);

describe("導航頁使用者地圖方向守門", () => {
  it("僅以最近 GPS COG 與 GPX 前視航向平滑地圖朝前，不使用硬體羅盤", () => {
    expect(mapScreenSource).toContain("calculateCourseOverGround");
    expect(mapScreenSource).toContain("resolveNavigationCog");
    expect(mapScreenSource).toContain("smoothCogHeading");
    expect(mapScreenSource).toContain(
      "shouldApplyCogRotation(locationCameraModeRef.current)",
    );
    expect(mapScreenSource).toContain(
      'applyBearingForLocationMode("heading-up", hdg)',
    );
    expect(mapScreenSource).not.toContain("coords.heading");
    expect(mapScreenSource).not.toContain("stabilizeMapHeading(");
  });

  it("目前位置以高可見度圓形標記呈現，航向不再改變定位圖示形狀", () => {
    expect(leafletSource).toContain("makeCircleIcon('#007AFF', 18, '#fff')");
    expect(leafletSource).toContain(
      "Position marker is intentionally a circular blue dot",
    );
    expect(leafletSource).not.toContain('d="M16 2 L28 28 L16 22 L4 28 Z"');
  });

  it("提供 COG 朝前、自由角度與正北置中三種定位模式，手動操作後依現行模式歸位", () => {
    expect(mapScreenSource).toContain("onMapRotateEnd={() => {");
    expect(mapScreenSource).toContain(
      "Date.now() < programmaticBearingUntilRef.current",
    );
    expect(mapScreenSource).toContain(
      "nextLocationCameraMode(locationCameraModeRef.current)",
    );
    expect(mapScreenSource).toContain('selectLocationCameraMode("heading-up")');
    expect(mapScreenSource).toContain('label: "自由"');
    expect(mapScreenSource).toContain('label: "正北"');
    expect(mapScreenSource).toContain("setFollowUser(false);");
    expect(mapScreenSource).toContain("setFollowUser(true);");
    expect(mapScreenSource).not.toContain("applyResponsiveMapBearing(");
    expect(mapScreenSource).not.toContain("watchHeadingAsync");
    expect(leafletSource).toContain("map.on('rotateend'");
    expect(leafletSource).toContain("type: 'mapRotateEnd'");
    expect(leafletSource).toContain("onMapRotateEnd?.(msg.bearing)");
    expect(leafletSource).not.toContain("map.setBearing(msg.heading)");
    expect(leafletSource).toContain("map.setBearing(currentBearing)");
  });

  it("完全移除預測轉彎橫幅與轉向語音，只保留路線進度與 COG 旋轉", () => {
    expect(mapScreenSource).not.toContain("speakNavigationGuidance");
    expect(mapScreenSource).not.toContain("findNextRouteTurn");
    expect(mapScreenSource).not.toContain("{isNavigating && turnDirection");
    expect(mapScreenSource).not.toContain("{isNavigating && !turnDirection");
    expect(mapScreenSource).toContain("updateRouteProgress");
    expect(simplifiedNavigationSource).not.toContain("directionPlaceholder");
    expect(simplifiedNavigationSource).not.toContain("directionIcon");
    expect(simplifiedNavigationSource).toContain("showDirection: false");
  });

  it("本機儲存成功後清除當次路線、標記與即時軌跡圖層", () => {
    expect(mapScreenSource).toContain("clearAllNavigationLayers(true);");
    expect(mapScreenSource).toContain("setLiveTrail([]);");
    expect(leafletSource).toContain(
      "if (clearLiveTrail) renderLiveTrailSegments([]);",
    );
  });
});
