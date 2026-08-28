export function canStartTouchGuardHold(input: {
  isLocked: boolean;
  isRideActive: boolean;
  activeTouchCount: number;
  pointerIdentifier: number | null;
}): boolean {
  return (
    input.isLocked &&
    input.isRideActive &&
    input.activeTouchCount > 0 &&
    Number.isFinite(input.pointerIdentifier)
  );
}

/** 只有同一個有效觸控指標持續按住完整時間，才可解除騎乘防誤觸。 */
export function hasCompletedTouchGuardHold(input: {
  pointerActive: boolean;
  pointerIdentifier: number | null;
  startedAtMs: number | null;
  nowMs: number;
  requiredHoldMs: number;
}): boolean {
  return (
    input.pointerActive &&
    Number.isFinite(input.pointerIdentifier) &&
    input.startedAtMs !== null &&
    Number.isFinite(input.nowMs) &&
    input.nowMs - input.startedAtMs >= input.requiredHoldMs
  );
}
