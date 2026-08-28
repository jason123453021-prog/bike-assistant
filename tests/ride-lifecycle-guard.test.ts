import { describe, expect, it } from "vitest";

import {
  canPauseRide,
  canResetCompletedRide,
  canResumeRide,
  canStartRide,
  canStopRide,
  shouldAccumulateRideStatistics,
} from "../lib/ride-lifecycle-guard";

describe("唯一騎乘生命週期守門", () => {
  it("只有 idle 或已完成活動可開始新一趟，導航與 GPX 不能重啟進行中的騎乘", () => {
    expect(canStartRide("idle")).toBe(true);
    expect(canStartRide("finished")).toBe(true);
    expect(canStartRide("active")).toBe(false);
    expect(canStartRide("paused")).toBe(false);
  });

  it("只有使用者正在騎乘或暫停時可明確停止，且只有停止後可重置", () => {
    expect(canStopRide("active")).toBe(true);
    expect(canStopRide("paused")).toBe(true);
    expect(canStopRide("idle")).toBe(false);
    expect(canResetCompletedRide("finished")).toBe(true);
    expect(canResetCompletedRide("active")).toBe(false);
  });

  it("只允許 active 暫停，並只允許 paused 恢復", () => {
    expect(canPauseRide("active")).toBe(true);
    expect(canPauseRide("idle")).toBe(false);
    expect(canResumeRide("paused")).toBe(true);
    expect(canResumeRide("active")).toBe(false);
  });

  it("臨時導航或 GPX 即使觸發定位，只有 active 狀態可寫入騎乘累計", () => {
    expect(shouldAccumulateRideStatistics("active")).toBe(true);
    expect(shouldAccumulateRideStatistics("idle")).toBe(false);
    expect(shouldAccumulateRideStatistics("paused")).toBe(false);
    expect(shouldAccumulateRideStatistics("finished")).toBe(false);
  });
});
