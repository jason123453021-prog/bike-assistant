import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapScreenSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const leafletSource = readFileSync(resolve(process.cwd(), "components/leaflet-map.tsx"), "utf8");

describe("導航頁使用者地圖方向守門", () => {
  it("僅以最近 GPS COG 與 GPX 前視航向平滑地圖朝前，不使用硬體羅盤", () => {
    expect(mapScreenSource).toContain("calculateCourseOverGround");
    expect(mapScreenSource).toContain("resolveNavigationCog");
    expect(mapScreenSource).toContain("smoothCogHeading");
    expect(mapScreenSource).toContain("mapRef.current?.setBearing((360 - hdg) % 360, true)");
    expect(mapScreenSource).not.toContain("coords.heading");
    expect(mapScreenSource).not.toContain("stabilizeMapHeading(");
  });

  it("目前位置以高可見度圓形標記呈現，航向不再改變定位圖示形狀", () => {
    expect(leafletSource).toContain("makeCircleIcon('#007AFF', 18, '#fff')");
    expect(leafletSource).toContain("Position marker is intentionally a circular blue dot");
    expect(leafletSource).not.toContain('d="M16 2 L28 28 L16 22 L4 28 Z"');
  });

  it("手動旋轉期間停止 GPS 地圖跟隨，回歸中心後才恢復 COG 朝前", () => {
    expect(mapScreenSource).toContain("onMapRotateEnd={() => scheduleAutoRecenter()}");
    expect(mapScreenSource).toContain("setFollowUser(false);");
    expect(mapScreenSource).toContain("setFollowUser(true);");
    expect(mapScreenSource).not.toContain("applyResponsiveMapBearing(");
    expect(mapScreenSource).not.toContain("watchHeadingAsync");
    expect(leafletSource).toContain("map.on('rotateend'");
    expect(leafletSource).toContain("type: 'mapRotateEnd'");
    expect(leafletSource).toContain("onMapRotateEnd?.(msg.bearing)");
    expect(leafletSource).not.toContain("map.setBearing(msg.heading)");
    expect(leafletSource).toContain("不得覆寫使用者以雙指選擇的地圖方向");
  });
});
