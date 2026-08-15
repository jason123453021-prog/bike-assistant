export const SUPPLY_NOTIFICATION_CATEGORY = "SUPPLY_REMINDER";
export const SUPPLY_SNOOZE_ACTION = "SUPPLY_SNOOZE";
export const SUPPLY_CONFIRM_ACTION = "SUPPLY_CONFIRM";

export type SupplyNotificationKind =
  | "calorie"
  | "water"
  | "custom-energy"
  | "custom-water"
  | "interval-energy-time"
  | "interval-energy-distance"
  | "interval-water-time"
  | "interval-water-distance";
export type SupplyNotificationActionType = "snooze" | "confirm";

export interface SupplyNotificationAction {
  action: SupplyNotificationActionType;
  kind: SupplyNotificationKind;
  customItemId?: string;
}

type NotificationResponseLike = {
  actionIdentifier?: string;
  notification?: { request?: { content?: { data?: unknown } } };
};

function isSupplyKind(value: unknown): value is SupplyNotificationKind {
  return value === "calorie"
    || value === "water"
    || value === "custom-energy"
    || value === "custom-water"
    || value === "interval-energy-time"
    || value === "interval-energy-distance"
    || value === "interval-water-time"
    || value === "interval-water-distance";
}

/** 將原生通知回應安全轉換為本機補給動作，未知資料一律忽略。 */
export function parseSupplyNotificationAction(response: NotificationResponseLike): SupplyNotificationAction | null {
  const data = response.notification?.request?.content?.data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (record.type !== "supply_reminder" || !isSupplyKind(record.supplyKind)) return null;

  const customItemId = typeof record.customItemId === "string" ? record.customItemId : undefined;
  if (response.actionIdentifier === SUPPLY_CONFIRM_ACTION) return { action: "confirm", kind: record.supplyKind, customItemId };
  if (response.actionIdentifier === SUPPLY_SNOOZE_ACTION) return { action: "snooze", kind: record.supplyKind, customItemId };
  return null;
}
