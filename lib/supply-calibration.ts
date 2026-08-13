export interface SweatCalibrationInput {
  estimatedSweatMl: number;
  confirmedFluidMl: number;
  currentMultiplier: number;
  completedCalibrations: number;
}

export interface SweatCalibrationResult {
  applied: boolean;
  nextMultiplier: number;
  nextCount: number;
  reason: string;
}

const MIN_MULTIPLIER = 0.75;
const MAX_MULTIPLIER = 1.25;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * 使用者確認「騎乘期間與結束後補回」的總補水量後，保守修正汗率模型。
 * 此為個人化估算校正，非醫療診斷：每次只收斂 35%，且倍率限制為基準值的 ±25%。
 */
export function calibrateSweatRate(input: SweatCalibrationInput): SweatCalibrationResult {
  const currentMultiplier = clamp(Number.isFinite(input.currentMultiplier) ? input.currentMultiplier : 1, MIN_MULTIPLIER, MAX_MULTIPLIER);
  const estimated = Number.isFinite(input.estimatedSweatMl) ? input.estimatedSweatMl : 0;
  const confirmed = Number.isFinite(input.confirmedFluidMl) ? input.confirmedFluidMl : 0;
  const count = Math.max(0, Math.floor(input.completedCalibrations || 0));

  if (estimated < 250 || confirmed < 150) {
    return {
      applied: false,
      nextMultiplier: currentMultiplier,
      nextCount: count,
      reason: "本次騎乘或補水量不足以校正；維持目前汗率設定。",
    };
  }

  const observedRatio = clamp(confirmed / estimated, MIN_MULTIPLIER, MAX_MULTIPLIER);
  const nextMultiplier = clamp(currentMultiplier + (observedRatio - currentMultiplier) * 0.35, MIN_MULTIPLIER, MAX_MULTIPLIER);
  return {
    applied: true,
    nextMultiplier: Math.round(nextMultiplier * 100) / 100,
    nextCount: count + 1,
    reason: "已依使用者確認的補水量保守校正本機汗率；可隨時在設定頁重設。",
  };
}

export function resetSweatCalibration(): Pick<SweatCalibrationResult, "nextMultiplier" | "nextCount"> {
  return { nextMultiplier: 1, nextCount: 0 };
}
