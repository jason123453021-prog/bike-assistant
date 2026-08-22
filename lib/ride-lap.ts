import type { RideLap, RideState } from "./ride-context";

export type RideLapStatisticsInput = Pick<
  RideState,
  | "elapsed"
  | "distance"
  | "totalAscent"
  | "totalDescent"
  | "powerWorkJ"
  | "powerSampleDurationSec"
  | "route"
  | "laps"
  | "lapAnchor"
>;

/**
 * 將目前累計值與上一個 Lap 錨點相減，建立可持久化的手動單圈快照。
 * 回傳 null 代表尚無可辨識的移動區段，不建立空白 Lap。
 */
export function buildManualRideLap(state: RideLapStatisticsInput): RideLap | null {
  const anchor = state.lapAnchor;
  const movingTimeSec = Math.max(0, state.elapsed - anchor.elapsedSec);
  const distanceM = Math.max(0, state.distance - anchor.distanceM);
  if (movingTimeSec < 1 || distanceM < 1) return null;

  const speeds = state.route.slice(anchor.routePointIndex).flatMap((point) => {
    const speedKmh = (point.speed ?? 0) * 3.6;
    return Number.isFinite(speedKmh) && speedKmh > 0 && speedKmh <= 120 ? [speedKmh] : [];
  });
  const powerDurationSec = Math.max(0, state.powerSampleDurationSec - anchor.powerSampleDurationSec);
  const averagePowerW = powerDurationSec > 0
    ? (state.powerWorkJ - anchor.powerWorkJ) / powerDurationSec
    : undefined;

  return {
    index: state.laps.length + 1,
    startedAtElapsedSec: anchor.elapsedSec,
    endedAtElapsedSec: state.elapsed,
    movingTimeSec,
    distanceM,
    ascentM: Math.max(0, state.totalAscent - anchor.ascentM),
    descentM: Math.max(0, state.totalDescent - anchor.descentM),
    averageSpeedKmh: (distanceM / 1_000) / (movingTimeSec / 3_600),
    maxSpeedKmh: speeds.length > 0 ? Math.max(...speeds) : undefined,
    averagePowerW: averagePowerW !== undefined && averagePowerW > 0 ? Math.round(averagePowerW) : undefined,
  };
}

/** 在成功封存一圈後，將下一圈的統計基準切換到當前總累計值。 */
export function createNextRideLapAnchor(state: RideLapStatisticsInput): RideState["lapAnchor"] {
  return {
    elapsedSec: state.elapsed,
    distanceM: state.distance,
    ascentM: state.totalAscent,
    descentM: state.totalDescent,
    powerWorkJ: state.powerWorkJ,
    powerSampleDurationSec: state.powerSampleDurationSec,
    routePointIndex: state.route.length,
  };
}
