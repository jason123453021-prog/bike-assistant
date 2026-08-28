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

/** 與本機軌跡品質規則對齊：30 m 內精度可作為騎乘統計資料。 */
export const MAX_RIDE_STATISTICS_ACCURACY_M = 30;
/** 0.3 m/s，保留極低速爬坡、逆風與起步的移動時間。 */
export const MIN_CYCLING_MOVEMENT_SPEED_KMH = 1.08;

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

  // 僅讓可接受精度的樣本寫入距離與移動時間；高精度低速爬坡不可因過度濾波遺失。
  if (accuracyM > MAX_RIDE_STATISTICS_ACCURACY_M) return false;
  if (speedKmh >= MIN_CYCLING_MOVEMENT_SPEED_KMH) return true;

  // 少數裝置會在剛起步、低速爬坡或衛星切換時短暫回報 0 速度。既然此樣本已通過
  // 30 m 精度閘門，只要存在至少 3 m 的連續位移即可作為低速回退；不再要求位移大於
  // GPS 的整個誤差半徑，避免 15–30 m 精度下的真實慢速移動被誤判成暫停。
  return distanceM >= Math.max(1.5, Math.min(3, accuracyM));
}

/**
 * 判斷本次定位是否只是停止時的 GPS 漂移。這只會歸零即時速度／功率，
 * 不會把定位點寫入路線、距離、均速、爬升或卡路里統計。
 */
export function shouldZeroLiveRideReadings(sample: LiveRideReadingSample): boolean {
  const speedKmh = Number.isFinite(sample.rawSpeedKmh) ? Math.max(0, sample.rawSpeedKmh) : 0;
  const noReliableMovement = sample.displacementM !== null && sample.displacementM < sample.driftThresholdM;
  const hasReliableMovement = hasReliableRideMovement({
    speedKmh,
    distanceM: sample.displacementM,
    accuracyM: sample.accuracyM,
  });
  if (noReliableMovement && sample.motionStill && speedKmh < sample.pauseThresholdKmh) return true;

  // 手機固定在車把上時，加速度計本來就可能接近靜止；不得僅因 GPS 瞬間回報 0 km/h
  // 就中斷仍在移動的活動。第一個定位樣本沒有前點時才以低速作為保守回退。
  if (sample.motionStill && sample.displacementM === null && speedKmh <= sample.pauseThresholdKmh) return true;

  const indoorDrift = sample.motionStill
    && (sample.accuracyM ?? 0) >= 15
    && speedKmh <= Math.max(sample.pauseThresholdKmh + 2, 5);
  return indoorDrift;
}
