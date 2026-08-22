import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildManualRideLap, createNextRideLapAnchor } from "../lib/ride-lap";

const root = process.cwd();
const mapSource = readFileSync(resolve(root, "app/(tabs)/map.tsx"), "utf8");
const summarySource = readFileSync(resolve(root, "components/ride-summary-modal.tsx"), "utf8");

const activeLapState = {
  elapsed: 132,
  distance: 2_450,
  totalAscent: 48,
  totalDescent: 17,
  powerWorkJ: 21_600,
  powerSampleDurationSec: 120,
  route: [
    { speed: 6, timestamp: 0 },
    { speed: 7, timestamp: 60 },
  ],
  laps: [],
  lapAnchor: {
    elapsedSec: 12,
    distanceM: 250,
    ascentM: 8,
    descentM: 2,
    powerWorkJ: 1_600,
    powerSampleDurationSec: 10,
    routePointIndex: 0,
  },
} as any;

describe("專業手動 Lap 體驗", () => {
  it("封存剛完成單圈並以當前總計建立下一圈基準，總累計不會被歸零", () => {
    const lap = buildManualRideLap(activeLapState);
    expect(lap).toMatchObject({
      index: 1,
      startedAtElapsedSec: 12,
      endedAtElapsedSec: 132,
      movingTimeSec: 120,
      distanceM: 2_200,
      ascentM: 40,
      descentM: 15,
      averagePowerW: 182,
    });
    expect(lap?.averageSpeedKmh).toBeCloseTo(66, 3);

    const nextAnchor = createNextRideLapAnchor(activeLapState);
    expect(nextAnchor).toEqual({
      elapsedSec: 132,
      distanceM: 2_450,
      ascentM: 48,
      descentM: 17,
      powerWorkJ: 21_600,
      powerSampleDurationSec: 120,
      routePointIndex: 2,
    });
    expect(activeLapState.distance).toBe(2_450);
    expect(activeLapState.elapsed).toBe(132);
  });

  it("拒絕沒有時間或距離的空白 Lap", () => {
    expect(buildManualRideLap({ ...activeLapState, distance: 250 })).toBeNull();
  });

  it("提供四秒即時完成回饋、摘要 Lap 列表及不重疊的鎖定狀態堆疊", () => {
    expect(mapSource).toContain("const [lapFeedback, setLapFeedback]");
    expect(mapSource).toContain("buildManualRideLap(currentState)");
    expect(mapSource).toContain("}, 4_000);");
    expect(mapSource).toContain("Lap {lapFeedback.index} 已完成");
    expect(mapSource).toContain("touchGuardStatusStack");
    expect(summarySource).toContain("計圈（Laps）");
    expect(summarySource).toContain("laps.map((lap)");
    expect(summarySource).toContain("LapMetric label=\"均功率\"");
  });
});
