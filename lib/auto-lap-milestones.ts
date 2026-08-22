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
}

export interface AutoLapMilestoneResult {
  laps: RideLap[];
  anchor: AutoLapAnchor;
  nextDistanceM: number | null;
  completedLaps: RideLap[];
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

function buildAutoLap(totals: AutoLapTotals, anchor: AutoLapAnchor, index: number): RideLap | null {
  const movingTimeSec = Math.max(0, totals.elapsedSec - anchor.elapsedSec);
  const distanceM = Math.max(0, totals.distanceM - anchor.distanceM);
  if (movingTimeSec < 1 || distanceM < 1) return null;

  const powerDurationSec = Math.max(0, totals.powerSampleDurationSec - anchor.powerSampleDurationSec);
  const averagePowerW = powerDurationSec > 0
    ? Math.max(0, (totals.powerWorkJ - anchor.powerWorkJ) / powerDurationSec)
    : undefined;

  return {
    index,
    source: "auto",
    startedAtElapsedSec: anchor.elapsedSec,
    endedAtElapsedSec: totals.elapsedSec,
    movingTimeSec,
    distanceM,
    ascentM: Math.max(0, totals.ascentM - anchor.ascentM),
    descentM: Math.max(0, totals.descentM - anchor.descentM),
    averageSpeedKmh: (distanceM / 1_000) / (movingTimeSec / 3_600),
    averagePowerW: averagePowerW && averagePowerW > 0 ? Math.round(averagePowerW) : undefined,
  };
}

/**
 * 依全程固定里程碑封存自動分段。呼叫端必須依時間順序逐筆餵入 GPS 樣本，
 * 讓每圈的結算值都使用該次跨越里程碑時的真實累計資料。
 */
export function advanceAutoLapMilestones(
  totals: AutoLapTotals,
  state: AutoLapMilestoneState,
): AutoLapMilestoneResult {
  const intervalM = Math.max(0, state.intervalM);
  if (!state.enabled || intervalM <= 0) {
    return {
      laps: state.laps,
      anchor: state.anchor,
      nextDistanceM: null,
      completedLaps: [],
    };
  }

  let nextDistanceM = state.nextDistanceM
    ?? (Math.floor(Math.max(0, totals.distanceM) / intervalM) + 1) * intervalM;
  let anchor = state.anchor;
  const laps = [...state.laps];
  const completedLaps: RideLap[] = [];

  if (totals.distanceM >= nextDistanceM) {
    const lap = buildAutoLap(totals, anchor, laps.length + 1);
    if (lap) {
      laps.push(lap);
      completedLaps.push(lap);
      anchor = createAutoLapAnchor(totals);
      nextDistanceM += intervalM;
    }
  }

  return { laps, anchor, nextDistanceM, completedLaps };
}
