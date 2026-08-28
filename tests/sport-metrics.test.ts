import { describe, expect, it } from "vitest";
import {
  SPORT_TRACKING_POLICIES,
  buildSportDashboardMetrics,
  calculateGapPaceSecPerKm,
  calculateVamMPerHour,
  estimateSportCalories,
  formatPaceFromKmh,
  smoothSpeedKmh,
} from "../lib/sport-metrics";

describe("sport metrics", () => {
  it("formats pace and smooths recent speed samples for running", () => {
    expect(formatPaceFromKmh(12)).toBe("05'00\"");
    expect(smoothSpeedKmh([
      { speedKmh: 10, timestamp: 0 },
      { speedKmh: 12, timestamp: 4_000 },
      { speedKmh: 14, timestamp: 8_000 },
    ])).toBe(12);
  });

  it("calculates GAP and VAM with sport-specific GPS / pause policies", () => {
    const uphillGap = calculateGapPaceSecPerKm(360, 8);
    expect(uphillGap).not.toBeNull();
    expect(uphillGap!).toBeLessThan(360);
    expect(calculateVamMPerHour([
      { altitudeM: 100, timestamp: 0 },
      { altitudeM: 106, timestamp: 30_000 },
    ])).toBe(720);
    expect(SPORT_TRACKING_POLICIES.hiking.gpsDistanceIntervalM).toBe(1.5);
    expect(SPORT_TRACKING_POLICIES.hiking.autoPause.mode).toBe("suggest");
  });

  it("splits dashboard fields and calorie estimates by sport", () => {
    const running = buildSportDashboardMetrics({
      sportType: "running", speedKmh: 12, averageSpeedKmh: 11, distanceM: 5000, elapsedSec: 1500,
      altitudeM: 30, totalAscentM: 20, gradePct: 0,
    });
    const hiking = buildSportDashboardMetrics({
      sportType: "hiking", speedKmh: 3, averageSpeedKmh: 3, distanceM: 5000, elapsedSec: 3600,
      altitudeM: 860, totalAscentM: 400, gradePct: 12, vamMPerHour: 450,
    });
    expect(running.map((metric) => metric.label)).toContain("當前配速");
    expect(hiking.map((metric) => metric.label)).toContain("爬升速度");
    expect(estimateSportCalories({ sportType: "trail_running", weightKg: 70, durationSec: 3600, speedKmh: 9, gradePct: 10, vamMPerHour: 500 }))
      .toBeGreaterThan(estimateSportCalories({ sportType: "running", weightKg: 70, durationSec: 3600, speedKmh: 9 }));
  });
});
