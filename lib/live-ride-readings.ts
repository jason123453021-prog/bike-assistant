/** 騎乘進行中，對停止與室內 GPS 漂移使用的保守即時讀數保護。 */
export const DEFAULT_TOUCH_GUARD_UNLOCK_HOLD_MS = 400;
export const TOUCH_GUARD_UNLOCK_HOLD_PRESETS = [400, 800, 1200] as const;
export const TOUCH_GUARD_AUTO_RELOCK_MS = 3_000;

export function shouldScheduleTouchGuardRelock(
  touchGuardPreferenceEnabled: boolean,
  rideIsActive: boolean,
): boolean {
  return touchGuardPreferenceEnabled && rideIsActive;
}

export interface LiveRideReadingSample {
  rawSpeedKmh: number;
  displacementM: number | null;
  accuracyM: number | null | undefined;
  motionStill: boolean;
  pauseThresholdKmh: number;
  driftThresholdM: number;
}

export interface RideMovementSample {
  speedKmh: number;
  distanceM: number | null | undefined;
  accuracyM: number | null | undefined;
}

/**
 * 前景與背景共用的保守移動門檻。
 *
 * GPS 報出的瞬間速度可能為 0，且靜止時的位置誤差會在數公尺內來回。只有速度已超過
 * 自行車重新起步門檻，或位移明顯大於目前精度可能造成的漂移，才視為可累積的移動。
 */
export function hasReliableRideMovement(sample: RideMovementSample): boolean {
  const speedKmh = Number.isFinite(sample.speedKmh) ? Math.max(0, sample.speedKmh) : 0;
  const distanceM = Number.isFinite(sample.distanceM) ? Math.max(0, Number(sample.distanceM)) : 0;
  const accuracyM = Number.isFinite(sample.accuracyM) ? Math.max(0, Number(sample.accuracyM)) : 0;

  // 精度很差時，低速與小位移通常只是室內或停車時的定位漂移。
  if (accuracyM >= 15 && speedKmh < 6 && distanceM < accuracyM) return false;
  if (speedKmh >= 3) return true;

  // 長坡、逆風或載重時仍可能低於 3 km/h。只有精度良好、已有至少 3 m 實際位移
  // 且 GPS 速度超過步行速度時，才保留此類慢速單車樣本；避免停車漂移混入距離。
  if (accuracyM <= 10 && speedKmh >= 1.8 && distanceM >= 3) return true;

  // 對一般手機 GPS，至少需跨越 8 m，且位移必須高於回報精度的 75%。
  const displacementThresholdM = Math.max(8, Math.min(18, accuracyM * 0.75));
  return distanceM >= displacementThresholdM;
}

/**
 * 判斷本次定位是否只是停止時的 GPS 漂移。這只會歸零即時速度／功率，
 * 不會把定位點寫入路線、距離、均速、爬升或卡路里統計。
 */
export function shouldZeroLiveRideReadings(sample: LiveRideReadingSample): boolean {
  const speedKmh = Number.isFinite(sample.rawSpeedKmh) ? Math.max(0, sample.rawSpeedKmh) : 0;
  const noReliableMovement = sample.displacementM !== null && sample.displacementM < sample.driftThresholdM;
  const stationarySpeedLimit = sample.pauseThresholdKmh + 1.5;
  if (noReliableMovement && sample.motionStill && speedKmh <= stationarySpeedLimit) return true;

  // 手機固定在車把上時，加速度計本來就可能接近靜止；不得僅因 GPS 瞬間回報 0 km/h
  // 就中斷仍在移動的活動。第一個定位樣本沒有前點時才以低速作為保守回退。
  if (sample.motionStill && sample.displacementM === null && speedKmh <= sample.pauseThresholdKmh) return true;

  const indoorDrift = sample.motionStill
    && (sample.accuracyM ?? 0) >= 15
    && speedKmh <= Math.max(sample.pauseThresholdKmh + 2, 5);
  return indoorDrift && !hasReliableRideMovement({
    speedKmh,
    distanceM: sample.displacementM,
    accuracyM: sample.accuracyM,
  });
}
