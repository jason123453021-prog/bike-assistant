/**
 * 即時 GPS 海拔累積保護。
 * 手機 GPS 的垂直誤差通常遠大於水平方向；只有跨過保守死區的連續高度變化才計入爬升。
 */
export interface LiveElevationFilterState {
  anchorAltitudeM: number | null;
}

export const LIVE_ELEVATION_DEADBAND_M = 10;
export const LIVE_ELEVATION_MIN_DISTANCE_M = 12;

export function createLiveElevationFilterState(): LiveElevationFilterState {
  return { anchorAltitudeM: null };
}

export function acceptLiveElevationChange(
  state: LiveElevationFilterState,
  altitudeM: number | null | undefined,
  distanceM: number,
): number {
  if (!Number.isFinite(altitudeM)) return 0;
  const altitude = Number(altitudeM);
  if (state.anchorAltitudeM === null) {
    state.anchorAltitudeM = altitude;
    return 0;
  }
  if (distanceM < LIVE_ELEVATION_MIN_DISTANCE_M) return 0;

  const delta = altitude - state.anchorAltitudeM;
  if (Math.abs(delta) < LIVE_ELEVATION_DEADBAND_M) return 0;

  // 越過死區後只計算同一段可確認的正向高度，並將基準移至新平台。
  state.anchorAltitudeM = altitude;
  return delta > 0 ? delta : 0;
}

/** 虛擬功率並非量測值；以 FTP 為主的保守上限避免 GPS／坡度尖峰污染最大功率。 */
export function clampVirtualPowerForRider(powerW: number, ftpW: number): number {
  const ceiling = Math.min(650, Math.max(250, Math.round(Math.max(1, ftpW) * 2.5)));
  return Math.max(0, Math.min(ceiling, Math.round(Number.isFinite(powerW) ? powerW : 0)));
}
