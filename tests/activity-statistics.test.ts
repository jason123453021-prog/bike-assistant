import { describe, expect, it } from "vitest";
import { buildActivityStatistics, resolveStatisticsIntervalSec, resolveStatisticsSpeedMs } from "../lib/activity-statistics";

describe("活動統計統一計算", () => {
  it("以移動時間計算平均速度，並讓活動總時間等於移動加暫停", () => {
    const stats = buildActivityStatistics({
      distanceM: 30_000,
      movingTimeSec: 3_600,
      pausedTimeSec: 900,
      totalAscentM: 420,
      totalDescentM: 410,
      minElevationM: 12,
      maxElevationM: 532,
      maxSpeedKmh: 52.6,
      maxPowerW: 620,
      powerWorkJ: 720_000,
      powerSampleDurationSec: 3_600,
      caloriesKcal: 850.4,
      powerSource: "estimated",
      caloriesSource: "power-estimate",
    });

    expect(stats.elapsedTimeSec).toBe(4_500);
    expect(stats.averageSpeedKmh).toBe(30);
    expect(stats.averagePowerW).toBe(200);
    expect(stats.totalWorkKj).toBe(720);
    expect(stats.averageGradePct).toBeCloseTo(1.4, 6);
    expect(stats.totalDescentM).toBe(410);
    expect(stats.powerSource).toBe("estimated");
  });

  it("在沒有有效功率樣本時不虛構平均功率或工作量", () => {
    const stats = buildActivityStatistics({
      distanceM: 0,
      movingTimeSec: 0,
      pausedTimeSec: 0,
      totalAscentM: 0,
      totalDescentM: 0,
      maxSpeedKmh: 0,
      maxPowerW: 0,
      powerWorkJ: 0,
      powerSampleDurationSec: 0,
      caloriesKcal: 0,
      powerSource: "unavailable",
      caloriesSource: "unavailable",
    });

    expect(stats.averageSpeedKmh).toBe(0);
    expect(stats.averagePowerW).toBeUndefined();
    expect(stats.maxPowerW).toBeUndefined();
    expect(stats.totalWorkKj).toBeUndefined();
    expect(stats.averageGradePct).toBeUndefined();
  });

  it("不會在來源標記為估算但實際沒有任何瓦數時顯示 0 W 最大功率", () => {
    const stats = buildActivityStatistics({
      distanceM: 8_000,
      movingTimeSec: 1_800,
      pausedTimeSec: 0,
      totalAscentM: 120,
      totalDescentM: 110,
      maxSpeedKmh: 38,
      maxPowerW: 0,
      powerWorkJ: 0,
      powerSampleDurationSec: 1_800,
      caloriesKcal: 420,
      powerSource: "estimated",
      caloriesSource: "power-estimate",
    });

    expect(stats.powerSource).toBe("unavailable");
    expect(stats.averagePowerW).toBeUndefined();
    expect(stats.maxPowerW).toBeUndefined();
  });

  it("只接受合理且連續的定位樣本時間，避免背景中斷被當成持續功率輸出", () => {
    expect(resolveStatisticsIntervalSec(1_000, 4_500)).toBe(3.5);
    expect(resolveStatisticsIntervalSec(1_000, 21_000)).toBe(20);
    expect(resolveStatisticsIntervalSec(1_000, 35_000)).toBe(0);
    expect(resolveStatisticsIntervalSec(5_000, 4_000)).toBe(0);
  });

  it("功率與卡路里優先使用已接受距離推導的區間速度，不採用飆高原始速度", () => {
    expect(resolveStatisticsSpeedMs({ acceptedDistanceM: 150, intervalSec: 20, rawSpeedMs: 18 })).toBe(7.5);
    expect(resolveStatisticsSpeedMs({ acceptedDistanceM: 0, intervalSec: 0, rawSpeedMs: 8 })).toBe(8);
  });
});
