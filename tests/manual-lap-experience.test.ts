import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildManualRideLap, createNextRideLapAnchor } from "../lib/ride-lap";

const root = process.cwd();
const mapSource = readFileSync(resolve(root, "app/(tabs)/map.tsx"), "utf8");
const summarySource = readFileSync(resolve(root, "components/ride-summary-modal.tsx"), "utf8");
const rideContextSource = readFileSync(resolve(root, "lib/ride-context.tsx"), "utf8");

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

describe("自動距離 Lap 體驗", () => {
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

  it("自動距離 Lap 使用共用快照，保持導航畫面安靜並保存至摘要資料鏈", () => {
    expect(mapSource).toContain("buildManualRideLap(currentState)");
    expect(mapSource).toContain('dispatch({ type: "MARK_LAP" });');
    expect(mapSource).toContain("nextAutoLapDistanceMRef.current = nextDistanceM + intervalM");
    expect(mapSource).not.toContain('completeCurrentLap("manual")');
    expect(mapSource).not.toContain("lapFeedbackToast");
    expect(mapSource).not.toContain("currentLapOverlay");
    expect(summarySource).toContain("計圈（Laps）");
    expect(summarySource).toContain("laps.map((lap)");
    expect(summarySource).toContain("getLapPresentationMetrics(lapSportType, lap)");
  });

  it("不再提供手動 Lap 按鈕、觸控範圍、Toast 或目前圈面板", () => {
    expect(mapSource).not.toContain("lapFloatingControlWrap");
    expect(mapSource).not.toContain("handleMarkLap");
    expect(mapSource).not.toContain('hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}');
    expect(mapSource).not.toContain("lapFeedback");
    expect(mapSource).not.toContain("currentLapOverlay");
  });

  it("連續自動計圈不設圈數上限，且快照與分派例外不會中斷騎乘", () => {
    expect(mapSource).toContain('try {\n      const currentState = stateRef.current;');
    expect(mapSource).toContain("計圈失敗時保留進行中的騎乘與導航");
    expect(rideContextSource).toContain('laps: [...state.laps, { ...lap, source: "auto" }],');
    expect(rideContextSource).not.toContain('laps: [...state.laps, { ...lap, source: "auto" }].slice(-100)');
  });
});
