export type SupplyIntervalTarget = "energy" | "water";
export type SupplyIntervalBasis = "time" | "distance";
export type SupplyIntervalKind = `${SupplyIntervalTarget}-${SupplyIntervalBasis}`;

export interface SupplyIntervalRule {
  timeEnabled: boolean;
  timeMinutes: number;
  distanceEnabled: boolean;
  distanceKm: number;
}

export type SupplyIntervalConfig = Record<SupplyIntervalTarget, SupplyIntervalRule>;

export type SupplyIntervalTracker = Record<SupplyIntervalKind, number>;

/**
 * 依騎乘開始後／同類別上次確認補給後的累計時間與距離，回傳本次應顯示的提醒。
 * 能量與補水各有獨立規則；同一條件在確認前只會回傳一次。
 */
export function getDueSupplyIntervals(
  config: SupplyIntervalConfig,
  tracker: SupplyIntervalTracker,
  elapsedSec: number,
  distanceKm: number,
  activeAlerts: Partial<Record<SupplyIntervalKind, boolean>>,
): SupplyIntervalKind[] {
  const due: SupplyIntervalKind[] = [];
  (Object.entries(config) as [SupplyIntervalTarget, SupplyIntervalRule][]).forEach(([target, rule]) => {
    const timeKind: SupplyIntervalKind = `${target}-time`;
    const distanceKind: SupplyIntervalKind = `${target}-distance`;
    const timeIntervalSec = rule.timeMinutes * 60;
    if (
      rule.timeEnabled &&
      Number.isFinite(timeIntervalSec) &&
      timeIntervalSec > 0 &&
      !activeAlerts[timeKind] &&
      elapsedSec - tracker[timeKind] >= timeIntervalSec
    ) {
      due.push(timeKind);
    }

    if (
      rule.distanceEnabled &&
      Number.isFinite(rule.distanceKm) &&
      rule.distanceKm > 0 &&
      !activeAlerts[distanceKind] &&
      distanceKm - tracker[distanceKind] >= rule.distanceKm
    ) {
      due.push(distanceKind);
    }
  });

  return due;
}
