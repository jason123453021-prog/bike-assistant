/**
 * 訓練壓力分數（TSS - Training Stress Score）計算模組
 *
 * TSS 是衡量訓練強度和持續時間的綜合指標
 * 公式：TSS = (秒數 × 平均功率 × IF) / (FTP × 3600) × 100
 * 其中 IF (Intensity Factor) = 平均功率 / FTP
 *
 * 參考資料：TrainingPeaks TSS 計算方法
 */

/**
 * FTP 估算：基於體重的功能性閾值功率
 * 一般業餘騎士：FTP ≈ 體重(kg) × 3.5 W/kg
 * 進階騎士：FTP ≈ 體重(kg) × 4.5-5.5 W/kg
 * 職業選手：FTP ≈ 體重(kg) × 6-7 W/kg
 */
export function estimateFTP(weightKg: number, level: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'): number {
  const factors = {
    beginner: 3.0,
    intermediate: 3.5,
    advanced: 4.5,
  };
  return Math.round(weightKg * factors[level]);
}

/**
 * 計算強度係數（IF - Intensity Factor）
 * IF = 平均功率 / FTP
 * IF < 0.75：恢復訓練（Zone 1）
 * IF 0.75-0.85：耐力訓練（Zone 2）
 * IF 0.85-1.0：節奏訓練（Zone 3）
 * IF 1.0-1.15：乳酸閾值訓練（Zone 4）
 * IF > 1.15：無氧訓練（Zone 5）
 */
export function calculateIntensityFactor(avgPowerW: number, ftpW: number): number {
  if (ftpW <= 0) return 0;
  return avgPowerW / ftpW;
}

/**
 * 計算標準化功率（NP - Normalized Power）
 * 考慮功率波動的更準確指標
 * 公式：NP = (所有 30 秒功率值的 4 次方平均)^(1/4)
 *
 * 簡化版本：使用平均功率的加權計算
 * 當功率波動大時，NP > 平均功率
 * 當功率穩定時，NP ≈ 平均功率
 */
export function calculateNormalizedPower(
  avgPowerW: number,
  maxPowerW: number,
  variabilityIndex: number = 1.0
): number {
  // variabilityIndex：功率變異性指數（1.0 = 穩定，1.2-1.5 = 波動大）
  // 簡化計算：NP = 平均功率 × (1 + 功率變異性係數)
  const variabilityFactor = Math.min(0.3, (maxPowerW - avgPowerW) / (avgPowerW + 1) * 0.2);
  return avgPowerW * (1 + variabilityFactor);
}

/**
 * 計算訓練壓力分數（TSS）
 * TSS = (秒數 × 平均功率 × IF) / (FTP × 3600) × 100
 *
 * TSS 解釋：
 * < 50：輕度訓練
 * 50-100：中度訓練
 * 100-150：高度訓練
 * 150-200：非常高度訓練
 * > 200：極限訓練（恢復日不應超過 150）
 */
export function calculateTSS(
  durationSeconds: number,
  avgPowerW: number,
  ftpW: number
): number {
  if (durationSeconds <= 0 || ftpW <= 0) return 0;

  const if_ = calculateIntensityFactor(avgPowerW, ftpW);
  const tss = (durationSeconds * avgPowerW * if_) / (ftpW * 3600) * 100;

  return Math.round(tss * 10) / 10; // 保留一位小數
}

/**
 * 計算訓練效果評分（Training Effect）
 * 基於 TSS 和強度係數的綜合評分
 *
 * 評分等級：
 * 1.0-2.0：輕度訓練效果
 * 2.0-3.0：中度訓練效果
 * 3.0-4.0：高度訓練效果
 * 4.0-5.0：非常高度訓練效果
 */
export function calculateTrainingEffect(tss: number, if_: number): number {
  // 訓練效果 = (TSS / 100) × (IF × 1.5)
  // 高強度訓練效果更明顯
  const baseEffect = (tss / 100) * 2;
  const intensityBonus = Math.max(0, (if_ - 0.75) * 2); // 強度越高加分越多
  const totalEffect = baseEffect + intensityBonus;

  return Math.round(totalEffect * 10) / 10; // 保留一位小數
}

/**
 * 計算訓練負荷（Training Load）
 * 用於評估訓練的累積疲勞程度
 *
 * 負荷等級：
 * < 100：輕度負荷
 * 100-200：適度負荷
 * 200-300：高度負荷
 * > 300：過度負荷（需要恢復）
 */
export function calculateTrainingLoad(tss: number, durationMinutes: number): number {
  // 訓練負荷 = TSS × (時間係數)
  // 長時間訓練的負荷更高
  const durationFactor = 1 + (durationMinutes / 60 - 1) * 0.2; // 每多 1 小時增加 20%
  const load = tss * durationFactor;

  return Math.round(load);
}

/**
 * 獲取訓練效果標籤
 */
export function getTrainingEffectLabel(trainingEffect: number): string {
  if (trainingEffect < 1.0) return '無效果';
  if (trainingEffect < 2.0) return '輕度';
  if (trainingEffect < 3.0) return '中度';
  if (trainingEffect < 4.0) return '高度';
  return '非常高度';
}

/**
 * 獲取訓練負荷標籤
 */
export function getTrainingLoadLabel(load: number): string {
  if (load < 100) return '輕度';
  if (load < 200) return '適度';
  if (load < 300) return '高度';
  return '過度';
}

/**
 * 獲取強度係數標籤
 */
export function getIntensityLabel(if_: number): string {
  if (if_ < 0.75) return '恢復 (Z1)';
  if (if_ < 0.85) return '耐力 (Z2)';
  if (if_ < 1.0) return '節奏 (Z3)';
  if (if_ < 1.15) return '乳酸閾值 (Z4)';
  return '無氧 (Z5)';
}

export interface TrainingAnalysis {
  tss: number;                    // 訓練壓力分數
  intensityFactor: number;        // 強度係數
  normalizedPower: number;        // 標準化功率
  trainingEffect: number;         // 訓練效果評分
  trainingLoad: number;           // 訓練負荷
  trainingEffectLabel: string;    // 訓練效果標籤
  trainingLoadLabel: string;      // 訓練負荷標籤
  intensityLabel: string;         // 強度標籤
}

/**
 * 完整的訓練分析
 */
export function analyzeTraining(
  durationSeconds: number,
  avgPowerW: number,
  maxPowerW: number,
  ftpW: number
): TrainingAnalysis {
  const if_ = calculateIntensityFactor(avgPowerW, ftpW);
  const np = calculateNormalizedPower(avgPowerW, maxPowerW);
  const tss = calculateTSS(durationSeconds, avgPowerW, ftpW);
  const trainingEffect = calculateTrainingEffect(tss, if_);
  const trainingLoad = calculateTrainingLoad(tss, durationSeconds / 60);

  return {
    tss,
    intensityFactor: Math.round(if_ * 100) / 100,
    normalizedPower: Math.round(np),
    trainingEffect,
    trainingLoad,
    trainingEffectLabel: getTrainingEffectLabel(trainingEffect),
    trainingLoadLabel: getTrainingLoadLabel(trainingLoad),
    intensityLabel: getIntensityLabel(if_),
  };
}
