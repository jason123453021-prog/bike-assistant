/** 依單次暫停的開始時間與累積基準，計算不重複的暫停秒數。 */
export function calculatePausedSeconds(input: {
  pauseStartedAtMs: number | null;
  pauseStartedTotalSec: number | null;
  currentTotalPausedSec: number;
  nowMs: number;
}): number {
  if (!input.pauseStartedAtMs) return Math.max(0, input.currentTotalPausedSec);
  const currentPauseSec = Math.max(0, Math.round((input.nowMs - input.pauseStartedAtMs) / 1000));
  return Math.max(0, input.pauseStartedTotalSec ?? input.currentTotalPausedSec) + currentPauseSec;
}

/** 即時 elapsed 只計移動時間；儲存紀錄時另組成總經過時間。 */
export function buildRideTimeTotals(movingElapsedSec: number, totalPausedSec: number) {
  const movingTime = Math.max(0, Math.round(movingElapsedSec));
  const pausedTime = Math.max(0, Math.round(totalPausedSec));
  return {
    movingTime,
    totalPausedSec: pausedTime,
    elapsedDuration: movingTime + pausedTime,
  };
}
