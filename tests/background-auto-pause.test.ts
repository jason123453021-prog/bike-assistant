import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  advanceBackgroundAutoPause,
  normalizeAutoPauseSpeedKmh,
  resolveAutoPauseResumeThresholdKmh,
} from "../lib/background-auto-pause";

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

  it("將 null、undefined、NaN 與負數速度安全視為 0，首輪距離為 0 仍在 8 秒後暫停", () => {
    expect(normalizeAutoPauseSpeedKmh(null)).toBe(0);
    expect(normalizeAutoPauseSpeedKmh(undefined)).toBe(0);
    expect(normalizeAutoPauseSpeedKmh(Number.NaN)).toBe(0);
    expect(normalizeAutoPauseSpeedKmh(-2)).toBe(0);

    const waitingForGps = advanceBackgroundAutoPause({ ...base, speedKmh: Number.NaN, intervalSec: 8 });
    expect(waitingForGps).toMatchObject({ paused: true, accumulatedLowSpeedSec: 8, movingTimeIncrementSec: 8 });
  });

  it("保留 0.5 km/h 恢復遲滯：1.5 km/h 飄移不清除防抖，1.6 km/h 立即恢復", () => {
    expect(resolveAutoPauseResumeThresholdKmh(1.1, 0)).toBe(1.6);
    const jitter = advanceBackgroundAutoPause({
      ...base,
      pauseBelowKmh: 1.1,
      resumeAtOrAboveKmh: 1.6,
      accumulatedLowSpeedSec: 5,
      speedKmh: 1.5,
      intervalSec: 1,
    });
    expect(jitter).toMatchObject({ paused: false, accumulatedLowSpeedSec: 5, movingTimeIncrementSec: 1 });

    const resumes = advanceBackgroundAutoPause({
      ...base,
      pauseBelowKmh: 1.1,
      resumeAtOrAboveKmh: 1.6,
      paused: true,
      accumulatedLowSpeedSec: 8,
      hasReliableMovement: true,
      speedKmh: 1.6,
      intervalSec: 1,
    });
    expect(resumes).toMatchObject({ paused: false, accumulatedLowSpeedSec: 0, movingTimeIncrementSec: 1 });
  });

  it("關閉單車自動暫停時，背景不會凍結移動時間", () => {
    const result = advanceBackgroundAutoPause({ ...base, enabled: false, intervalSec: 10 });
    expect(result).toEqual({ paused: false, accumulatedLowSpeedSec: 0, movingTimeIncrementSec: 10 });
  });

  it("背景任務以同一狀態機凍結距離與功率，且維持絕對時間倒數", () => {
    const source = readFileSync(resolve(__dirname, "../lib/background-location.ts"), "utf8");
    expect(source).toContain("advanceBackgroundAutoPause");
    expect(source).toContain("if (!isReliablyMovingForSupply)");
    expect(source).toMatch(
      /state\.movingTimeSec\s*=\s*\(state\.movingTimeSec\s*\?\?\s*0\)\s*\+\s*statisticsIntervalSec/,
    );
    expect(source).toContain("markBackgroundSmartSupplyPaused");
    expect(source).toContain("settleBackgroundSmartSupplyPause");
    expect(source).toContain("smartCalorieCountdownDueAtMs");
  });
});
