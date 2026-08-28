import { describe, expect, it } from "vitest";
import {
  evaluateTrackPoint,
  filterTrackPointBatch,
  TRACK_RESUME_GAP_MS,
} from "../lib/track-point-quality";

const origin = { latitude: 25.0478, longitude: 121.5319, timestamp: 1_000, accuracy: 8 };

describe("背景與鎖定螢幕軌跡品質", () => {
  it("拒絕低精度、倒退時間與短時間不合理高速跳點", () => {
    expect(evaluateTrackPoint(origin, { ...origin, latitude: 25.048, timestamp: 2_000, accuracy: 120 })).toMatchObject({ accepted: false, reason: "poor-accuracy" });
    expect(evaluateTrackPoint(origin, { ...origin, latitude: 25.048, timestamp: 900, accuracy: 8 })).toMatchObject({ accepted: false, reason: "stale-timestamp" });
    expect(evaluateTrackPoint(origin, { latitude: 25.1478, longitude: 121.5319, timestamp: 2_000, accuracy: 8 })).toMatchObject({ accepted: false, reason: "impossible-speed" });
  });

  it("在鎖定期間的長中斷後保留可靠新點但開啟安全斷點", () => {
    const resumed = evaluateTrackPoint(origin, {
      latitude: 25.0678,
      longitude: 121.5319,
      timestamp: origin.timestamp + TRACK_RESUME_GAP_MS + 1,
      accuracy: 9,
    });
    expect(resumed).toMatchObject({ accepted: true, segmentStart: true, reason: "resume-gap" });
  });

  it("排序背景批次、排除壞點，並保留既有或新產生的安全斷點", () => {
    const points = filterTrackPointBatch([
      { latitude: 25.0678, longitude: 121.5319, timestamp: 80_000, accuracy: 9, segmentStart: true },
      { latitude: 25.0479, longitude: 121.5319, timestamp: 2_000, accuracy: 7 },
      { latitude: 25.1478, longitude: 121.5319, timestamp: 3_000, accuracy: 7 },
    ], origin);
    expect(points).toHaveLength(2);
    expect(points[0].timestamp).toBe(2_000);
    expect(points[1]).toMatchObject({ timestamp: 80_000, segmentStart: true });
  });
});
