import type { SupplyPlan } from "@/lib/smart-supply-plan";

export type SmartSupplyKind = "calorie" | "water";

export interface SmartSupplyCountdown {
  calorieStartedElapsedSec: number;
  waterStartedElapsedSec: number;
  calorieDueElapsedSec: number;
  waterDueElapsedSec: number;
  calorieDurationSec: number;
  waterDurationSec: number;
  /** 本輪建立時的絕對時間，暫停騎乘碼表不會影響倒數。 */
  calorieStartedAtMs: number;
  waterStartedAtMs: number;
  /** 本輪已鎖定的絕對到期時間；只有確認後重新建立該類別時才改變。 */
  calorieDueAtMs: number;
  waterDueAtMs: number;
}

function durationFor(kind: SmartSupplyKind, plan: SupplyPlan): number {
  return kind === "calorie" ? plan.energyCountdownSec : plan.waterCountdownSec;
}

/** 在開始騎乘或重建會話時安排兩種鎖定的真實時間智慧補給倒數。 */
export function createSmartSupplyCountdown(plan: SupplyPlan, elapsedSec: number, nowMs = Date.now()): SmartSupplyCountdown {
  const calorieDurationSec = durationFor("calorie", plan);
  const waterDurationSec = durationFor("water", plan);
  return {
    calorieStartedElapsedSec: elapsedSec,
    waterStartedElapsedSec: elapsedSec,
    calorieDurationSec,
    waterDurationSec,
    calorieDueElapsedSec: elapsedSec + calorieDurationSec,
    waterDueElapsedSec: elapsedSec + waterDurationSec,
    calorieStartedAtMs: nowMs,
    waterStartedAtMs: nowMs,
    calorieDueAtMs: nowMs + calorieDurationSec * 1_000,
    waterDueAtMs: nowMs + waterDurationSec * 1_000,
  };
}

/** 僅在使用者明確按下某類別的「已補給」後，重啟該類別下一輪倒數。 */
export function restartSmartSupplyCountdown(
  countdown: SmartSupplyCountdown,
  kind: SmartSupplyKind,
  plan: SupplyPlan,
  elapsedSec: number,
  nowMs = Date.now(),
): SmartSupplyCountdown {
  const durationSec = durationFor(kind, plan);
  return kind === "calorie"
    ? {
      ...countdown,
      calorieStartedElapsedSec: elapsedSec,
      calorieDurationSec: durationSec,
      calorieDueElapsedSec: elapsedSec + durationSec,
      calorieStartedAtMs: nowMs,
      calorieDueAtMs: nowMs + durationSec * 1_000,
    }
    : {
      ...countdown,
      waterStartedElapsedSec: elapsedSec,
      waterDurationSec: durationSec,
      waterDueElapsedSec: elapsedSec + durationSec,
      waterStartedAtMs: nowMs,
      waterDueAtMs: nowMs + durationSec * 1_000,
    };
}

export function smartSupplyCountdownRemainingSec(
  countdown: SmartSupplyCountdown | null,
  kind: SmartSupplyKind,
  nowMs = Date.now(),
): number | null {
  if (!countdown) return null;
  const dueAtMs = kind === "calorie" ? countdown.calorieDueAtMs : countdown.waterDueAtMs;
  return Math.max(0, Math.ceil((dueAtMs - nowMs) / 1_000));
}

export function isSmartSupplyCountdownDue(
  countdown: SmartSupplyCountdown | null,
  kind: SmartSupplyKind,
  nowMs = Date.now(),
): boolean {
  const remainingSec = smartSupplyCountdownRemainingSec(countdown, kind, nowMs);
  return remainingSec !== null && remainingSec <= 0;
}
