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
  it("只在跨越固定距離門檻時封存一次完整快照，並將下一圈錨點前移", () => {
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
      movingTimeSec: 300,
      distanceM: 1_005,
      ascentM: 24,
      descentM: 12,
      averagePowerW: 160,
    });
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
      movingTimeSec: 310,
      distanceM: 996,
      ascentM: 16,
      descentM: 19,
      averagePowerW: 160,
    });
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

  it("背景追蹤持久化 Lap 旗標，非單車模式使用共用的 MET 熱量估算", () => {
    const backgroundSource = readFileSync(resolve(projectRoot, "lib/background-location.ts"), "utf8");
    const mapSource = readFileSync(resolve(projectRoot, "app/(tabs)/map.tsx"), "utf8");

    expect(backgroundSource).toContain("advanceAutoLapMilestones");
    expect(backgroundSource).toContain("autoLapCompleted");
    expect(backgroundSource).toContain("estimateSportCalories");
    expect(backgroundSource).toContain('sportType === "cycling"');
    expect(mapSource).toContain('if (point.autoLapCompleted) dispatch({ type: "MARK_LAP" });');
    expect(mapSource).toContain("const contextSnapshot = await checkSnapshot();");
    expect(mapSource).toContain("const restoredLaps = backgroundState?.laps?.length");
    expect(mapSource).toContain("laps: restoredLaps,");
  });
});
