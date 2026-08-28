import { exportTranslation } from "./i18n/export-localization";
import type { SupportedLocale } from "./i18n/types";
import type { SupplyNotificationKind } from "./supply-notification-action-model";

export interface SupplyNotificationContentOptions {
  energyKcal?: number;
  carbohydrateG?: number;
  waterMl?: number;
  intervalValue?: number;
}

/** 以指定 locale 建立本機通知內容；背景任務可避開 i18n 的預設語言回退。 */
export function createLocalizedSupplyNotificationContent(
  kind: SupplyNotificationKind,
  options: SupplyNotificationContentOptions = {},
  locale?: SupportedLocale,
): { title: string; body: string } {
  const isWater = kind === "water" || kind === "custom-water" || kind.startsWith("interval-water");
  const title = `${isWater ? "💧" : "🍌"} ${exportTranslation(isWater ? "notifications.waterTitle" : "notifications.supplyTitle", undefined, locale)}`;
  const intervalValue = options.intervalValue ?? 0;

  if (kind === "interval-energy-time") return { title, body: exportTranslation("notifications.energyTimeDue", { value: intervalValue }, locale) };
  if (kind === "interval-energy-distance") return { title, body: exportTranslation("notifications.energyDistanceDue", { value: intervalValue }, locale) };
  if (kind === "interval-water-time") return { title, body: exportTranslation("notifications.waterTimeDue", { value: intervalValue }, locale) };
  if (kind === "interval-water-distance") return { title, body: exportTranslation("notifications.waterDistanceDue", { value: intervalValue }, locale) };
  if (!isWater && options.energyKcal) {
    return { title, body: exportTranslation("notifications.energyRecommendation", { kcal: Math.round(options.energyKcal), carbs: options.carbohydrateG ? Math.round(options.carbohydrateG) : "" }, locale) };
  }
  if (isWater && options.waterMl) return { title, body: exportTranslation("notifications.waterRecommendation", { ml: Math.round(options.waterMl) }, locale) };
  return { title, body: exportTranslation(isWater ? "notifications.waterDue" : "notifications.energyDue", undefined, locale) };
}
