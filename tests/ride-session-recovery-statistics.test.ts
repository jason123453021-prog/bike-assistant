import { describe, expect, it } from "vitest";

import { addTrackPoint, createNewRideSession } from "../lib/ride-recovery/ride-session-recovery";

describe("騎乘復原會話統計", () => {
  it("以公尺保存距離，並只累積有效移動樣本的時間", () => {
    const session = createNewRideSession();
    const start = 1_700_000_000_000;
    addTrackPoint(session, { timestamp: start, latitude: 25, longitude: 121, altitude: 100, speed: 4 });
    addTrackPoint(session, { timestamp: start + 3_000, latitude: 25.00015, longitude: 121, altitude: 104, speed: 4 }, session.trackPoints.at(-1));
    addTrackPoint(session, { timestamp: start + 6_000, latitude: 25.0003, longitude: 121, altitude: 112, speed: 4 }, session.trackPoints.at(-1));

    expect(session.stats.totalDistance).toBeGreaterThan(20);
    expect(session.stats.totalDistance).toBeLessThan(40);
    expect(session.stats.totalTime).toBe(6_000);
    expect(session.stats.averageSpeed).toBeGreaterThan(13);
    expect(session.stats.totalElevationGain).toBeGreaterThanOrEqual(12);
  });

  it("不把長時間定位中斷與海拔小幅抖動累加為移動時間或爬升", () => {
    const session = createNewRideSession();
    const start = 1_700_000_000_000;
    addTrackPoint(session, { timestamp: start, latitude: 25, longitude: 121, altitude: 100, speed: 0 });
    addTrackPoint(session, { timestamp: start + 3_000, latitude: 25.00002, longitude: 121, altitude: 106, speed: 0 }, session.trackPoints.at(-1));
    addTrackPoint(session, { timestamp: start + 70_000, latitude: 25.00004, longitude: 121, altitude: 109, speed: 0 }, session.trackPoints.at(-1));

    expect(session.stats.totalTime).toBe(3_000);
    expect(session.stats.totalElevationGain).toBe(0);
  });

  it("保留暫停期間的已接受原始點，但不累積距離、移動時間或海拔", () => {
    const session = createNewRideSession();
    const start = 1_700_000_000_000;
    addTrackPoint(session, { timestamp: start, latitude: 25, longitude: 121, altitude: 100, speed: 4 });
    addTrackPoint(session, {
      timestamp: start + 3_000,
      latitude: 25.0002,
      longitude: 121,
      altitude: 120,
      speed: 0,
      recordedDuringPause: true,
    }, session.trackPoints.at(-1));

    expect(session.trackPoints).toHaveLength(2);
    expect(session.trackPoints.at(-1)?.recordedDuringPause).toBe(true);
    expect(session.stats.totalDistance).toBe(0);
    expect(session.stats.totalTime).toBe(0);
    expect(session.stats.totalElevationGain).toBe(0);
  });
});
