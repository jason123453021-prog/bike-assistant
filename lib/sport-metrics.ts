import { getSportModelProfile, type GovernedSportType } from "./model-governance";

export type SportType = GovernedSportType;

export interface SpeedSample {
  speedKmh: number;
  timestamp: number;
}

export interface AltitudeSample {
  altitudeM: number | null;
  timestamp: number;
}

export interface SportTrackingPolicy {
  gpsDistanceIntervalM: number;
  stationaryDriftThresholdM: number;
  autoPause: {
    mode: "automatic" | "suggest";
    speedBelowKmh: number;
    stillForSeconds: number;
    requiresStillness: boolean;
  };
}

export interface SportDashboardMetric {
  label: string;
  value: string;
  unit: string;
}

export const SPORT_META: Record<SportType, { label: string; icon: string; gpxType: string; accent: string }> = {
  cycling: { label: "單車", icon: "🚴", gpxType: "Cycling", accent: "#00C853" },
  running: { label: "跑步", icon: "🏃", gpxType: "Running", accent: "#FF6B00" },
  hiking: { label: "登山／爬山", icon: "🥾", gpxType: "Hiking", accent: "#A56A2A" },
  trail_running: { label: "越野跑", icon: "🏃‍♂️", gpxType: "Trail Running", accent: "#E65A27" },
};

export const SPORT_TRACKING_POLICIES: Record<SportType, SportTrackingPolicy> = Object.fromEntries(
  (Object.keys(SPORT_META) as SportType[]).map((sportType) => {
    const tracking = getSportModelProfile(sportType).tracking;
    return [sportType, {
      gpsDistanceIntervalM: tracking.gpsDistanceIntervalM,
      stationaryDriftThresholdM: tracking.stationaryDriftThresholdM,
      autoPause: {
        mode: tracking.autoPauseMode,
        speedBelowKmh: tracking.autoPauseSpeedBelowKmh,
        stillForSeconds: tracking.autoPauseStillForSeconds,
        requiresStillness: tracking.requiresStillness,
      },
    }];
  }),
) as Record<SportType, SportTrackingPolicy>;

/** 讀取目前有效模型，讓下一次啟動驗證過的離線快取可立即帶入導航。 */
export function getSportTrackingPolicy(sportType: SportType, _modelRevision?: number): SportTrackingPolicy {
  const tracking = getSportModelProfile(sportType).tracking;
  return {
    gpsDistanceIntervalM: tracking.gpsDistanceIntervalM,
    stationaryDriftThresholdM: tracking.stationaryDriftThresholdM,
    autoPause: {
      mode: tracking.autoPauseMode,
      speedBelowKmh: tracking.autoPauseSpeedBelowKmh,
      stillForSeconds: tracking.autoPauseStillForSeconds,
      requiresStillness: tracking.requiresStillness,
    },
  };
}

export function formatPaceFromKmh(speedKmh: number): string {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0.05) return "--'--\"";
  const secondsPerKm = Math.round(3600 / speedKmh);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;
  return `${String(minutes).padStart(2, "0")}'${String(seconds).padStart(2, "0")}\"`;
}

/** 取最近十秒（最少五秒）的速度樣本平均，避免 GPS 飄移造成配速跳動。 */
export function smoothSpeedKmh(samples: SpeedSample[], windowSec = 8): number {
  if (!samples.length) return 0;
  const latest = samples[samples.length - 1].timestamp;
  const windowStart = latest - Math.max(5, windowSec) * 1000;
  const recent = samples.filter((sample) => sample.timestamp >= windowStart && Number.isFinite(sample.speedKmh) && sample.speedKmh >= 0);
  if (!recent.length) return 0;
  return recent.reduce((total, sample) => total + sample.speedKmh, 0) / recent.length;
}

/**
 * 以公開坡度耗能曲線的局部近似推導平地等效配速。這是透明的離線估算，非 Strava 的專有 GAP 演算法。
 */
export function calculateGapPaceSecPerKm(actualPaceSecPerKm: number, gradePct: number): number | null {
  if (!Number.isFinite(actualPaceSecPerKm) || actualPaceSecPerKm <= 0) return null;
  const grade = Math.max(-0.3, Math.min(0.3, gradePct / 100));
  const energyCost = 155.4 * grade ** 5 - 30.4 * grade ** 4 - 43.3 * grade ** 3 + 46.3 * grade ** 2 + 19.5 * grade + 3.6;
  const safeCost = Math.max(1.5, energyCost);
  return actualPaceSecPerKm * (3.6 / safeCost);
}

export function formatPaceSeconds(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "--'--\"";
  const rounded = Math.round(secondsPerKm);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}'${String(rounded % 60).padStart(2, "0")}\"`;
}

