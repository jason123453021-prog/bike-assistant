/**
 * 背景 TaskManager 與前景 UI 都會更新同一份 AsyncStorage 騎乘快照。
 * 當使用者已在前景確認補給時，較早開始處理的背景批次不得以舊的
 * `reminderSent: true` 與舊倒數寫回覆蓋確認結果。
 */
export interface BackgroundSupplyStateGuard {
  supplyReminderMutationVersion?: number;
  calorieReminderSent: boolean;
  waterReminderSent: boolean;
  smartCalorieCountdownStartedElapsedSec?: number;
  smartWaterCountdownStartedElapsedSec?: number;
  smartCalorieCountdownDurationSec?: number;
  smartWaterCountdownDurationSec?: number;
  smartCalorieCountdownDueAtMs?: number;
  smartWaterCountdownDueAtMs?: number;
  smartCalorieCountdownPausedAtMs?: number;
  smartWaterCountdownPausedAtMs?: number;
  smartCalorieCountdownPausedTotalMs?: number;
  smartWaterCountdownPausedTotalMs?: number;
  supplyCountdownPausedAtMs?: number;
  supplyCountdownPausedTotalMs?: number;
  calories: number;
  sweatLossMl: number;
  intervalLastEnergyTimeSec: number;
  intervalLastEnergyDistanceKm: number;
  intervalLastWaterTimeSec: number;
  intervalLastWaterDistanceKm: number;
  intervalEnergyTimeReminderSent: boolean;
  intervalEnergyDistanceReminderSent: boolean;
  intervalWaterTimeReminderSent: boolean;
  intervalWaterDistanceReminderSent: boolean;
}

export function getSupplyReminderMutationVersion(state: Pick<BackgroundSupplyStateGuard, "supplyReminderMutationVersion">): number {
  const value = Number(state.supplyReminderMutationVersion);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * 若背景批次開始後前景已完成補給，將前景最新的補給相關欄位合併回批次快照。
 * 軌跡、距離與其他騎乘統計仍保留背景批次的最新結果。
 */
export function preserveLatestSupplyReminderMutation<T extends BackgroundSupplyStateGuard>(
  backgroundBatchState: T,
  latestPersistedState: T,
  backgroundBatchStartedAtVersion: number,
): T {
  if (getSupplyReminderMutationVersion(latestPersistedState) <= backgroundBatchStartedAtVersion) {
    return backgroundBatchState;
  }

  return {
    ...backgroundBatchState,
    supplyReminderMutationVersion: getSupplyReminderMutationVersion(latestPersistedState),
    calorieReminderSent: latestPersistedState.calorieReminderSent,
    waterReminderSent: latestPersistedState.waterReminderSent,
    smartCalorieCountdownStartedElapsedSec: latestPersistedState.smartCalorieCountdownStartedElapsedSec,
    smartWaterCountdownStartedElapsedSec: latestPersistedState.smartWaterCountdownStartedElapsedSec,
    smartCalorieCountdownDurationSec: latestPersistedState.smartCalorieCountdownDurationSec,
    smartWaterCountdownDurationSec: latestPersistedState.smartWaterCountdownDurationSec,
    smartCalorieCountdownDueAtMs: latestPersistedState.smartCalorieCountdownDueAtMs,
    smartWaterCountdownDueAtMs: latestPersistedState.smartWaterCountdownDueAtMs,
    smartCalorieCountdownPausedAtMs: latestPersistedState.smartCalorieCountdownPausedAtMs,
    smartWaterCountdownPausedAtMs: latestPersistedState.smartWaterCountdownPausedAtMs,
    smartCalorieCountdownPausedTotalMs: latestPersistedState.smartCalorieCountdownPausedTotalMs,
    smartWaterCountdownPausedTotalMs: latestPersistedState.smartWaterCountdownPausedTotalMs,
    supplyCountdownPausedAtMs: latestPersistedState.supplyCountdownPausedAtMs,
    supplyCountdownPausedTotalMs: latestPersistedState.supplyCountdownPausedTotalMs,
    calories: latestPersistedState.calories,
    sweatLossMl: latestPersistedState.sweatLossMl,
    intervalLastEnergyTimeSec: latestPersistedState.intervalLastEnergyTimeSec,
    intervalLastEnergyDistanceKm: latestPersistedState.intervalLastEnergyDistanceKm,
    intervalLastWaterTimeSec: latestPersistedState.intervalLastWaterTimeSec,
    intervalLastWaterDistanceKm: latestPersistedState.intervalLastWaterDistanceKm,
    intervalEnergyTimeReminderSent: latestPersistedState.intervalEnergyTimeReminderSent,
    intervalEnergyDistanceReminderSent: latestPersistedState.intervalEnergyDistanceReminderSent,
    intervalWaterTimeReminderSent: latestPersistedState.intervalWaterTimeReminderSent,
    intervalWaterDistanceReminderSent: latestPersistedState.intervalWaterDistanceReminderSent,
  };
}
