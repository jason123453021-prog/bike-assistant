/**
 * 訓練壓力分數（TSS - Training Stress Score）計算模組
 *
 * TSS 是衡量訓練強度和持續時間的綜合指標
 * 公式：TSS = (秒數 × 標準化功率 × IF) / (FTP × 3600) × 100
 * 其中 IF (Intensity Factor) = 標準化功率 / FTP
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
 * IF = 標準化功率 / FTP；沒有功率序列時以平均功率相容回退。
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
 * 若有完整功率序列，請使用 calculateNormalizedPowerFromHistory。
 * 此函式只保留給沒有原始序列的舊版紀錄作相容性回退，不以最大功率推測 NP。
 */
export function calculateNormalizedPower(
  avgPowerW: number,
  _maxPowerW: number,
  _variabilityIndex: number = 1.0
): number {
  return Math.max(0, avgPowerW);
}

/**
 * 依標準 30 秒滾動平均與四次方平均法計算 NP。
 * GPS 功率序列未必是 1 秒取樣，因此使用有效騎乘時間推估取樣間距。
 */
export function calculateNormalizedPowerFromHistory(powerHistory: number[], movingTimeSeconds: number): number | undefined {
  const samples = powerHistory.filter((power) => Number.isFinite(power) && power >= 0);
  if (samples.length === 0) return undefined;
  const average = samples.reduce((sum, power) => sum + power, 0) / samples.length;
  if (samples.length < 2 || movingTimeSeconds <= 0) return Math.round(average);

  const secondsPerSample = movingTimeSeconds / samples.length;
  const windowSize = Math.max(1, Math.round(30 / Math.max(secondsPerSample, 0.1)));
  if (samples.length < windowSize) return Math.round(average);

  let windowSum = 0;
  let fourthPowerSum = 0;
  let rollingCount = 0;
  for (let index = 0; index < samples.length; index += 1) {
    windowSum += samples[index];
    if (index >= windowSize) windowSum -= samples[index - windowSize];
    if (index >= windowSize - 1) {
      fourthPowerSum += (windowSum / windowSize) ** 4;
      rollingCount += 1;
    }
  }
  return rollingCount > 0 ? Math.round((fourthPowerSum / rollingCount) ** 0.25) : Math.round(average);
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
  normalizedPowerW: number,
  ftpW: number
): number {
  if (durationSeconds <= 0 || ftpW <= 0) return 0;

  const if_ = calculateIntensityFactor(normalizedPowerW, ftpW);
  const tss = (durationSeconds * normalizedPowerW * if_) / (ftpW * 3600) * 100;

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
  ftpW: number,
  powerHistory?: number[]
): TrainingAnalysis {
  const np = calculateNormalizedPowerFromHistory(powerHistory ?? [], durationSeconds)
    ?? calculateNormalizedPower(avgPowerW, maxPowerW);
  const if_ = calculateIntensityFactor(np, ftpW);
  const tss = calculateTSS(durationSeconds, np, ftpW);
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


/**
 * 獲取恢復建議
 * 基於訓練負荷等級推薦恢復時間
 */
export function getRecoveryRecommendation(trainingLoad: number): {
  hours: number;
  label: string;
  description: string;
} {
  if (trainingLoad < 100) {
    return {
      hours: 12,
      label: '輕度恢復',
      description: '輕度訓練，12 小時恢復即可',
    };
  }
  if (trainingLoad < 200) {
    return {
      hours: 24,
      label: '適度恢復',
      description: '適度訓練，需要 24 小時恢復',
    };
  }
  if (trainingLoad < 300) {
    return {
      hours: 36,
      label: '高度恢復',
      description: '高度訓練，建議 36 小時充分恢復',
    };
  }
  return {
    hours: 48,
    label: '完全恢復',
    description: '過度訓練，需要 48 小時以上完全恢復',
  };
}

/**
 * FTP 自適應計算
 * 根據歷史最大功率自動調整 FTP 估算值
 * 公式：新 FTP = 歷史平均最大功率 × 0.75（FTP 通常為最大功率的 75%）
 */
export function calculateAdaptiveFTP(
  maxPowerHistory: number[],
  currentFtpW: number
): {
  newFtpW: number;
  change: number;
  recommendation: string;
} {
  if (maxPowerHistory.length === 0) {
    return {
      newFtpW: currentFtpW,
      change: 0,
      recommendation: '數據不足，無法調整',
    };
  }

  // 計算歷史最大功率的平均值（取最高的 10% 作為代表）
  const sortedMaxPower = [...maxPowerHistory].sort((a, b) => b - a);
  const topPercentile = Math.ceil(maxPowerHistory.length * 0.1);
  const topMaxPowers = sortedMaxPower.slice(0, Math.max(1, topPercentile));
  const avgTopMaxPower = topMaxPowers.reduce((a, b) => a + b, 0) / topMaxPowers.length;

  // 新 FTP = 平均最大功率 × 0.75
  const newFtpW = Math.round(avgTopMaxPower * 0.75);
  const change = newFtpW - currentFtpW;
  const changePercent = Math.round((change / currentFtpW) * 100);

  let recommendation = '';
  if (Math.abs(change) < 5) {
    recommendation = 'FTP 穩定，無需調整';
  } else if (change > 0) {
    recommendation = `FTP 上升 ${changePercent}%，訓練效果顯著，建議更新 FTP`;
  } else {
    recommendation = `FTP 下降 ${Math.abs(changePercent)}%，可能需要調整訓練強度`;
  }

  return {
    newFtpW,
    change,
    recommendation,
  };
}

/**
 * 獲取周期訓練統計
 * 計算指定時間範圍內的訓練統計
 */
export interface PeriodTrainingStats {
  totalTSS: number;                 // 總 TSS
  averageTSS: number;               // 平均 TSS
  rideCount: number;                // 騎乘次數
  totalDuration: number;            // 總時間（秒）
  averageIntensity: number;         // 平均強度係數
  trainingLoadLabel: string;        // 訓練負荷等級
  intensityDistribution: {          // 強度分布
    recovery: number;               // 恢復訓練比例
    endurance: number;              // 耐力訓練比例
    tempo: number;                  // 節奏訓練比例
    threshold: number;              // 乳酸閾值訓練比例
    anaerobic: number;              // 無氧訓練比例
  };
}

/**
 * 計算周期訓練統計
 */
export function calculatePeriodStats(
  tssValues: number[],
  ifValues: number[],
  durationValues: number[]
): PeriodTrainingStats {
  if (tssValues.length === 0) {
    return {
      totalTSS: 0,
      averageTSS: 0,
      rideCount: 0,
      totalDuration: 0,
      averageIntensity: 0,
      trainingLoadLabel: '無訓練',
      intensityDistribution: {
        recovery: 0,
        endurance: 0,
        tempo: 0,
        threshold: 0,
        anaerobic: 0,
      },
    };
  }

  const totalTSS = tssValues.reduce((a, b) => a + b, 0);
  const averageTSS = totalTSS / tssValues.length;
  const totalDuration = durationValues.reduce((a, b) => a + b, 0);
  const averageIntensity = ifValues.reduce((a, b) => a + b, 0) / ifValues.length;

  // 計算強度分布
  const intensityDistribution = {
    recovery: ifValues.filter((if_) => if_ < 0.75).length,
    endurance: ifValues.filter((if_) => if_ >= 0.75 && if_ < 0.85).length,
    tempo: ifValues.filter((if_) => if_ >= 0.85 && if_ < 1.0).length,
    threshold: ifValues.filter((if_) => if_ >= 1.0 && if_ < 1.15).length,
    anaerobic: ifValues.filter((if_) => if_ >= 1.15).length,
  };

  // 歸一化為百分比
  const total = Object.values(intensityDistribution).reduce((a, b) => a + b, 0);
  const normalized = {
    recovery: Math.round((intensityDistribution.recovery / total) * 100),
    endurance: Math.round((intensityDistribution.endurance / total) * 100),
    tempo: Math.round((intensityDistribution.tempo / total) * 100),
    threshold: Math.round((intensityDistribution.threshold / total) * 100),
    anaerobic: Math.round((intensityDistribution.anaerobic / total) * 100),
  };

  // 計算訓練負荷等級
  const totalLoad = tssValues.reduce((sum, tss) => sum + tss, 0);
  let trainingLoadLabel = '';
  if (totalLoad < 300) {
    trainingLoadLabel = '輕度';
  } else if (totalLoad < 600) {
    trainingLoadLabel = '適度';
  } else if (totalLoad < 900) {
    trainingLoadLabel = '高度';
  } else {
    trainingLoadLabel = '過度';
  }

  return {
    totalTSS,
    averageTSS: Math.round(averageTSS * 10) / 10,
    rideCount: tssValues.length,
    totalDuration,
    averageIntensity: Math.round(averageIntensity * 100) / 100,
    trainingLoadLabel,
    intensityDistribution: normalized,
  };
}
