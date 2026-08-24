import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateAutoPausedSeconds, mergeAutoPausedSeconds } from "../lib/auto-pause-statistics";
import { normalizeRideRecord } from "../lib/ride-record-normalizer";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("活動自動暫停統計", () => {
  it("只累計自動暫停，手動暫停仍計入總暫停但不污染自動統計", () => {
    expect(calculateAutoPausedSeconds({
      source: "automatic",
      autoPauseStartedAtMs: 2_000,
      autoPauseStartedTotalSec: 0,
      currentAutoPausedSec: 0,
      nowMs: 12_000,
    })).toBe(10);
    expect(calculateAutoPausedSeconds({
      source: "manual",
      autoPauseStartedAtMs: null,
      autoPauseStartedTotalSec: null,
      currentAutoPausedSec: 10,
      nowMs: 25_000,
    })).toBe(10);
  });

  it("將背景已確認的自動暫停回補至總暫停，且舊活動安全回退為 0", () => {
    expect(mergeAutoPausedSeconds(12, 8, 38)).toEqual({ autoPausedSec: 38, totalPausedSec: 38 });

    const legacy = normalizeRideRecord({ id: "legacy", date: 1, name: "舊活動", duration: 120, distance: 0, totalPausedSec: 20, route: [] });
    expect(legacy?.autoPausedSec).toBe(0);
    expect(legacy?.totalPausedSec).toBe(20);
  });

  it("在活動詳情與分享文字呈現自動暫停總時間", () => {
    const detailSource = source("app/ride-detail.tsx");
    expect(detailSource).toContain('label="自動暫停總時間"');
    expect(detailSource).toContain("自動暫停時間：");
    expect(detailSource).toContain("record.autoPausedSec ?? 0");
  });
});
