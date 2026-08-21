/**
 * 即時 GPS 海拔累積保護。
 * 手機 GPS 的垂直誤差通常遠大於水平方向；只有跨過保守死區的連續高度變化才計入爬升。
 */
export interface LiveElevationFilterState {
  anchorAltitudeM: number | null;
  /** 舊版恢復快照沒有此欄位時，第一次樣本會安全建立。 */
  recentAltitudesM?: number[];
}

export interface LiveElevationChange {
  ascentM: number;
  descentM: number;
  acceptedAltitudeM?: number;
}

/** 3–5 個樣本移動平均，抑制 GPS 垂直雜訊而保留連續坡度。 */
export const LIVE_ELEVATION_SMOOTHING_WINDOW = 5;
/** 平滑後跨越 3 m 才確認為有效爬升／下降。 */
export const LIVE_ELEVATION_DEADBAND_M = 3;
export const LIVE_ELEVATION_MIN_DISTANCE_M = 3;

export function createLiveElevationFilterState(): LiveElevationFilterState {
  return { anchorAltitudeM: null, recentAltitudesM: [] };
}

export function acceptLiveElevationDelta(
  state: LiveElevationFilterState,
  altitudeM: number | null | undefined,
  distanceM: number,
): LiveElevationChange {
  if (!Number.isFinite(altitudeM)) return { ascentM: 0, descentM: 0 };
  const altitude = Number(altitudeM);
  const recentAltitudesM = state.recentAltitudesM ?? (state.recentAltitudesM = []);
  recentAltitudesM.push(altitude);
  if (recentAltitudesM.length > LIVE_ELEVATION_SMOOTHING_WINDOW) recentAltitudesM.shift();
  const smoothedAltitude = recentAltitudesM.reduce((total, value) => total + value, 0) / recentAltitudesM.length;
  if (state.anchorAltitudeM === null) {
    state.anchorAltitudeM = smoothedAltitude;
    return { ascentM: 0, descentM: 0, acceptedAltitudeM: smoothedAltitude };
  }
  if (distanceM < LIVE_ELEVATION_MIN_DISTANCE_M) return { ascentM: 0, descentM: 0 };

  const delta = smoothedAltitude - state.anchorAltitudeM;
  if (Math.abs(delta) < LIVE_ELEVATION_DEADBAND_M) return { ascentM: 0, descentM: 0 };

  // 越過死區後才將新高度確認為可信平台；爬升、下降與最高／最低海拔共用此資料流。
  state.anchorAltitudeM = smoothedAltitude;
  return {
    ascentM: delta > 0 ? delta : 0,
    descentM: delta < 0 ? Math.abs(delta) : 0,
    acceptedAltitudeM: smoothedAltitude,
  };
}

/** 舊呼叫端相容介面；新統計程式應使用 acceptLiveElevationDelta 同時處理爬升與下降。 */
export function acceptLiveElevationChange(
  state: LiveElevationFilterState,
  altitudeM: number | null | undefined,
  distanceM: number,
): number {
  return acceptLiveElevationDelta(state, altitudeM, distanceM).ascentM;
}

/** 虛擬功率並非量測值；以 FTP 為主的保守上限避免 GPS／坡度尖峰污染最大功率。 */
export function clampVirtualPowerForRider(powerW: number, ftpW: number): number {
  const ceiling = Math.min(650, Math.max(250, Math.round(Math.max(1, ftpW) * 2.5)));
  return Math.max(0, Math.min(ceiling, Math.round(Number.isFinite(powerW) ? powerW : 0)));
}
