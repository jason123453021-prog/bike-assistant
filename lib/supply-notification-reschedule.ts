import type { BackgroundState } from "./background-location";
import type { SupplyNotificationKind } from "./supply-notification-action-model";

export interface SupplyNotificationRefreshPlan {
  scheduled: Array<{ kind: "calorie" | "water"; dueAtMs: number }>;
  immediate: SupplyNotificationKind[];
}

/**
 * 將持久化的騎乘狀態轉為語言切換後要重建的通知清單；只讀取狀態，絕不重設倒數或確認旗標。
 */
export function buildSupplyNotificationRefreshPlan(state: BackgroundState | null, nowMs = Date.now()): SupplyNotificationRefreshPlan {
  if (!state?.isRiding || state.supplyReminderEnabled === false) return { scheduled: [], immediate: [] };
  const scheduled: SupplyNotificationRefreshPlan["scheduled"] = [];
  const immediate: SupplyNotificationKind[] = [];
  const energySmart = state.supplyCalculationMode === "smart" && state.smartEnergySupplyEnabled === true;
  const waterSmart = state.supplyCalculationMode === "smart" && state.smartWaterSupplyEnabled === true;

  if (energySmart) {
    if (state.calorieReminderSent) immediate.push("calorie");
    else if ((state.smartCalorieCountdownDueAtMs ?? 0) > nowMs) scheduled.push({ kind: "calorie", dueAtMs: state.smartCalorieCountdownDueAtMs! });
  }
  if (waterSmart) {
    if (state.waterReminderSent) immediate.push("water");
    else if ((state.smartWaterCountdownDueAtMs ?? 0) > nowMs) scheduled.push({ kind: "water", dueAtMs: state.smartWaterCountdownDueAtMs! });
  }

  if (state.intervalEnergyTimeReminderSent) immediate.push("interval-energy-time");
  if (state.intervalEnergyDistanceReminderSent) immediate.push("interval-energy-distance");
  if (state.intervalWaterTimeReminderSent) immediate.push("interval-water-time");
  if (state.intervalWaterDistanceReminderSent) immediate.push("interval-water-distance");
  return { scheduled, immediate };
}
