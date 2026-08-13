export interface AutomaticRpeInput {
  intensityFactor?: number;
  averagePowerW: number;
  ftpW: number;
  movingTimeSec: number;
  distanceMeters: number;
  totalAscentMeters: number;
  temperatureC?: number;
  humidityPct?: number;
  powerSampleCount: number;
}

export interface AutomaticRpeResult {
  value: number;
  confidence: "low" | "medium" | "high";
  factors: string[];
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

/**
 * 以訓練強度、移動時間、爬升與環境負荷推定 1–10 的「App 推定 RPE」。
 * 真正 RPE 是使用者感受；此結果僅減少輸入操作並用於離線趨勢分析。
 */
export function estimateAutomaticRpe(input: AutomaticRpeInput): AutomaticRpeResult {
  const intensity = clamp(input.intensityFactor ?? (input.averagePowerW / Math.max(80, input.ftpW)), 0, 1.25);
  const durationHours = Math.max(0, input.movingTimeSec / 3600);
  const climbPerKm = input.totalAscentMeters / Math.max(1, input.distanceMeters / 1000);
  const heatLoad = Math.max(0, (input.temperatureC ?? 20) - 24) * 0.08
    + Math.max(0, (input.humidityPct ?? 55) - 65) * 0.015;
  const value = Math.round(clamp(
    1.2 + intensity * 5.6 + Math.min(1.4, durationHours * 0.55) + Math.min(0.9, climbPerKm * 0.035) + heatLoad,
    1,
    10,
  ));
  const confidence = input.powerSampleCount >= 80 && input.movingTimeSec >= 20 * 60
    ? "high"
    : input.powerSampleCount >= 20 && input.movingTimeSec >= 10 * 60
      ? "medium"
      : "low";
  return {
    value,
    confidence,
    factors: [
      "FTP 相對強度",
      "移動時間",
      "爬升密度",
      ...(input.temperatureC !== undefined || input.humidityPct !== undefined ? ["溫度與濕度"] : []),
    ],
  };
}
