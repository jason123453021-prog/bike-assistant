/**
 * 格式化暫停面板的裝置系統時間。
 * 此工具只處理顯示，不會讀寫騎乘狀態、活動時間、移動時間或暫停時間。
 */
export function formatPausedSystemClock(now: Date): string {
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}
