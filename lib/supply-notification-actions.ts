import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

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

export async function configureSupplyNotificationActions(): Promise<void> {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationCategoryAsync(SUPPLY_NOTIFICATION_CATEGORY, [
    { identifier: SUPPLY_SNOOZE_ACTION, buttonTitle: "稍後提醒" },
    { identifier: SUPPLY_CONFIRM_ACTION, buttonTitle: "已補給" },
  ]).catch(() => {});
}

export async function scheduleSupplySnooze(kind: SupplyNotificationKind): Promise<void> {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;
  await configureSupplyNotificationActions();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "補給提醒",
      body: "稍後提醒時間已到，請依騎乘狀況補充能量與水分。",
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

/** 在根布局啟動；通知回應會先保存，待導航頁可用時再同步處理。 */
export function startSupplyNotificationActionListener(options?: { onOpen?: () => void }): () => void {
  let active = true;
  let subscription: { remove: () => void } | null = null;

  void (async () => {
    const Notifications = await getLocalNotifications();
    if (!Notifications || !active) return;
    await configureSupplyNotificationActions();

    const handleResponse = (response: Parameters<typeof parseSupplyNotificationAction>[0]) => {
      const action = parseSupplyNotificationAction(response);
      if (!action) return;
      void queueSupplyNotificationAction(action).then(() => {
        // 只有使用者點擊通知本體時才透過 Router 導向騎乘頁；不從背景工作強制啟動 Activity。
        if (active && action.action === "open") options?.onOpen?.();
      });
    };
    const lastResponse = await Notifications.getLastNotificationResponseAsync().catch(() => null);
    if (lastResponse) {
      handleResponse(lastResponse);
      await Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
    subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  })();

  return () => {
    active = false;
    subscription?.remove();
  };
}
