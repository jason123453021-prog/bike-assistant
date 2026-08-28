import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { advanceAutoLapMilestones, createAutoLapAnchor } from "../lib/auto-lap-milestones";

const projectRoot = resolve(__dirname, "..");
const initialTotals = {
  elapsedSec: 0,
  distanceM: 0,
  ascentM: 0,
  descentM: 0,
  powerWorkJ: 0,
  powerSampleDurationSec: 0,
};

describe("背景自動距離記圈里程碑", () => {
  it("在固定 1 km 邊界插值封存，不能把 GPS overshoot 併入同一圈", () => {
    const initial = {
      enabled: true,
      intervalM: 1_000,
      nextDistanceM: 1_000,
      laps: [],
      anchor: createAutoLapAnchor(initialTotals),
    };
    const before = advanceAutoLapMilestones({
      elapsedSec: 299,
      distanceM: 999,
      ascentM: 23,
      descentM: 12,
      powerWorkJ: 47_840,
      powerSampleDurationSec: 299,
    }, initial);
    expect(before.completedLaps).toEqual([]);
    expect(before.nextDistanceM).toBe(1_000);

    const first = advanceAutoLapMilestones({
      elapsedSec: 300,
      distanceM: 1_005,
      ascentM: 24,
      descentM: 12,
      powerWorkJ: 48_000,
      powerSampleDurationSec: 300,
    }, { ...initial, ...before });
    expect(first.completedLaps).toHaveLength(1);
    expect(first.laps[0]).toMatchObject({
      index: 1,
      source: "auto",
      distanceM: 1_000,
      descentM: 12,
      averagePowerW: 160,
    });
    expect(first.laps[0].movingTimeSec).toBeCloseTo(299.17, 2);
    expect(first.laps[0].ascentM).toBeCloseTo(23.17, 2);
    expect(first.nextDistanceM).toBe(2_000);

    const second = advanceAutoLapMilestones({
      elapsedSec: 610,
      distanceM: 2_001,
      ascentM: 40,
      descentM: 31,
      powerWorkJ: 97_600,
      powerSampleDurationSec: 610,
    }, { ...initial, ...first });
    expect(second.laps).toHaveLength(2);
    expect(second.laps[1]).toMatchObject({
      index: 2,
      distanceM: 1_000,
      averagePowerW: 160,
    });
    expect(second.laps[1].movingTimeSec).toBeCloseTo(310.52, 2);
    expect(second.laps[1].ascentM).toBeCloseTo(16.82, 2);
    expect(second.laps[1].descentM).toBeCloseTo(18.98, 2);
  });

  it("單一位置批次跨越多個里程碑時補齊每一圈，且絕不建立零距離分段", () => {
    const result = advanceAutoLapMilestones({
      elapsedSec: 620,
      distanceM: 3_100,
      ascentM: 62,
      descentM: 31,
      powerWorkJ: 99_200,
      powerSampleDurationSec: 620,
    }, {
      enabled: true,
      intervalM: 1_000,
      nextDistanceM: 1_000,
      laps: [],
      anchor: createAutoLapAnchor(initialTotals),
      previousTotals: initialTotals,
    });

    expect(result.completedLaps).toHaveLength(3);
    expect(result.laps.map((lap) => lap.distanceM)).toEqual([1_000, 1_000, 1_000]);
    expect(result.laps.every((lap) => lap.movingTimeSec > 0 && lap.averageSpeedKmh! < 100)).toBe(true);
    expect(result.nextDistanceM).toBe(4_000);
  });

  it("在使用者關閉計圈後保留既有分段，但不再建立新圈", () => {
    const result = advanceAutoLapMilestones({
      elapsedSec: 600,
      distanceM: 3_000,
      ascentM: 60,
      descentM: 30,
      powerWorkJ: 90_000,
      powerSampleDurationSec: 600,
    }, {
      enabled: false,
      intervalM: 1_000,
      nextDistanceM: 1_000,
      laps: [{
        index: 1,
        source: "auto",
        startedAtElapsedSec: 0,
        endedAtElapsedSec: 300,
        movingTimeSec: 300,
        distanceM: 1_000,
        ascentM: 20,
        descentM: 10,
      }],
      anchor: createAutoLapAnchor(initialTotals),
    });
    expect(result.laps).toHaveLength(1);
    expect(result.completedLaps).toEqual([]);
    expect(result.nextDistanceM).toBeNull();
  });

  it("背景追蹤持久化精確 Lap 快照，非單車模式使用共用的 MET 熱量估算", () => {
    const backgroundSource = readFileSync(resolve(projectRoot, "lib/background-location.ts"), "utf8");
    const mapSource = readFileSync(resolve(projectRoot, "app/(tabs)/map.tsx"), "utf8");

    expect(backgroundSource).toContain("advanceAutoLapMilestones");
    expect(backgroundSource).toContain("previousAutoLapTotals");
    expect(backgroundSource).toContain("syncBackgroundRideCheckpoint");
    expect(backgroundSource).toContain("estimateSportCalories");
    expect(backgroundSource).toContain('sportType === "cycling"');
    expect(mapSource).toContain('type: "SYNC_AUTO_LAPS"');
    expect(mapSource).toContain("syncBackgroundRideCheckpoint");
    expect(mapSource).not.toContain('if (point.autoLapCompleted) dispatch({ type: "MARK_LAP" });');
    expect(mapSource).toContain("const contextSnapshot = await checkSnapshot();");
    expect(mapSource).toContain("const restoredLaps = backgroundState?.laps?.length");
    expect(mapSource).toContain("laps: restoredLaps,");
  });
});
