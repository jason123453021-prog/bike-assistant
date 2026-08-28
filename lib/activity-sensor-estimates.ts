export type AnalysisDataSource = "measured" | "estimated";

export interface ActivityAnalysisInputPoint {
  timestamp: number;
  speedKmh: number;
  powerW?: number;
  heartRate?: number;
  cadence?: number;
  gradePct?: number;
}

export interface ActivityAnalysisProfile {
  ftpW: number;
  age: number;
  maxHeartRate?: number;
  restingHeartRate?: number;
  temperatureC?: number;
  humidityPct?: number;
  headwindMs?: number;
  /** 僅由既有本機 RPE 歷史得出的保守強度修正，限制於 ±8%。 */
  intensityAdjustment?: number;
  confidence?: "low" | "medium" | "high";
  calibrationSampleCount?: number;
}

export interface ActivityAnalysisPoint extends ActivityAnalysisInputPoint {
  powerW: number;
  heartRate: number;
  cadence: number;
}

export interface ActivitySensorAnalysis {
  points: ActivityAnalysisPoint[];
  sources: {
    speed: AnalysisDataSource;
    power: AnalysisDataSource;
    heartRate: AnalysisDataSource;
    cadence: AnalysisDataSource;
  };
  confidence: "low" | "medium" | "high";
  factors: string[];
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

/**
 * 以騎乘強度（相對 FTP）、速度、坡度及已保存環境摘要產生心率與踏頻的離線估算。
 * 此模型只提供趨勢檢視；它不嘗試取代心率帶、功率計或踏頻器的原始量測。
 */
export function buildActivitySensorAnalysis(
  input: ActivityAnalysisInputPoint[],
  profile: ActivityAnalysisProfile,
): ActivitySensorAnalysis {
  const hasPowerValue = input.some((point) => Number.isFinite(point.powerW) && (point.powerW ?? 0) > 0);
  const hasMeasuredHeartRate = input.some((point) => Number.isFinite(point.heartRate) && (point.heartRate ?? 0) > 0);
  const hasMeasuredCadence = input.some((point) => Number.isFinite(point.cadence) && (point.cadence ?? 0) > 0);
  const ftpW = clamp(profile.ftpW || 200, 80, 600);
  const maximumHeartRate = clamp(profile.maxHeartRate ?? (208 - 0.7 * clamp(profile.age || 32, 14, 90)), 120, 230);
  const restingHeartRate = clamp(profile.restingHeartRate ?? 60, 35, maximumHeartRate - 30);
  const heartRateReserve = maximumHeartRate - restingHeartRate;
  const heatLoad = Math.max(0, (profile.temperatureC ?? 20) - 20) * 0.006
    + Math.max(0, (profile.humidityPct ?? 55) - 55) * 0.0015;
  const headwindLoad = Math.max(0, profile.headwindMs ?? 0) * 0.008;
  const calibrationAdjustment = clamp(profile.intensityAdjustment ?? 0, -0.08, 0.08);

  let previousHeartRate = restingHeartRate;
  let previousCadence: number | undefined;
  const points = input.map((point) => {
    const speedKmh = Math.max(0, point.speedKmh || 0);
    const gradePct = clamp(point.gradePct ?? 0, -18, 22);
    const isMoving = speedKmh >= 2;
    const fallbackPower = isMoving
      ? clamp(35 + speedKmh * 3.4 + Math.max(0, gradePct) * 13 + Math.max(0, gradePct) * speedKmh * 0.5, 0, 900)
      : 0;
    const powerW = clamp(hasPowerValue ? (point.powerW ?? fallbackPower) : fallbackPower, 0, 900);

    const intensity = clamp(powerW / ftpW, 0, 1.25);
    const targetHeartRate = isMoving
      ? clamp(restingHeartRate + heartRateReserve * clamp(0.31 + intensity * 0.52 + heatLoad + headwindLoad + calibrationAdjustment, 0.36, 0.94), restingHeartRate, maximumHeartRate)
      : restingHeartRate;
    const estimatedHeartRate = Math.round(previousHeartRate + clamp(targetHeartRate - previousHeartRate, -4, 5));
    const heartRate = Math.round(hasMeasuredHeartRate && (point.heartRate ?? 0) > 0 ? point.heartRate! : estimatedHeartRate);
    previousHeartRate = heartRate;

    const targetCadence = isMoving
      ? clamp(47 + speedKmh * 1.08 + intensity * 13 - Math.max(0, gradePct) * 1.05 + Math.max(0, -gradePct) * 0.3, 45, 115)
      : 0;
    const estimatedCadence = Math.round(isMoving
      ? previousCadence === undefined
        ? targetCadence
        : previousCadence + clamp(targetCadence - previousCadence, -8, 9)
      : 0);
    const cadence = Math.round(hasMeasuredCadence && (point.cadence ?? 0) > 0 ? point.cadence! : estimatedCadence);
    previousCadence = cadence;

    return {
      ...point,
      speedKmh,
      gradePct,
      powerW: Math.round(powerW),
      heartRate,
      cadence,
    };
  });

  return {
    points,
    sources: {
      speed: "measured",
      // 舊版紀錄未保存功率裝置來源；為避免把虛擬功率誤稱實測，一律保守標示為估算。
      power: "estimated",
      heartRate: hasMeasuredHeartRate ? "measured" : "estimated",
      cadence: hasMeasuredCadence ? "measured" : "estimated",
    },
    confidence: hasMeasuredHeartRate || hasMeasuredCadence ? "high" : profile.confidence ?? "low",
    factors: [
      "GPS 速度與坡度",
      "FTP 與個人最大／靜息心率",
      ...(profile.temperatureC !== undefined || profile.humidityPct !== undefined ? ["溫度與濕度"] : []),
      ...(profile.headwindMs !== undefined ? ["逆風分量"] : []),
      ...(profile.calibrationSampleCount && profile.calibrationSampleCount > 0 ? [`${profile.calibrationSampleCount} 次本機 RPE 校正`] : []),
    ],
  };
}
