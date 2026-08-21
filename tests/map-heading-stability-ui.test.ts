import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapScreenSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const leafletSource = readFileSync(resolve(process.cwd(), "components/leaflet-map.tsx"), "utf8");

describe("導航頁使用者地圖方向守門", () => {
  it("只以 GPS 航向更新位置箭頭與風向，不再旋轉地圖", () => {
    expect(mapScreenSource).toContain("speedKmhRaw >= 7");
    expect(mapScreenSource).toContain("locationAccuracyM <= 35");
    expect(mapScreenSource).toContain("只平滑箭頭航向，不改變地圖方向");
    expect(mapScreenSource).not.toContain("stabilizeMapHeading(");
  });

  it("目前位置以高可見度圓形標記呈現，航向不再改變定位圖示形狀", () => {
    expect(leafletSource).toContain("makeCircleIcon('#007AFF', 18, '#fff')");
    expect(leafletSource).toContain("Position marker is intentionally a circular blue dot");
    expect(leafletSource).not.toContain('d="M16 2 L28 28 L16 22 L4 28 Z"');
  });

  it("不允許定位或羅盤回呼覆寫使用者手動旋轉方向", () => {
    expect(mapScreenSource).toContain("onMapRotateEnd={() => scheduleAutoRecenter()}");
    expect(mapScreenSource).not.toContain("applyResponsiveMapBearing(");
    expect(mapScreenSource).not.toContain("watchHeadingAsync");
    expect(leafletSource).toContain("map.on('rotateend'");
    expect(leafletSource).toContain("type: 'mapRotateEnd'");
    expect(leafletSource).toContain("onMapRotateEnd?.(msg.bearing)");
    expect(leafletSource).not.toContain("map.setBearing(msg.heading)");
    expect(leafletSource).toContain("不得覆寫使用者以雙指選擇的地圖方向");
  });
});