/** 以最近 30 秒有效高度樣本計算正向垂直爬升速度。 */
export function calculateVamMPerHour(samples: AltitudeSample[], windowSec = 30): number {
  const valid = samples.filter((sample) => Number.isFinite(sample.altitudeM) && Number.isFinite(sample.timestamp));
  if (valid.length < 2) return 0;
  const latest = valid[valid.length - 1];
  const windowStart = latest.timestamp - windowSec * 1000;
  const window = valid.filter((sample) => sample.timestamp >= windowStart);
  if (window.length < 2) return 0;
  let ascentM = 0;
  for (let index = 1; index < window.length; index += 1) {
    ascentM += Math.max(0, (window[index].altitudeM ?? 0) - (window[index - 1].altitudeM ?? 0));
  }
  const durationSec = Math.max(1, (window[window.length - 1].timestamp - window[0].timestamp) / 1000);
  return (ascentM / durationSec) * 3600;
}

export function estimateSportCalories(params: {
  sportType: SportType;
  weightKg: number;
  durationSec: number;
  speedKmh: number;
  gradePct?: number;
  vamMPerHour?: number;
}): number {
  const profile = getSportModelProfile(params.sportType);
  const weightKg = Math.max(25, params.weightKg || 70);
  const minutes = Math.max(0, params.durationSec) / 60;
  const grade = Math.max(0, params.gradePct ?? 0);
  const speed = Math.max(0, params.speedKmh);
  let mets: number;
  switch (params.sportType) {
    case "running":
      mets = speed < 8 ? 8 : speed < 10 ? 9.8 : 11;
      break;
    case "hiking":
      mets = Math.min(9, 5.3 + Math.min(2.2, grade * 0.18) + Math.min(1.5, (params.vamMPerHour ?? 0) / 500));
      break;
    case "trail_running":
      mets = Math.min(13, (speed < 8 ? 8.5 : 10.5) + Math.min(2.5, grade * 0.2) + Math.min(1, (params.vamMPerHour ?? 0) / 800));
      break;
    case "cycling":
    default:
      mets = speed < 16 ? 6.8 : speed < 22 ? 8 : 10;
      break;
  }
  return (mets * profile.calorieMetMultiplier * 3.5 * weightKg / 200) * minutes;
}

export function buildSportDashboardMetrics(params: {
  sportType: SportType;
  speedKmh: number;
  averageSpeedKmh: number;
  distanceM: number;
  elapsedSec: number;
  altitudeM: number;
  totalAscentM: number;
  gradePct: number;
  gapPaceSecPerKm?: number | null;
  vamMPerHour?: number;
}): SportDashboardMetric[] {
  const distance = (Math.max(0, params.distanceM) / 1000).toFixed(2);
  const elapsed = `${Math.floor(params.elapsedSec / 3600).toString().padStart(2, "0")}:${Math.floor((params.elapsedSec % 3600) / 60).toString().padStart(2, "0")}`;
  if (params.sportType === "running") {
    return [
      { label: "當前配速", value: formatPaceFromKmh(params.speedKmh), unit: "/km" },
      { label: "平均配速", value: formatPaceFromKmh(params.averageSpeedKmh), unit: "/km" },
      { label: "距離", value: distance, unit: "km" },
      { label: "運動時間", value: elapsed, unit: "" },
    ];
  }
  if (params.sportType === "hiking") {
    return [
      { label: "目前海拔", value: Math.round(params.altitudeM).toString(), unit: "m" },
      { label: "總爬升", value: Math.round(params.totalAscentM).toString(), unit: "m" },
      { label: "爬升速度", value: Math.round(params.vamMPerHour ?? 0).toString(), unit: "m/h" },
      { label: "目前坡度", value: params.gradePct.toFixed(1), unit: "%" },
      { label: "距離", value: distance, unit: "km" },
    ];
  }
  if (params.sportType === "trail_running") {
    return [
      { label: "當前配速", value: formatPaceFromKmh(params.speedKmh), unit: "/km" },
      { label: "GAP", value: formatPaceSeconds(params.gapPaceSecPerKm ?? null), unit: "/km" },
      { label: "總爬升", value: Math.round(params.totalAscentM).toString(), unit: "m" },
      { label: "目前海拔", value: Math.round(params.altitudeM).toString(), unit: "m" },
      { label: "距離", value: distance, unit: "km" },
    ];
  }
  return [
    { label: "速度", value: params.speedKmh > 0 ? params.speedKmh.toFixed(1) : "--", unit: "km/h" },
    { label: "平均速度", value: params.averageSpeedKmh > 0 ? params.averageSpeedKmh.toFixed(1) : "--", unit: "km/h" },
    { label: "距離", value: distance, unit: "km" },
    { label: "運動時間", value: elapsed, unit: "" },
  ];
}
