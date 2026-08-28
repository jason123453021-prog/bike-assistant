import { describe, expect, it } from "vitest";

import {
  buildPoiClusters,
  buildPoiOverpassQuery,
  filterPoiMarkers,
  parseOverpassPoiElements,
  shouldClusterPoiMarkers,
  type PoiMarker,
} from "../lib/poi-layer";

const markers: PoiMarker[] = [
  {
    id: "water-1",
    kind: "water_refill",
    category: "drinking_water",
    name: "Refill",
    latitude: 25.0478,
    longitude: 121.5319,
    source: "openstreetmap",
  },
  {
    id: "photo-1",
    kind: "photo_spot",
    category: "viewpoint",
    name: "Viewpoint",
    latitude: 25.048,
    longitude: 121.532,
    source: "openstreetmap",
  },
];

describe("免費補水點與拍照景點 Local-first 資料層", () => {
  it("只查詢具可飲用水、免費補水或景觀語意的 OSM 標籤", () => {
    const query = buildPoiOverpassQuery({
      southWest: { lat: 25, lon: 121.5 },
      northEast: { lat: 25.1, lon: 121.6 },
    });

    expect(query).toContain('["amenity"="drinking_water"]');
    expect(query).toContain('["drinking_water:refill"="yes"]');
    expect(query).toContain('["tourism"="viewpoint"]');
    expect(query).not.toContain('["amenity"="police"]');
  });

  it("將可驗證飲水與景觀資料分流，且不把一般設施冒充成補水點", () => {
    const parsed = parseOverpassPoiElements([
      {
        id: 1,
        type: "node",
        lat: 25.04,
        lon: 121.53,
        tags: { amenity: "drinking_water", name: "Public fountain" },
      },
      {
        id: 2,
        type: "node",
        lat: 25.05,
        lon: 121.54,
        tags: { tourism: "viewpoint", name: "Ridge view" },
      },
      {
        id: 3,
        type: "node",
        lat: 25.06,
        lon: 121.55,
        tags: { amenity: "police", name: "Police" },
      },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed.map((marker) => marker.kind)).toEqual([
      "water_refill",
      "photo_spot",
    ]);
  });

  it("保留已標記飲水的設施類別，未標記飲水的設施仍不會顯示", () => {
    const parsed = parseOverpassPoiElements([
      {
        id: 4,
        type: "node",
        lat: 25.07,
        lon: 121.56,
        tags: { amenity: "police", drinking_water: "yes", name: "Police water" },
      },
      {
        id: 5,
        type: "node",
        lat: 25.08,
        lon: 121.57,
        tags: { shop: "bicycle", name: "No verified water" },
      },
    ]);

    expect(parsed).toEqual([
      expect.objectContaining({
        category: "police_station",
        kind: "water_refill",
      }),
    ]);
  });

  it("依使用者設定篩選兩個圖層", () => {
    expect(
      filterPoiMarkers(markers, {
        showWaterRefillSpots: true,
        showPhotoScenicSpots: false,
      }),
    ).toEqual([markers[0]]);
  });

  it("在遠景聚合相近 Marker，近景則保留可單獨點擊的標記", () => {
    expect(shouldClusterPoiMarkers(12)).toBe(true);
    expect(shouldClusterPoiMarkers(13)).toBe(false);
    expect(buildPoiClusters(markers, 12)).toHaveLength(1);
    expect(buildPoiClusters(markers, 14)).toHaveLength(2);
  });
});
