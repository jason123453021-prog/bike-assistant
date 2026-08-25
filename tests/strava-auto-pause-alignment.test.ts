import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SPORT_MODEL_PROFILES } from "../lib/model-governance";
import { advanceBackgroundAutoPause } from "../lib/background-auto-pause";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Strava 公開原則的自動暫停對齊", () => {
  it("單車採 10 秒 GPS 靜止防抖，不對使用者暴露速度或秒數微調", () => {
    expect(SPORT_MODEL_PROFILES.cycling.tracking.autoPauseStillForSeconds).toBe(
      10,
    );
    const settingsSource = source("app/(tabs)/settings.tsx");
    expect(settingsSource).toContain('t("settings.autoPauseRules")');
    expect(settingsSource).toContain('t("settings.autoPauseDescription")');
    expect(settingsSource).not.toContain("自動暫停速度門檻");
    expect(settingsSource).not.toContain("自動暫停延遲時間");
  });

  it("無正速度定位達 10 秒進入暫停，恢復同時需要可信位移與足夠速度", () => {
    const paused = advanceBackgroundAutoPause({
      paused: false,
      accumulatedLowSpeedSec: 0,
      hasReliableMovement: false,
      speedKmh: 0,
      intervalSec: 10,
      enabled: true,
      pauseBelowKmh: 1.08,
      pauseAfterSec: 10,
      resumeAtOrAboveKmh: 1.58,
    });
    expect(paused.paused).toBe(true);

    const noDisplacement = advanceBackgroundAutoPause({
      paused: true,
      accumulatedLowSpeedSec: 10,
      hasReliableMovement: false,
      speedKmh: 3,
      intervalSec: 1,
      enabled: true,
      pauseBelowKmh: 1.08,
      pauseAfterSec: 10,
      resumeAtOrAboveKmh: 1.58,
    });
    expect(noDisplacement.paused).toBe(true);

    const resumes = advanceBackgroundAutoPause({
      ...noDisplacement,
      hasReliableMovement: true,
      speedKmh: 3,
      intervalSec: 1,
      enabled: true,
      pauseBelowKmh: 1.08,
      pauseAfterSec: 10,
      resumeAtOrAboveKmh: 1.58,
    });
    expect(resumes.paused).toBe(false);
  });

  it("保留公開對齊依據並清楚排除 Strava 專有程式碼宣稱", () => {
    const reference = source(
      "references/strava-auto-pause-alignment-2026-08-24.md",
    );
    expect(reference).toContain("不宣稱取得或重製 Strava 的專有程式碼");
    expect(reference).toContain("超過 10 秒未收到正速度定位");
  });
});
