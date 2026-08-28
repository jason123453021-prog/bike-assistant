/**
 * 決定前景恢復時是否應重新顯示特定補給提醒。
 * 已在前景列為待處理的提醒不可再次開啟，避免 AppState 恢復與背景旗標競態造成重複彈窗。
 */
export function shouldRestoreBackgroundSupplyReminder(input: {
  persistedPending: boolean;
  countdownDue: boolean;
  pendingInForeground: boolean;
}): boolean {
  return !input.pendingInForeground && (input.persistedPending || input.countdownDue);
}
