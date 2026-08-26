import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  advanceAutoLapMilestones,
  createAutoLapAnchor,
} from "../lib/auto-lap-milestones";

const root = process.cwd();
const mapSource = readFileSync(
  resolve(root, "app/(tabs)/map.tsx"),
  "utf8",
).replace(/\s+/g, " ");
const summarySource = readFileSync(
  resolve(root, "components/ride-summary-modal.tsx"),
  "utf8",
);
const rideContextSource = readFileSync(
  resolve(root, "lib/ride-context.tsx"),
  "utf8",
);

const initialTotals = {
  elapsedSec: 0,
  distanceM: 0,
  ascentM: 0,
  descentM: 0,
  powerWorkJ: 0,
  powerSampleDurationSec: 0,
};

describe("自動距離 Lap 體驗", () => {
  it("封存剛完成固定距離分圈，總累計不會被歸零或把 overshoot 併入圈內", () => {
    const result = advanceAutoLapMilestones(
      {
        elapsedSec: 132,
        distanceM: 1_020,
        ascentM: 48,
        descentM: 17,
        powerWorkJ: 21_600,
        powerSampleDurationSec: 120,
      },
      {
        enabled: true,
        intervalM: 1_000,
        nextDistanceM: 1_000,
        laps: [],
        anchor: createAutoLapAnchor(initialTotals),
        previousTotals: initialTotals,
      },
    );
    expect(result.laps).toHaveLength(1);
    expect(result.laps[0]).toMatchObject({
      index: 1,
      distanceM: 1_000,
      source: "auto",
    });
    expect(result.nextDistanceM).toBe(2_000);
  });

  it("自動距離 Lap 使用共用固定里程快照，保持導航畫面安靜並保存至摘要資料鏈", () => {
    expect(mapSource).toContain("advanceAutoLapMilestones");
    expect(mapSource).toContain('type: "SYNC_AUTO_LAPS"');
    expect(mapSource).toContain(
      "nextAutoLapDistanceMRef.current = result.nextDistanceM",
    );
    expect(mapSource).not.toContain("buildManualRideLap(currentState)");
    expect(mapSource).not.toContain("lapFeedbackToast");
    expect(mapSource).not.toContain("currentLapOverlay");
    expect(summarySource).toContain('t("summaryDetail.laps")');
    expect(summarySource).toContain("laps.map((lap)");
    expect(summarySource).toContain(
      "getLapPresentationMetrics(lapSportType, lap)",
    );
  });

  it("不再提供手動 Lap 按鈕、觸控範圍、Toast 或目前圈面板", () => {
    expect(mapSource).not.toContain("lapFloatingControlWrap");
    expect(mapSource).not.toContain("handleMarkLap");
    expect(mapSource).not.toContain(
      "hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}",
    );
    expect(mapSource).not.toContain("lapFeedback");
    expect(mapSource).not.toContain("currentLapOverlay");
  });

  it("連續自動計圈不設圈數上限，且以前景／背景完整快照同步", () => {
    expect(mapSource).toContain("syncBackgroundRideCheckpoint");
    expect(mapSource).toContain("bgState?.laps && bgState.autoLapAnchor");
    expect(rideContextSource).toContain('type: "SYNC_AUTO_LAPS"');
    expect(rideContextSource).not.toContain(
      'laps: action.laps.map((lap, index) => ({ ...lap, index: index + 1, source: "auto" })).slice',
    );
  });
});
