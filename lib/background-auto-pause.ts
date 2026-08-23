export interface BackgroundAutoPauseInput {
  paused: boolean;
  accumulatedLowSpeedSec: number;
  hasReliableMovement: boolean;
  speedKmh: number;
  intervalSec: number;
  enabled: boolean;
  pauseBelowKmh: number;
  pauseAfterSec: number;
  resumeAtOrAboveKmh: number;
}

export interface BackgroundAutoPauseResult {
  paused: boolean;
  accumulatedLowSpeedSec: number;
  /** 本 GPS 區間可安全視為移動中的秒數，跨過防抖門檻時只保留門檻前的時間。 */
  movingTimeIncrementSec: number;
  /** 在本樣本內進入暫停時，從樣本結尾回推的秒數；未暫停時為 undefined。 */
  pauseStartedBeforeSampleEndSec?: number;
}

/**
 * Background Task 沒有前景的每秒計時器與裝置動作感測資料，因此把每批 GPS 的有效
 * 間隔拆成「仍在防抖」與「已自動暫停」兩段，確保鎖屏與前景同樣保留低速停車前的
 * 緩衝時間，又不把實際靜止的牆鐘時間誤算進移動時間。
 */
export function advanceBackgroundAutoPause(input: BackgroundAutoPauseInput): BackgroundAutoPauseResult {
  const intervalSec = Math.max(0, Number.isFinite(input.intervalSec) ? input.intervalSec : 0);
  const lowSpeedSec = Math.max(0, Number.isFinite(input.accumulatedLowSpeedSec) ? input.accumulatedLowSpeedSec : 0);
  const pauseAfterSec = Math.max(0, Number.isFinite(input.pauseAfterSec) ? input.pauseAfterSec : 0);
  const speedKmh = Math.max(0, Number.isFinite(input.speedKmh) ? input.speedKmh : 0);

  if (!input.enabled) {
    return { paused: false, accumulatedLowSpeedSec: 0, movingTimeIncrementSec: intervalSec };
  }

  if (input.paused) {
    if (input.hasReliableMovement && speedKmh >= input.resumeAtOrAboveKmh) {
      return { paused: false, accumulatedLowSpeedSec: 0, movingTimeIncrementSec: intervalSec };
    }
    return { paused: true, accumulatedLowSpeedSec: lowSpeedSec, movingTimeIncrementSec: 0 };
  }

  const isLowAndUnreliable = !input.hasReliableMovement && speedKmh < input.pauseBelowKmh;
  if (!isLowAndUnreliable) {
    return { paused: false, accumulatedLowSpeedSec: 0, movingTimeIncrementSec: intervalSec };
  }

  const nextLowSpeedSec = lowSpeedSec + intervalSec;
  if (nextLowSpeedSec < pauseAfterSec) {
    return {
      paused: false,
      accumulatedLowSpeedSec: nextLowSpeedSec,
      movingTimeIncrementSec: intervalSec,
    };
  }

  const movingTimeIncrementSec = Math.max(0, pauseAfterSec - lowSpeedSec);
  return {
    paused: true,
    accumulatedLowSpeedSec: pauseAfterSec,
    movingTimeIncrementSec,
    pauseStartedBeforeSampleEndSec: Math.max(0, intervalSec - movingTimeIncrementSec),
  };
}
