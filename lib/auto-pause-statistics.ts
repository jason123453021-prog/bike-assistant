import { calculatePausedSeconds } from "./ride-time-accounting";

export type AutoPauseSource = "manual" | "automatic" | null;

export function calculateAutoPausedSeconds(input: {
  source: AutoPauseSource;
  autoPauseStartedAtMs: number | null;
  autoPauseStartedTotalSec: number | null;
  currentAutoPausedSec: number;
  nowMs: number;
}): number {
  if (input.source !== "automatic") return Math.max(0, input.currentAutoPausedSec);
  return calculatePausedSeconds({
    pauseStartedAtMs: input.autoPauseStartedAtMs,
    pauseStartedTotalSec: input.autoPauseStartedTotalSec,
    currentTotalPausedSec: input.currentAutoPausedSec,
    nowMs: input.nowMs,
  });
}

/** 合併背景已確認的自動暫停，不讓背景舊快照覆寫前景較新的累積值。 */
export function mergeAutoPausedSeconds(
  totalPausedSec: number,
  localAutoPausedSec: number,
  backgroundAutoPausedSec: number,
) {
  const autoPausedSec = Math.max(0, localAutoPausedSec, backgroundAutoPausedSec);
  return {
    autoPausedSec,
    totalPausedSec: Math.max(0, totalPausedSec, autoPausedSec),
  };
}
