/**
 * 位置與羅盤只屬於進行中的騎乘工作階段。
 * 暫停仍保留工作階段，直到使用者明確結束騎乘才釋放資源。
 */
export function shouldTrackRideLocation(isRideSessionActive: boolean): boolean {
  return isRideSessionActive;
}

export function shouldTrackRideHeading(
  isRideSessionActive: boolean,
  headingUpEnabled: boolean,
): boolean {
  return isRideSessionActive && headingUpEnabled;
}
