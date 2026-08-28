import type { WeatherData } from "./weather-service";

export const HYDRATION_DATA_TIMEOUT_MS = 60 * 1000;
const MIN_WATER_COUNTDOWN_SEC = 10 * 60;
const MAX_WATER_COUNTDOWN_SEC = 30 * 60;

export interface HydrationSensorSnapshot {
  elapsedSec: number;
  powerW: number;
  speedKmh: number;
  sweatRatePerHour: number;
  headingDeg?: number | null;
}

export type HydrationInputWaitResult =
  | { status: "complete"; weather: WeatherData; sensors: HydrationSensorSnapshot }
  | { status: "incomplete" | "timeout" };

/**
 * 補水下一輪只在兩類資料都已取得時採用新的動態計畫；最多等待 60 秒，避免網路延遲卡住確認流程。
 */
export async function awaitHydrationInputs(input: {
  weatherPromise: Promise<WeatherData | null>;
  sensorPromise: Promise<HydrationSensorSnapshot | null>;
  timeoutMs?: number;
}): Promise<HydrationInputWaitResult> {
  const completePromise = Promise.all([input.weatherPromise, input.sensorPromise]).then(([weather, sensors]) => {
    if (!weather || !sensors) return { status: "incomplete" } as const;
    return { status: "complete", weather, sensors } as const;
  });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<HydrationInputWaitResult>((resolve) => {
    timeoutId = setTimeout(() => resolve({ status: "timeout" }), input.timeoutMs ?? HYDRATION_DATA_TIMEOUT_MS);
  });
  const result = await Promise.race([completePromise, timeoutPromise]);
  if (timeoutId) clearTimeout(timeoutId);
  return result;
}

/** 網路逾時時沿用上一輪；若尚無可沿用值（首輪斷網），保守採 10 分鐘。 */
export function resolveWaterCountdownFallbackDuration(previousDurationSec?: number | null): number {
  if (!Number.isFinite(previousDurationSec)) return MIN_WATER_COUNTDOWN_SEC;
  return Math.min(MAX_WATER_COUNTDOWN_SEC, Math.max(MIN_WATER_COUNTDOWN_SEC, Math.round(previousDurationSec as number)));
}
