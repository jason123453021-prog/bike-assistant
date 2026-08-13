import { recommendFtp } from "./ftp-recommendation";
import type { RideRecord } from "./ride-context";

export type PersonalMetricSource = "history" | "recorded" | "age-baseline" | "fallback";

export interface AutoPersonalMetrics {
  ftpW: number;
  maxHeartRate: number;
  restingHeartRate: number;
  sourceRideCount: number;
  sources: {
    ftp: PersonalMetricSource;
    maxHeartRate: PersonalMetricSource;
    restingHeartRate: PersonalMetricSource;
  };
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

/**
 * 自動個人指標只使用裝置內既有騎乘；無有效資料時維持安全回退值。
 * 心率帶未連線時，心率值是年齡基準推定，並非醫療量測或真正靜息心率。
 */
export function deriveAutoPersonalMetrics(
  records: RideRecord[],
  fallback: { ftpW: number; age: number; maxHeartRate?: number; restingHeartRate?: number },
): AutoPersonalMetrics {
  const ftpRecommendation = recommendFtp(records, fallback.ftpW);
  const recordedMaxima = records
    .map((record) => record.maxHeartRate)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 100 && value < 230);
  const maxHeartRate = recordedMaxima.length
    ? Math.max(...recordedMaxima)
    : clamp(208 - 0.7 * clamp(fallback.age, 14, 90), 120, 220);
  const restingHeartRate = clamp(maxHeartRate * 0.32, 45, 72);
  return {
    ftpW: ftpRecommendation?.recommendedFtpW ?? Math.max(80, fallback.ftpW),
    maxHeartRate: Math.round(maxHeartRate),
    restingHeartRate: Math.round(restingHeartRate),
    sourceRideCount: ftpRecommendation?.sourceRideCount ?? 0,
    sources: {
      ftp: ftpRecommendation ? "history" : "fallback",
      maxHeartRate: recordedMaxima.length ? "recorded" : "age-baseline",
      restingHeartRate: "age-baseline",
    },
  };
}
