import type { RideState } from "./ride-context";

/**
 * 結束騎乘時封存摘要所需資料。摘要 Modal 不得直接依賴可能已重設的即時騎乘狀態。
 */
export type RideSummarySnapshot = Pick<
  RideState,
  | "distance"
  | "elapsed"
  | "totalPausedSec"
  | "totalAscent"
  | "totalDescent"
  | "minElevation"
  | "maxElevation"
  | "maxSpeed"
  | "maxPower"
  | "powerWorkJ"
  | "powerSampleDurationSec"
  | "totalCalories"
  | "powerSource"
  | "caloriesSource"
  | "powerZones"
>;

export function createRideSummarySnapshot(state: RideSummarySnapshot): RideSummarySnapshot {
  return {
    ...state,
    powerZones: [...state.powerZones],
  };
}
