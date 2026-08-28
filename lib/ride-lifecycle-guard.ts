/**
 * 騎乘生命週期的唯一權限來源。
 * 導航、GPX、地圖、AppState 與感測器資料不得繞過此處改變活動累計。
 */
export type RideLifecycleStatus = "idle" | "active" | "paused" | "finished";

export function canStartRide(status: RideLifecycleStatus): boolean {
  return status === "idle" || status === "finished";
}

export function canStopRide(status: RideLifecycleStatus): boolean {
  return status === "active" || status === "paused";
}

export function canPauseRide(status: RideLifecycleStatus): boolean {
  return status === "active";
}

export function canResumeRide(status: RideLifecycleStatus): boolean {
  return status === "paused";
}

export function canResetCompletedRide(status: RideLifecycleStatus): boolean {
  return status === "finished";
}

export function shouldAccumulateRideStatistics(status: RideLifecycleStatus): boolean {
  return status === "active";
}
