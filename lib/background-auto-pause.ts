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

/** 將定位供應商可能回傳的 null、undefined、NaN 或負速度安全視為靜止。 */
export function normalizeAutoPauseSpeedKmh(speedKmh: unknown): number {
  const value = Number(speedKmh);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** 恢復採用高於暫停門檻 0.5 km/h 的遲滯，避免短暫 GPS 飄移來回切換。 */
export function resolveAutoPauseResumeThresholdKmh(pauseBelowKmh: unknown, fallbackKmh: number): number {
  const pauseThreshold = normalizeAutoPauseSpeedKmh(pauseBelowKmh);
  return Math.max(fallbackKmh, pauseThreshold + 0.5);
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
  const speedKmh = normalizeAutoPauseSpeedKmh(input.speedKmh);
  const pauseBelowKmh = normalizeAutoPauseSpeedKmh(input.pauseBelowKmh);
  const resumeAtOrAboveKmh = normalizeAutoPauseSpeedKmh(input.resumeAtOrAboveKmh);

  if (!input.enabled) {
    return { paused: false, accumulatedLowSpeedSec: 0, movingTimeIncrementSec: intervalSec };
  }

  if (input.paused) {
    if (input.hasReliableMovement && speedKmh >= resumeAtOrAboveKmh) {
      return { paused: false, accumulatedLowSpeedSec: 0, movingTimeIncrementSec: intervalSec };
    }
    return { paused: true, accumulatedLowSpeedSec: lowSpeedSec, movingTimeIncrementSec: 0 };
  }

  const isLowAndUnreliable = !input.hasReliableMovement && speedKmh < pauseBelowKmh;
  if (!isLowAndUnreliable) {
    // 速度落在暫停門檻與恢復門檻之間時保留已累積的防抖秒數；這段遲滯區可吸收
    // 單次 GPS 飄移（例如 1.5 km/h），只有真正跨過恢復門檻才取消靜止倒數。
    const crossedResumeThreshold = speedKmh >= resumeAtOrAboveKmh;
    return {
      paused: false,
      accumulatedLowSpeedSec: crossedResumeThreshold ? 0 : lowSpeedSec,
      movingTimeIncrementSec: intervalSec,
    };
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
