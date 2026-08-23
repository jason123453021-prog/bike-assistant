import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { advanceBackgroundAutoPause } from "../lib/background-auto-pause";

describe("背景自動暫停與前景一致性", () => {
  const base = {
    paused: false,
    accumulatedLowSpeedSec: 0,
    hasReliableMovement: false,
    speedKmh: 0,
    enabled: true,
    pauseBelowKmh: 1.08,
    pauseAfterSec: 8,
    resumeAtOrAboveKmh: 1.8,
  };

  it("低速前 8 秒仍保留移動時間，跨過門檻時只保留門檻前的秒數", () => {
    const beforeDebounce = advanceBackgroundAutoPause({ ...base, intervalSec: 5 });
    expect(beforeDebounce).toMatchObject({ paused: false, accumulatedLowSpeedSec: 5, movingTimeIncrementSec: 5 });

    const entersPause = advanceBackgroundAutoPause({ ...base, accumulatedLowSpeedSec: 5, intervalSec: 5 });
    expect(entersPause).toMatchObject({ paused: true, accumulatedLowSpeedSec: 8, movingTimeIncrementSec: 3, pauseStartedBeforeSampleEndSec: 2 });
  });

  it("已暫停時只在可靠移動且達 1.8 km/h 恢復，並從恢復樣本重新累計", () => {
    const remainsPaused = advanceBackgroundAutoPause({
      ...base,
      paused: true,
      accumulatedLowSpeedSec: 8,
      hasReliableMovement: true,
      speedKmh: 1.7,
      intervalSec: 4,
    });
    expect(remainsPaused).toMatchObject({ paused: true, movingTimeIncrementSec: 0 });

    const resumes = advanceBackgroundAutoPause({
      ...base,
      paused: true,
      accumulatedLowSpeedSec: 8,
      hasReliableMovement: true,
      speedKmh: 1.8,
      intervalSec: 4,
    });
    expect(resumes).toMatchObject({ paused: false, accumulatedLowSpeedSec: 0, movingTimeIncrementSec: 4 });
  });

  it("關閉單車自動暫停時，背景不會凍結移動時間", () => {
    const result = advanceBackgroundAutoPause({ ...base, enabled: false, intervalSec: 10 });
    expect(result).toEqual({ paused: false, accumulatedLowSpeedSec: 0, movingTimeIncrementSec: 10 });
  });

  it("背景任務以同一狀態機凍結距離與功率，僅在防抖期保留移動時間", () => {
    const source = readFileSync(resolve(__dirname, "../lib/background-location.ts"), "utf8");
    expect(source).toContain("advanceBackgroundAutoPause");
    expect(source).toContain("if (!isReliablyMovingForSupply)");
    expect(source).toContain("state.movingTimeSec = (state.movingTimeSec ?? 0) + statisticsIntervalSec;");
    expect(source).toContain("state.supplyCountdownPausedAtMs ??=");
  });
});
