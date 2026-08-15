import type { SupplyPlan } from "@/lib/smart-supply-plan";

export type SmartSupplyKind = "calorie" | "water";

export interface SmartSupplyCountdown {
  calorieStartedElapsedSec: number;
  waterStartedElapsedSec: number;
  calorieDueElapsedSec: number;
  waterDueElapsedSec: number;
  calorieDurationSec: number;
  waterDurationSec: number;
}

function durationFor(kind: SmartSupplyKind, plan: SupplyPlan): number {
  return kind === "calorie" ? plan.energyCountdownSec : plan.waterCountdownSec;
}

/** 在開始騎乘或重建會話時，從目前騎乘時間安排兩種智慧補給倒數。 */
export function createSmartSupplyCountdown(plan: SupplyPlan, elapsedSec: number): SmartSupplyCountdown {
  const calorieDurationSec = durationFor("calorie", plan);
  const waterDurationSec = durationFor("water", plan);
  return {
    calorieStartedElapsedSec: elapsedSec,
    waterStartedElapsedSec: elapsedSec,
    calorieDurationSec,
    waterDurationSec,
    calorieDueElapsedSec: elapsedSec + calorieDurationSec,
    waterDueElapsedSec: elapsedSec + waterDurationSec,
  };
}

/** 僅在使用者明確按下某類別的「已補給」後，重啟該類別下一輪倒數。 */
export function restartSmartSupplyCountdown(
  countdown: SmartSupplyCountdown,
  kind: SmartSupplyKind,
  plan: SupplyPlan,
  elapsedSec: number,
): SmartSupplyCountdown {
  const durationSec = durationFor(kind, plan);
  return kind === "calorie"
    ? { ...countdown, calorieStartedElapsedSec: elapsedSec, calorieDurationSec: durationSec, calorieDueElapsedSec: elapsedSec + durationSec }
    : { ...countdown, waterStartedElapsedSec: elapsedSec, waterDurationSec: durationSec, waterDueElapsedSec: elapsedSec + durationSec };
}

/** 保持原倒數起點，只以最新騎乘與環境模型修正其到期時間。 */
export function refreshSmartSupplyCountdown(
  countdown: SmartSupplyCountdown,
  plan: SupplyPlan,
): SmartSupplyCountdown {
  const calorieDurationSec = plan.energyCountdownSec;
  const waterDurationSec = plan.waterCountdownSec;
  return {
    ...countdown,
    calorieDurationSec,
    waterDurationSec,
    calorieDueElapsedSec: countdown.calorieStartedElapsedSec + calorieDurationSec,
    waterDueElapsedSec: countdown.waterStartedElapsedSec + waterDurationSec,
  };
}

export function smartSupplyCountdownRemainingSec(
  countdown: SmartSupplyCountdown | null,
  kind: SmartSupplyKind,
  elapsedSec: number,
): number | null {
  if (!countdown) return null;
  const dueElapsedSec = kind === "calorie" ? countdown.calorieDueElapsedSec : countdown.waterDueElapsedSec;
  return Math.max(0, Math.round(dueElapsedSec - elapsedSec));
}

export function isSmartSupplyCountdownDue(
  countdown: SmartSupplyCountdown | null,
  kind: SmartSupplyKind,
  elapsedSec: number,
): boolean {
  const remainingSec = smartSupplyCountdownRemainingSec(countdown, kind, elapsedSec);
  return remainingSec !== null && remainingSec <= 0;
}
