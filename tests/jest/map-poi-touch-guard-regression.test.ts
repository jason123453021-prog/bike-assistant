import fs from "node:fs";
import path from "node:path";

import { shouldRefreshPoiForBounds } from "../../lib/poi-map-refresh";
import {
  canStartTouchGuardHold,
  hasCompletedTouchGuardHold,
} from "../../lib/touch-guard";

const mapSource = fs.readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/map.tsx"),
  "utf8",
);
const leafletSource = fs.readFileSync(
  path.resolve(__dirname, "../../components/leaflet-map.tsx"),
  "utf8",
);
const zhTwSource = fs.readFileSync(
  path.resolve(__dirname, "../../lib/i18n/locales/zh-TW.json"),
  "utf8",
);
const coreZhTwSource = fs.readFileSync(
  path.resolve(__dirname, "../../lib/i18n/locales/core-ui.zh-TW.json"),
  "utf8",
);

describe("地圖、POI 與觸控鎖實機問題回歸", () => {
  it("首次範圍與明顯移動時會刷新 POI，細微 GPS 置中不會重複查詢", () => {
    const first = {
      southWest: { lat: 25.02, lon: 121.49 },
      northEast: { lat: 25.07, lon: 121.54 },
    };
    expect(shouldRefreshPoiForBounds(null, first)).toBe(true);
    expect(
      shouldRefreshPoiForBounds(first, {
        southWest: { lat: 25.021, lon: 121.491 },
        northEast: { lat: 25.071, lon: 121.541 },
      }),
    ).toBe(false);
    expect(
      shouldRefreshPoiForBounds(first, {
        southWest: { lat: 25.06, lon: 121.53 },
        northEast: { lat: 25.11, lon: 121.58 },
      }),
    ).toBe(true);
  });

  it("只有有效觸控指標按住完整時間才能解除觸控鎖", () => {
    expect(
      canStartTouchGuardHold({
        isLocked: true,
        isRideActive: true,
        activeTouchCount: 0,
        pointerIdentifier: 7,
      }),
    ).toBe(false);
    expect(
      hasCompletedTouchGuardHold({
        pointerActive: false,
        pointerIdentifier: 7,
        startedAtMs: 0,
        nowMs: 2_000,
        requiredHoldMs: 1_200,
      }),
    ).toBe(false);
    expect(
      hasCompletedTouchGuardHold({
        pointerActive: true,
        pointerIdentifier: 7,
        startedAtMs: 0,
        nowMs: 1_200,
        requiredHoldMs: 1_200,
      }),
    ).toBe(true);
  });

  it("使用無 Carto key 的道路底圖，並在首次、GPS、GPX 與手動移動後傳回 POI 範圍", () => {
    expect(leafletSource).toContain("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(leafletSource).not.toContain("basemaps.cartocdn.com");
    expect(leafletSource).toContain("attribution: '&copy; OpenStreetMap contributors'");
    expect(leafletSource).toContain("map.on('moveend', postMapMoveEnd)");
    expect(leafletSource).toContain("postMapMoveEnd();");
    expect(mapSource).toContain("shouldRefreshPoiForBounds");
    expect(mapSource).toContain("poiMarkers={visiblePoiMarkers}");
  });

  it("繁中不再顯示單車助理或騎程錯字", () => {
    expect(coreZhTwSource).toContain('"appName": "單車助手"');
    expect(coreZhTwSource).not.toContain("單車助理");
    expect(zhTwSource).toContain('"finishRide": "結束騎乘"');
    expect(zhTwSource).toContain('"rideCount": "騎乘次數"');
    expect(zhTwSource).not.toContain("騎程");
  });
});
