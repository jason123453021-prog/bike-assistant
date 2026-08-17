import { describe, expect, it } from "vitest";
import { buildRideTimeTotals, calculatePausedSeconds } from "../lib/ride-time-accounting";

describe("ride time accounting", () => {
  it("updates one ongoing pause from its timestamp instead of adding foreground ticks twice", () => {
    expect(calculatePausedSeconds({
      pauseStartedAtMs: 1_000,
      pauseStartedTotalSec: 45,
      currentTotalPausedSec: 72,
      nowMs: 28_600,
    })).toBe(73);
  });

  it("preserves completed pause time when there is no active pause", () => {
    expect(calculatePausedSeconds({
      pauseStartedAtMs: null,
      pauseStartedTotalSec: null,
      currentTotalPausedSec: 73,
      nowMs: 99_000,
    })).toBe(73);
  });

  it("stores a total activity duration while keeping moving time distinct", () => {
    expect(buildRideTimeTotals(3_600, 420)).toEqual({
      movingTime: 3_600,
      totalPausedSec: 420,
      elapsedDuration: 4_020,
    });
  });
});
