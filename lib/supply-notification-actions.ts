import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { exportTranslation } from "@/lib/i18n/export-localization";

import { getLocalNotifications } from "@/lib/local-notifications";
import {
  parseSupplyNotificationAction,
  SUPPLY_CONFIRM_ACTION,
  SUPPLY_NOTIFICATION_CATEGORY,
  SUPPLY_SNOOZE_ACTION,
  type SupplyNotificationAction,
  type SupplyNotificationKind,
} from "@/lib/supply-notification-action-model";

export {
  parseSupplyNotificationAction,
  SUPPLY_CONFIRM_ACTION,
  SUPPLY_NOTIFICATION_CATEGORY,
  SUPPLY_SNOOZE_ACTION,
  type SupplyNotificationAction,
  type SupplyNotificationKind,
} from "@/lib/supply-notification-action-model";
export const SUPPLY_SNOOZE_SECONDS = 5 * 60;

const PENDING_ACTIONS_KEY = "@bike_pending_supply_notification_actions";

const listeners = new Set<() => void>();

export interface SupplyNotificationActionListenerOptions {
  /** 只有點擊通知本體或完成確認後，才導向可呈現騎乘狀態的畫面。 */
  onOpen?: () => void;
  /**
   * Android 可能在導航頁尚未掛載前交付「已補給」動作。
   * 此回呼用於先將確認結果寫回背景快照，避免舊的待確認旗標重現彈窗。
   */
  onConfirm?: (action: SupplyNotificationAction) => Promise<void> | void;
}

export async function configureSupplyNotificationActions(): Promise<void> {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationCategoryAsync(SUPPLY_NOTIFICATION_CATEGORY, [
    { identifier: SUPPLY_SNOOZE_ACTION, buttonTitle: exportTranslation("notifications.snooze") },
    { identifier: SUPPLY_CONFIRM_ACTION, buttonTitle: exportTranslation("notifications.confirm") },
  ]).catch(() => {});
}

export async function scheduleSupplySnooze(kind: SupplyNotificationKind): Promise<void> {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;
  await configureSupplyNotificationActions();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: exportTranslation("notifications.snoozedTitle"),
      body: exportTranslation("notifications.snoozedBody"),
      sound: true,
      categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
      data: { type: "supply_reminder", supplyKind: kind },
      ...(Platform.OS === "android" ? { channelId: "supply" } : {}),
    },
    trigger: { seconds: SUPPLY_SNOOZE_SECONDS } as never,
  }).catch(() => {});
}

async function queueSupplyNotificationAction(action: SupplyNotificationAction): Promise<void> {
  const stored = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
  const actions: SupplyNotificationAction[] = stored ? JSON.parse(stored) : [];
  actions.push(action);
  await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(actions));
  listeners.forEach((listener) => listener());
}

export async function consumeSupplyNotificationActions(): Promise<SupplyNotificationAction[]> {
  try {
    const stored = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
    await AsyncStorage.removeItem(PENDING_ACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function subscribeToSupplyNotificationActions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 在根布局啟動；通知回應會先安全持久化，再交由導航頁同步畫面與本機倒數。 */
export function startSupplyNotificationActionListener(options?: SupplyNotificationActionListenerOptions): () => void {
  let active = true;
  let subscription: { remove: () => void } | null = null;

  void (async () => {
    const Notifications = await getLocalNotifications();
    if (!Notifications || !active) return;
    await configureSupplyNotificationActions();

    const handleResponse = async (response: Parameters<typeof parseSupplyNotificationAction>[0]) => {
      const action = parseSupplyNotificationAction(response);
      if (!action) return;
      if (action.action === "confirm") {
        await Promise.resolve(options?.onConfirm?.(action)).catch(() => {});
      }
      await queueSupplyNotificationAction(action).catch(() => {});
      // 通知本體只開啟待確認 UI；「已補給」則在上方先完成持久化確認，再開啟畫面同步下一輪倒數。
      if (active && (action.action === "open" || action.action === "confirm")) options?.onOpen?.();
    };
    const lastResponse = await Notifications.getLastNotificationResponseAsync().catch(() => null);
    if (lastResponse) {
      void handleResponse(lastResponse);
      await Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
    subscription = Notifications.addNotificationResponseReceivedListener((response) => { void handleResponse(response); });
  })();

  return () => {
    active = false;
    subscription?.remove();
  };
}
