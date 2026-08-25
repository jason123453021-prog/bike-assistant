import { describe, expect, it } from "vitest";
import { createGpxContent, createGpxFilename } from "../lib/gpx-export";
import type { RideRecord } from "../lib/ride-context";

const record: RideRecord = {
  id: "gpx-1", date: 1_725_000_000_000, name: "河濱 <晨騎>", duration: 1800, distance: 8000,
  avgSpeed: 16, maxSpeed: 25, totalAscent: 35, calories: 220, avgPower: 120, maxPower: 240,
  powerZones: [], powerHistory: [], totalSweatMl: 300, refillCount: 0, totalPausedSec: 0,
  route: [
    { latitude: 25.01, longitude: 121.50, altitude: 10, speed: 5, timestamp: 1_725_000_000_000, heartRate: 140, cadence: 85, power: 180 },
    { latitude: 25.02, longitude: 121.51, altitude: 20, speed: 6, timestamp: 1_725_000_600_000 },
  ],
};

describe("createGpxContent", () => {
  it("建立含軌跡、時間、海拔與命名空間擴充資料的標準 GPX", () => {
    const gpx = createGpxContent(record);
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain("河濱 &lt;晨騎&gt;");
    expect(gpx).toContain("<trkpt lat=\"25.0100000\" lon=\"121.5000000\">");
    expect(gpx).toContain("<gpxtpx:hr>140</gpxtpx:hr>");
    expect(gpx).toContain("<bikeassistant:power>180</bikeassistant:power>");
  });

  it("在軌跡不足時拒絕匯出，並產生安全檔名", () => {
    expect(createGpxContent({ ...record, route: [record.route[0]] })).toBeNull();
    expect(createGpxFilename(record)).toMatch(/^(?:activity|活動)-河濱-晨騎-\d{4}-\d{2}-\d{2}\.gpx$/);
  });

  it("依多運動類型寫入 metadata 與 track type", () => {
    const gpx = createGpxContent({ ...record, sportType: "trail_running" });
    expect(gpx).toContain("<type>Trail Running</type>");
  });

  it("完整保留已接受的暫停期間 GPS 點及原始時間戳，不以自動暫停過濾輸出", () => {
    const pausedTimestamp = 1_725_000_300_000;
    const gpx = createGpxContent({
      ...record,
      route: [
        record.route[0],
        {
          latitude: 25.015,
          longitude: 121.505,
          altitude: 12,
          speed: 0,
          timestamp: pausedTimestamp,
          recordedDuringPause: true,
        },
        record.route[1],
      ],
    });
    expect(gpx).toContain('<trkpt lat="25.0150000" lon="121.5050000">');
    expect(gpx).toContain(`<time>${new Date(pausedTimestamp).toISOString()}</time>`);
  });
});
