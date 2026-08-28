import type { NavigationDashboardFieldKey } from "./navigation-dashboard-defaults";

export type NavigationDashboardSummaryKey = "grade" | "avgSpeed" | "currentAltitude" | "maxPower";

/**
 * 展開摘要列只顯示主儀表板尚未顯示的獨立指標。
 * 「總爬升」僅保留在可設定的主儀表板欄位，避免與舊摘要列重複。
 */
export function buildNavigationDashboardSummaryKeys(
  primaryFields: readonly NavigationDashboardFieldKey[],
): NavigationDashboardSummaryKey[] {
  const primary = new Set(primaryFields);
  const summary: NavigationDashboardSummaryKey[] = [];

  if (!primary.has("showGrade")) summary.push("grade");
  if (!primary.has("showAvgSpeed")) summary.push("avgSpeed");
  if (!primary.has("showCurrentAltitude")) summary.push("currentAltitude");
  summary.push("maxPower");

  return summary;
}
