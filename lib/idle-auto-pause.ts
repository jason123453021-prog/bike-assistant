export type RideLocationTrackingMode = "full" | "idle_monitor";

export interface IdleAutoPauseConfig {
  enabled: boolean;
  idleTimeoutSeconds: number;
}

/** 靜止已進入暫停狀態且超過門檻時，改為低功耗移動監測。 */
export function shouldEnterIdleMonitor(
  config: IdleAutoPauseConfig,
  isRidePaused: boolean,
  pausedAtMs: number | null,
  nowMs: number,
): boolean {
  return config.enabled
    && isRidePaused
    && pausedAtMs !== null
    && nowMs - pausedAtMs >= config.idleTimeoutSeconds * 1000;
}

/** 低功耗模式以速度或實際位移任一條件確認已重新騎乘。 */
export function shouldResumeFromIdleMonitor(speedKmh: number, movementMeters: number): boolean {
  return speedKmh >= 3 || movementMeters >= 18;
}
