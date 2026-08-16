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

/**
 * 判斷本次定位是否只是停止時的 GPS 漂移。這只會歸零即時速度／功率，
 * 不會把定位點寫入路線、距離、均速、爬升或卡路里統計。
 */
export function shouldZeroLiveRideReadings(sample: LiveRideReadingSample): boolean {
  const speedKmh = Number.isFinite(sample.rawSpeedKmh) ? Math.max(0, sample.rawSpeedKmh) : 0;
  const noReliableMovement = sample.displacementM !== null && sample.displacementM < sample.driftThresholdM;
  const stationarySpeedLimit = sample.pauseThresholdKmh + 1.5;
  if (noReliableMovement && sample.motionStill && speedKmh <= stationarySpeedLimit) return true;

  if (sample.motionStill && speedKmh <= sample.pauseThresholdKmh) return true;

  const indoorDrift = sample.motionStill
    && (sample.accuracyM ?? 0) >= 15
    && speedKmh <= Math.max(sample.pauseThresholdKmh + 2, 5);
  return indoorDrift;
}
