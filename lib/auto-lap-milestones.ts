import type { RideLap } from "./ride-context";

export interface AutoLapAnchor {
  elapsedSec: number;
  distanceM: number;
  ascentM: number;
  descentM: number;
  powerWorkJ: number;
  powerSampleDurationSec: number;
}

export interface AutoLapTotals {
  elapsedSec: number;
  distanceM: number;
  ascentM: number;
  descentM: number;
  powerWorkJ: number;
  powerSampleDurationSec: number;
}

export interface AutoLapMilestoneState {
  enabled: boolean;
  intervalM: number;
  nextDistanceM: number | null;
  laps: RideLap[];
  anchor: AutoLapAnchor;
  /** 上一筆已接受樣本的累計統計，用於固定里程邊界的線性插值。 */
  previousTotals?: AutoLapTotals;
}

export interface AutoLapMilestoneResult {
  laps: RideLap[];
  anchor: AutoLapAnchor;
  nextDistanceM: number | null;
  completedLaps: RideLap[];
  previousTotals: AutoLapTotals;
}

export function createAutoLapAnchor(totals: AutoLapTotals): AutoLapAnchor {
  return {
    elapsedSec: Math.max(0, totals.elapsedSec),
    distanceM: Math.max(0, totals.distanceM),
    ascentM: Math.max(0, totals.ascentM),
    descentM: Math.max(0, totals.descentM),
    powerWorkJ: Math.max(0, totals.powerWorkJ),
    powerSampleDurationSec: Math.max(0, totals.powerSampleDurationSec),
  };
}

function toTotals(totals: AutoLapTotals): AutoLapTotals {
  return createAutoLapAnchor(totals);
}

function interpolateTotalsAtDistance(
  previous: AutoLapTotals,
  current: AutoLapTotals,
  boundaryDistanceM: number,
): AutoLapTotals {
  const previousDistanceM = Math.max(0, previous.distanceM);
  const currentDistanceM = Math.max(previousDistanceM, current.distanceM);
  const progress = currentDistanceM > previousDistanceM
    ? Math.min(1, Math.max(0, (boundaryDistanceM - previousDistanceM) / (currentDistanceM - previousDistanceM)))
    : 1;
  const interpolate = (from: number, to: number) => Math.max(0, from + (to - from) * progress);

  return {
    elapsedSec: interpolate(previous.elapsedSec, current.elapsedSec),
    distanceM: Math.max(previousDistanceM, Math.min(currentDistanceM, boundaryDistanceM)),
    ascentM: interpolate(previous.ascentM, current.ascentM),
    descentM: interpolate(previous.descentM, current.descentM),
    powerWorkJ: interpolate(previous.powerWorkJ, current.powerWorkJ),
    powerSampleDurationSec: interpolate(previous.powerSampleDurationSec, current.powerSampleDurationSec),
  };
}

function buildAutoLap(endTotals: AutoLapTotals, anchor: AutoLapAnchor, index: number): RideLap | null {
  const movingTimeSec = Math.max(0, endTotals.elapsedSec - anchor.elapsedSec);
  const distanceM = Math.max(0, endTotals.distanceM - anchor.distanceM);
  if (movingTimeSec < 1 || distanceM < 1) return null;

  const powerDurationSec = Math.max(0, endTotals.powerSampleDurationSec - anchor.powerSampleDurationSec);
  const averagePowerW = powerDurationSec > 0
    ? Math.max(0, (endTotals.powerWorkJ - anchor.powerWorkJ) / powerDurationSec)
    : undefined;

  return {
    index,
    source: "auto",
    startedAtElapsedSec: anchor.elapsedSec,
    endedAtElapsedSec: endTotals.elapsedSec,
    movingTimeSec,
    distanceM,
    ascentM: Math.max(0, endTotals.ascentM - anchor.ascentM),
    descentM: Math.max(0, endTotals.descentM - anchor.descentM),
    averageSpeedKmh: (distanceM / 1_000) / (movingTimeSec / 3_600),
    averagePowerW: averagePowerW && averagePowerW > 0 ? Math.round(averagePowerW) : undefined,
  };
}

/**
 * 以全程固定里程（1／5／10 km）封存自動分段。GPS 樣本通常不會剛好落在里程線上，
 * 因此依上一筆已接受樣本和本筆累計統計插值；每一圈都精確落在固定距離，而非把
 * overshoot 併入同一圈。單一背景批次跨越多個里程碑時也會逐一補齊。
 */
export function advanceAutoLapMilestones(
  totals: AutoLapTotals,
  state: AutoLapMilestoneState,
): AutoLapMilestoneResult {
  const normalizedTotals = toTotals(totals);
  const intervalM = Math.max(0, state.intervalM);
  const fallbackPrevious = state.previousTotals
    ? toTotals(state.previousTotals)
    : createAutoLapAnchor(state.anchor);

  if (!state.enabled || intervalM <= 0) {
    return {
      laps: state.laps,
      anchor: state.anchor,
      nextDistanceM: null,
      completedLaps: [],
      previousTotals: normalizedTotals,
    };
  }

  const laps = [...state.laps];
  const completedLaps: RideLap[] = [];
  let anchor = state.anchor;
  let nextDistanceM = state.nextDistanceM
    ?? (Math.floor(Math.max(0, fallbackPrevious.distanceM) / intervalM) + 1) * intervalM;

  // 若設定是在騎乘途中剛開啟，不能把既有里程誤記成新的一圈。
  if (normalizedTotals.distanceM < fallbackPrevious.distanceM) {
    return { laps, anchor, nextDistanceM, completedLaps, previousTotals: normalizedTotals };
  }

  while (normalizedTotals.distanceM >= nextDistanceM) {
    const boundaryTotals = interpolateTotalsAtDistance(fallbackPrevious, normalizedTotals, nextDistanceM);
    const lap = buildAutoLap(boundaryTotals, anchor, laps.length + 1);
    if (lap) {
      laps.push(lap);
      completedLaps.push(lap);
    }
    anchor = createAutoLapAnchor(boundaryTotals);
    nextDistanceM += intervalM;
  }

  return {
    laps,
    anchor,
    nextDistanceM,
    completedLaps,
    previousTotals: normalizedTotals,
  };
}
