import type { RideRecord } from "./ride-context";

export type EstimationConfidence = "low" | "medium" | "high";

export interface LocalEstimationCalibration {
  rpeSampleCount: number;
  intensityAdjustment: number;
  confidence: EstimationConfidence;
  summary: string;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

/**
 * 僅以使用者自行填寫的 RPE 與裝置內歷史騎乘資料進行保守校正。
 * 沒有心率／踏頻器時，此校正只調整生理強度趨勢，不會宣稱為量測校準。
 */
export function deriveLocalEstimationCalibration(records: RideRecord[], fallbackFtpW: number): LocalEstimationCalibration {
  const samples = records.filter((record) => (
    record.duration >= 20 * 60
    && record.avgPower > 0
    && record.perceivedExertion !== undefined
    && record.perceivedExertion >= 1
    && record.perceivedExertion <= 10
  ));
  if (samples.length === 0) {
    return { rpeSampleCount: 0, intensityAdjustment: 0, confidence: "low", summary: "尚無已填寫 RPE 的本機騎乘，使用通用估算模型" };
  }
  const residuals = samples.map((record) => {
    const ftp = Math.max(80, record.calculationProfile?.ftpW ?? fallbackFtpW);
    const expectedRpe = clamp(2 + (record.avgPower / ftp) * 7, 1, 10);
    return record.perceivedExertion! - expectedRpe;
  });
  const meanResidual = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
  const intensityAdjustment = clamp(meanResidual * 0.012, -0.08, 0.08);
  const confidence: EstimationConfidence = samples.length >= 8 ? "high" : samples.length >= 3 ? "medium" : "low";
  return {
    rpeSampleCount: samples.length,
    intensityAdjustment,
    confidence,
    summary: `依 ${samples.length} 次本機騎乘的 RPE 進行保守趨勢校正`,
  };
}
