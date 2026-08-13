import type { RideRecord } from "./ride-context";

export interface LocalActivityHighlight {
  kind: "personal-best" | "segment-pr" | "streak";
  title: string;
  detail: string;
  accent: "gold" | "green" | "blue";
}

export interface BestPowerEffort {
  seconds: number;
  watts: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(value: number | Date): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 計算今日（若已騎）或最近騎乘日為結尾的連續騎乘天數。 */
export function calculateRideDayStreak(records: RideRecord[], referenceDate: number | Date = Date.now()): number {
  const days = new Set(records.map((record) => startOfLocalDay(record.date)));
  let cursor = startOfLocalDay(referenceDate);
  if (!days.has(cursor)) cursor -= DAY_MS;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/**
 * 依 powerHistory 的推估取樣間隔計算最大平均功率。
 * 資料不足時回傳空陣列，畫面應改顯示「尚未收集足夠功率資料」。
 */
export function calculateBestPowerEfforts(record: RideRecord): BestPowerEffort[] {
  const samples = (record.powerHistory ?? []).filter((value) => Number.isFinite(value) && value >= 0);
  const movingSeconds = Math.max(0, record.movingTime ?? record.duration - (record.totalPausedSec ?? 0));
  if (samples.length < 2 || movingSeconds <= 0) return [];
  const secondsPerSample = Math.max(1, movingSeconds / samples.length);
  const intervals = [5, 15, 30, 60, 120, 300, 600, 1200];

  return intervals.flatMap((seconds) => {
    const window = Math.max(1, Math.round(seconds / secondsPerSample));
    if (window > samples.length) return [];
    let rolling = samples.slice(0, window).reduce((sum, value) => sum + value, 0);
    let maxAverage = rolling / window;
    for (let index = window; index < samples.length; index += 1) {
      rolling += samples[index] - samples[index - window];
      maxAverage = Math.max(maxAverage, rolling / window);
    }
    return [{ seconds, watts: Math.round(maxAverage) }];
  });
}

export function buildLocalActivityHighlights(
  record: RideRecord,
  records: RideRecord[],
): LocalActivityHighlight[] {
  const highlights: LocalActivityHighlight[] = [];
  const bestLabels = record.personalBests?.map((best) => best.label).filter(Boolean) ?? [];
  if (bestLabels.length > 0) {
    highlights.push({ kind: "personal-best", title: "本機個人最佳", detail: bestLabels.slice(0, 2).join("、"), accent: "gold" });
  }
  const prSegments = record.segmentAchievements?.filter((segment) => segment.isPR) ?? [];
  if (prSegments.length > 0) {
    highlights.push({ kind: "segment-pr", title: `路段個人紀錄 ${prSegments.length} 項`, detail: prSegments[0].segmentName, accent: "gold" });
  }
  const streak = calculateRideDayStreak(records, record.date);
  if (streak >= 2) {
    highlights.push({ kind: "streak", title: `連續騎乘 ${streak} 天`, detail: "持續累積你的本機訓練紀錄", accent: "blue" });
  }
  return highlights.slice(0, 4);
}
