/**
 * 本機活動統計的單一計算核心。
 *
 * 所有活動欄位都使用明確 SI 單位：距離為公尺、時間為秒、功率為瓦、
 * 機械工作量為焦耳、海拔為公尺、能量為 kcal。UI 僅負責格式化，不再自行推導。
 */

export type ActivityPowerSource = "estimated" | "measured" | "unavailable";
export type ActivityCaloriesSource = "power-estimate" | "met-estimate" | "mixed-estimate" | "unavailable";

export interface ActivityStatisticsInput {
  distanceM: number;
  movingTimeSec: number;
  pausedTimeSec: number;
  totalAscentM: number;
  totalDescentM: number;
  minElevationM?: number;
  maxElevationM?: number;
  maxSpeedKmh: number;
  maxPowerW: number;
  powerWorkJ: number;
  powerSampleDurationSec: number;
  caloriesKcal: number;
  powerSource: ActivityPowerSource;
  caloriesSource: ActivityCaloriesSource;
}

export interface ActivityStatisticsSnapshot {
  distanceM: number;
  movingTimeSec: number;
  pausedTimeSec: number;
  elapsedTimeSec: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  totalAscentM: number;
  totalDescentM: number;
  minElevationM?: number;
  maxElevationM?: number;
  averageGradePct?: number;
  maxPowerW: number;
  averagePowerW?: number;
  totalWorkKj?: number;
  caloriesKcal: number;
  powerSource: ActivityPowerSource;
  caloriesSource: ActivityCaloriesSource;
}

function nonNegative(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

function optionalFinite(value: number | undefined): number | undefined {
  return Number.isFinite(value) ? Number(value) : undefined;
}

/**
 * 將累積的原始資料轉為活動頁、儲存紀錄與匯出可共用的統計快照。
 * 平均速度固定以移動時間計算；平均功率固定以時間加權的有效功率樣本計算，
 * 包含有效移動期間的零功率滑行樣本。
 */
export function buildActivityStatistics(input: ActivityStatisticsInput): ActivityStatisticsSnapshot {
  const distanceM = nonNegative(input.distanceM);
  const movingTimeSec = nonNegative(input.movingTimeSec);
  const pausedTimeSec = nonNegative(input.pausedTimeSec);
  const totalAscentM = nonNegative(input.totalAscentM);
  const totalDescentM = nonNegative(input.totalDescentM);
  const powerSampleDurationSec = nonNegative(input.powerSampleDurationSec);
  const powerWorkJ = nonNegative(input.powerWorkJ);
  const averagePowerW = powerSampleDurationSec > 0 ? powerWorkJ / powerSampleDurationSec : undefined;
  const averageGradePct = distanceM > 0 ? (totalAscentM / distanceM) * 100 : undefined;

  return {
    distanceM,
    movingTimeSec,
    pausedTimeSec,
    elapsedTimeSec: movingTimeSec + pausedTimeSec,
    averageSpeedKmh: movingTimeSec > 0 ? (distanceM / 1000) / (movingTimeSec / 3600) : 0,
    maxSpeedKmh: nonNegative(input.maxSpeedKmh),
    totalAscentM,
    totalDescentM,
    minElevationM: optionalFinite(input.minElevationM),
    maxElevationM: optionalFinite(input.maxElevationM),
    averageGradePct,
    maxPowerW: nonNegative(input.maxPowerW),
    averagePowerW,
    totalWorkKj: averagePowerW === undefined ? undefined : powerWorkJ / 1000,
    caloriesKcal: nonNegative(input.caloriesKcal),
    powerSource: input.powerSource,
    caloriesSource: input.caloriesSource,
  };
}

/** 以定位點時間戳估算本次有效樣本的積分秒數，防止背景中斷被錯當成長時間持續輸出。 */
export function resolveStatisticsIntervalSec(previousTimestampMs: number | null, currentTimestampMs: number, maximumSec = 30): number {
  if (!Number.isFinite(previousTimestampMs) || !Number.isFinite(currentTimestampMs)) return 0;
  const seconds = (currentTimestampMs - Number(previousTimestampMs)) / 1000;
  return seconds > 0 && seconds <= maximumSec ? seconds : 0;
}
