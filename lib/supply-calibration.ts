import { calculateSweatLoss } from "./hydration-calc";

export interface SweatCalibrationResult {
  applied: boolean;
  nextMultiplier: number;
  nextCount: number;
  reason: string;
}

const MIN_MULTIPLIER = 0.75;
const MAX_MULTIPLIER = 1.25;
const MIN_AUTOMATIC_RIDES = 3;
const MIN_AUTOMATIC_DURATION_SEC = 45 * 60;
const MAX_AUTOMATIC_RIDES = 12;

/** 僅保留自動校正真正需要的本機活動欄位，避免校正模組依賴畫面或資料庫。 */
export interface AutomaticSweatCalibrationRide {
  id: string;
  date: number;
  duration: number;
  movingTime?: number;
  totalSweatMl: number;
  avgPower: number;
  avgSpeed: number;
  totalAscent: number;
  averageGrade?: number;
  calculationProfile?: {
    riderWeightKg: number;
    ftpW: number;
    environment?: {
      averageTemperatureC?: number;
      averageHumidityPct?: number;
      averageHeadwindMs?: number;
      averagePrecipitationProb?: number;
      weatherCode?: number;
    };
  };
  supplyConfirmations?: Array<{
    type: "energy" | "water";
    source?: "smart" | "smart-offline-fallback" | "custom";
    recommendedWaterMl?: number;
  }>;
}

export interface AutomaticSweatCalibrationInput {
  rides: AutomaticSweatCalibrationRide[];
  currentMultiplier: number;
  completedCalibrations: number;
  lastProcessedRideId?: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function getAutomaticRideRatio(ride: AutomaticSweatCalibrationRide): number | undefined {
  const movingTime = Math.max(0, ride.movingTime ?? ride.duration);
  const profile = ride.calculationProfile;
  if (movingTime < MIN_AUTOMATIC_DURATION_SEC || ride.totalSweatMl < 350 || !profile) return undefined;

  // 只將使用者已確認的智慧補水事件視為可用互動訊號；沒有確認時不調整倍率。
  const confirmedSmartWaterCount = (ride.supplyConfirmations ?? []).filter((confirmation) =>
    confirmation.type === "water"
    && (confirmation.source === "smart" || confirmation.source === "smart-offline-fallback")
    && Number.isFinite(confirmation.recommendedWaterMl)
    && (confirmation.recommendedWaterMl ?? 0) >= 150,
  ).length;
  if (confirmedSmartWaterCount === 0) return undefined;

  const environment = profile.environment;
  const neutralHourlyEstimate = calculateSweatLoss({
    weightKg: profile.riderWeightKg,
    heightCm: 175,
    powerW: ride.avgPower,
    ftpW: profile.ftpW,
    speedKmh: ride.avgSpeed,
    ascentPerInterval: ride.totalAscent / Math.max(1, movingTime / 3600),
    gradePct: ride.averageGrade ?? 0,
    intervalSec: 3600,
    temperatureC: environment?.averageTemperatureC ?? 20,
    humidityPct: environment?.averageHumidityPct ?? 60,
    weatherCode: environment?.weatherCode ?? 3,
    isDaylight: true,
    headwindMs: environment?.averageHeadwindMs ?? 0,
    precipitationProb: environment?.averagePrecipitationProb ?? 0,
    calibrationMultiplier: 1,
  }).sweatRatePerHour;
  const recordedHourlyEstimate = ride.totalSweatMl / (movingTime / 3600);
  return clamp(recordedHourlyEstimate / Math.max(1, neutralHourlyEstimate), MIN_MULTIPLIER, MAX_MULTIPLIER);
}

/**
 * 根據多次已完成騎乘的本機估算與「已補水」確認，保守調整個人汗率倍率。
 * 沒有體重變化或汗液量量測時，App 不會把這視為醫療／生理測量；因此僅小幅收斂，
 * 必須有至少三筆 45 分鐘以上的有效騎乘，且永遠限制在基準值的 ±25%。
 */
export function deriveAutomaticSweatCalibration(input: AutomaticSweatCalibrationInput): SweatCalibrationResult {
  const currentMultiplier = clamp(Number.isFinite(input.currentMultiplier) ? input.currentMultiplier : 1, MIN_MULTIPLIER, MAX_MULTIPLIER);
  const count = Math.max(0, Math.floor(input.completedCalibrations || 0));
  const mostRecentRides = [...input.rides]
    .sort((left, right) => right.date - left.date)
    .slice(0, MAX_AUTOMATIC_RIDES);
  const latestRideId = mostRecentRides[0]?.id;

  if (!latestRideId || latestRideId === input.lastProcessedRideId) {
    return {
      applied: false,
      nextMultiplier: currentMultiplier,
      nextCount: count,
      reason: "本次活動已完成自動汗率校正，維持目前本機補水模型。",
    };
  }

  const ratios = mostRecentRides
    .map(getAutomaticRideRatio)
    .filter((ratio): ratio is number => ratio !== undefined);
  if (ratios.length < MIN_AUTOMATIC_RIDES) {
    return {
      applied: false,
      nextMultiplier: currentMultiplier,
      nextCount: count,
      reason: `自動校正需累積至少 ${MIN_AUTOMATIC_RIDES} 次含已確認智慧補水的 45 分鐘有效騎乘；目前資料不足。`,
    };
  }

  const targetMultiplier = median(ratios);
  // 每個活動週期最多朝近期中位值收斂 15%，避免單次天候、GPS 或確認行為改變造成跳動。
  const nextMultiplier = clamp(
    currentMultiplier + (targetMultiplier - currentMultiplier) * 0.15,
    MIN_MULTIPLIER,
    MAX_MULTIPLIER,
  );
  return {
    applied: true,
    nextMultiplier: Math.round(nextMultiplier * 100) / 100,
    nextCount: count + 1,
    reason: `已依 ${ratios.length} 次本機有效騎乘與智慧補水確認，自動保守更新汗率模型。`,
  };
}
