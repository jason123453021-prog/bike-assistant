export type SupplyIntervalKind = "time" | "distance";

export interface SupplyIntervalConfig {
  enabled: boolean;
  timeEnabled: boolean;
  timeMinutes: number;
  distanceEnabled: boolean;
  distanceKm: number;
}

export interface SupplyIntervalTracker {
  lastTimeSec: number;
  lastDistanceKm: number;
}

/**
 * 依騎乘開始後／上次確認補給後的累計時間與距離，回傳本次應顯示的提醒。
 * 可同時啟用時間與距離條件；同一條件在確認補給前只會回傳一次。
 */
export function getDueSupplyIntervals(
  config: SupplyIntervalConfig,
  tracker: SupplyIntervalTracker,
  elapsedSec: number,
  distanceKm: number,
  activeAlerts: Partial<Record<SupplyIntervalKind, boolean>>,
): SupplyIntervalKind[] {
  if (!config.enabled) return [];

  const due: SupplyIntervalKind[] = [];
  const timeIntervalSec = config.timeMinutes * 60;
  if (
    config.timeEnabled &&
    Number.isFinite(timeIntervalSec) &&
    timeIntervalSec > 0 &&
    !activeAlerts.time &&
    elapsedSec - tracker.lastTimeSec >= timeIntervalSec
  ) {
    due.push("time");
  }

  if (
    config.distanceEnabled &&
    Number.isFinite(config.distanceKm) &&
    config.distanceKm > 0 &&
    !activeAlerts.distance &&
    distanceKm - tracker.lastDistanceKm >= config.distanceKm
  ) {
    due.push("distance");
  }

  return due;
}
