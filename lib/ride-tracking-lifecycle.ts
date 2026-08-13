/**
 * 位置與羅盤只屬於進行中的騎乘工作階段。
 * 暫停仍保留工作階段，直到使用者明確結束騎乘才釋放資源。
 */
export function shouldTrackRideLocation(isRideSessionActive: boolean, isAppForeground: boolean = true): boolean {
  // 未開始騎乘時，僅在 App 位於前台時取得目前位置（供釘選導航使用）；開始騎乘後不論前台背景皆持續定位紀錄。
  return isRideSessionActive || isAppForeground;
}

export function shouldTrackRideHeading(
  isRideSessionActive: boolean,
  headingUpEnabled: boolean,
): boolean {
  return isRideSessionActive && headingUpEnabled;
}
