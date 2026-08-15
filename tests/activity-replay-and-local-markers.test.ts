import { describe, expect, it } from "vitest";
import { compareLocalSplitPersonalBests } from "../lib/local-split-personal-bests";
import { buildPhotoRouteMarkers } from "../lib/photo-route-markers";
import { createTimelineEntry } from "../lib/ride-photo-timeline";
import type { RideRecord } from "../lib/ride-context";

function makeRoute(length: number, startTime = 1_000) {
  return Array.from({ length }, (_, index) => ({
    latitude: 25 + index * 0.001,
    longitude: 121,
    altitude: 20,
    speed: 6,
    timestamp: startTime + index * 60_000,
    power: 180,
  }));
}

function makeRide(id: string, date: number, route = makeRoute(12)): RideRecord {
  return {
    id, date, name: id, duration: 660, distance: 1_200, avgSpeed: 20, maxSpeed: 28,
    totalAscent: 20, calories: 200, avgPower: 180, maxPower: 260, powerZones: [10, 20, 40, 20, 10],
    powerHistory: [], route, totalSweatMl: 500, refillCount: 0, totalPausedSec: 0, movingTime: 660,
  };
}

describe("離線活動標記與本機成果", () => {
  it("優先採用 EXIF 座標，否則以拍攝時間對應最近的本機 GPS 點", () => {
    const route = makeRoute(4, 10_000);
    const exifPhoto = createTimelineEntry("ride", {
      uri: "file:///exif.jpg",
      exif: { DateTimeOriginal: "1970:01:01 00:00:10", GPSLatitude: 24.5, GPSLongitude: 121.5 },
    }, 1, 0);
    const timedPhoto = { id: "time", rideId: "ride", uri: "file:///time.jpg", selectedAt: 1, capturedAt: 129_000 };
    const markers = buildPhotoRouteMarkers([exifPhoto, timedPhoto], route);
    expect(markers[0]).toMatchObject({ source: "exif", latitude: 24.5, longitude: 121.5, altitude: 20 });
    expect(markers[1]).toMatchObject({ source: "route-time", latitude: route[2].latitude, altitude: 20 });
  });

  it("僅與較早的本機完整 1 km 努力比較，並辨識較快的新紀錄", () => {
    const history = makeRide("old", 1_000, makeRoute(12, 1_000));
    const currentRoute = makeRoute(12, 10_000).map((point, index) => ({ ...point, timestamp: 10_000 + index * 45_000 }));
    const current = makeRide("current", 2_000, currentRoute);
    current.duration = 500;
    current.movingTime = 500;
    const comparisons = compareLocalSplitPersonalBests(current, [history, current]);
    expect(comparisons.length).toBeGreaterThan(0);
    expect(comparisons[0].comparedEffortCount).toBeGreaterThan(0);
    expect(comparisons[0].isPersonalBest).toBe(true);
  });
});
