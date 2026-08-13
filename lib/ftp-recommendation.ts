import type { RideRecord } from "./ride-context";

export interface FtpRecommendation {
  recommendedFtpW: number;
  rawEstimateW: number;
  currentFtpW: number;
  sourceRideCount: number;
  confidence: "moderate" | "high";
  rationale: string;
}

const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1_000;
const TEST_WINDOW_SECONDS = 20 * 60;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function bestTwentyMinutePower(record: RideRecord): number | undefined {
  const samples = (record.powerHistory ?? []).filter((power) => Number.isFinite(power) && power > 0 && power < 2_000);
  if (record.duration < TEST_WINDOW_SECONDS || samples.length < 20) return undefined;
  const secondsPerSample = record.duration / samples.length;
  const windowSize = Math.max(1, Math.round(TEST_WINDOW_SECONDS / secondsPerSample));
  if (windowSize > samples.length) return undefined;
  let rolling = samples.slice(0, windowSize).reduce((total, value) => total + value, 0);
  let best = rolling / windowSize;
  for (let index = windowSize; index < samples.length; index += 1) {
    rolling += samples[index] - samples[index - windowSize];
    best = Math.max(best, rolling / windowSize);
  }
  return best;
}

/**
 * 以最近有效騎乘的最佳 20 分鐘功率估計 FTP；僅產生候選值，由使用者明確確認後才能寫入設定。
 * 此模型不將一般平均功率視為正式 FTP 測試，也不使用舊於 90 天的資料。
 */
export function recommendFtp(records: RideRecord[], currentFtpW: number, now = Date.now()): FtpRecommendation | null {
  const efforts = records
    .filter((record) => now - record.date <= LOOKBACK_MS && record.date <= now)
    .map((record) => bestTwentyMinutePower(record))
    .filter((power): power is number => power !== undefined);
  if (efforts.length < 2) return null;

  const recent = efforts.sort((a, b) => b - a).slice(0, 3);
  const rawEstimateW = Math.round(median(recent) * 0.95);
  const safeCurrent = Number.isFinite(currentFtpW) && currentFtpW > 0 ? currentFtpW : rawEstimateW;
  const recommendedFtpW = Math.round(Math.max(safeCurrent * 0.85, Math.min(safeCurrent * 1.15, rawEstimateW)));
  const variation = recent.length > 1 ? (Math.max(...recent) - Math.min(...recent)) / Math.max(1, median(recent)) : 1;
  const confidence = recent.length >= 3 && variation <= 0.07 ? "high" : "moderate";
  const capped = recommendedFtpW !== rawEstimateW;
  return {
    recommendedFtpW,
    rawEstimateW,
    currentFtpW: safeCurrent,
    sourceRideCount: efforts.length,
    confidence,
    rationale: capped
      ? `以最近 ${efforts.length} 次有效騎乘的 20 分鐘功率估計；為避免單次波動，建議值已限制在目前 FTP 的 ±15% 內。`
      : `以最近 ${efforts.length} 次有效騎乘的 20 分鐘功率估計，並以 95% 轉為 FTP 候選值。`,
  };
}
