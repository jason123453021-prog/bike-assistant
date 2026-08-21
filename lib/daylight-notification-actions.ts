import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocalNotifications } from "./local-notifications";
import {
  DAYLIGHT_CONFIRM_ACTION,
  DAYLIGHT_SUNRISE_CATEGORY,
  DAYLIGHT_SUNSET_CATEGORY,
  parseDaylightNotificationAction,
  type DaylightNotificationAction,
} from "./daylight-notification-action-model";

const DAYLIGHT_ACTIONS_KEY = "@bike_daylight_notification_actions";

export {
  DAYLIGHT_CONFIRM_ACTION,
  DAYLIGHT_SUNRISE_CATEGORY,
  DAYLIGHT_SUNSET_CATEGORY,
  parseDaylightNotificationAction,
  type DaylightNotificationAction,
};

type Listener = () => void;
const listeners = new Set<Listener>();
let configured = false;

async function enqueue(action: DaylightNotificationAction) {
  try {
    const raw = await AsyncStorage.getItem(DAYLIGHT_ACTIONS_KEY);
    const current = raw ? JSON.parse(raw) : [];
    const queue = Array.isArray(current) ? current : [];
    if (!queue.some((item) => item?.eventKey === action.eventKey)) queue.push(action);
    await AsyncStorage.setItem(DAYLIGHT_ACTIONS_KEY, JSON.stringify(queue.slice(-12)));
    listeners.forEach((listener) => listener());
  } catch {}
}

export async function configureDaylightNotificationActions() {
  const Notifications = await getLocalNotifications();
  if (!Notifications || configured) return;
  try {
    await Notifications.setNotificationCategoryAsync(DAYLIGHT_SUNRISE_CATEGORY, [{
      identifier: DAYLIGHT_CONFIRM_ACTION,
      buttonTitle: "已關閉警示燈",
      options: { opensAppToForeground: true },
    }]);
    await Notifications.setNotificationCategoryAsync(DAYLIGHT_SUNSET_CATEGORY, [{
      identifier: DAYLIGHT_CONFIRM_ACTION,
      buttonTitle: "已開啟警示燈",
      options: { opensAppToForeground: true },
    }]);
    configured = true;
    const last = await Notifications.getLastNotificationResponseAsync();
    const parsed = last ? parseDaylightNotificationAction(last) : undefined;
    if (parsed) await enqueue(parsed);
    Notifications.addNotificationResponseReceivedListener((response) => {
      const action = parseDaylightNotificationAction(response);
      if (action) void enqueue(action);
    });
  } catch {}
}

export async function consumeDaylightNotificationActions(): Promise<DaylightNotificationAction[]> {
  try {
    const raw = await AsyncStorage.getItem(DAYLIGHT_ACTIONS_KEY);
    await AsyncStorage.removeItem(DAYLIGHT_ACTIONS_KEY);
    const actions = raw ? JSON.parse(raw) : [];
    return Array.isArray(actions) ? actions.filter((item): item is DaylightNotificationAction => (
      item?.kind === "sunrise" || item?.kind === "sunset"
    ) && typeof item?.eventKey === "string") : [];
  } catch {
    return [];
  }
}

export function subscribeToDaylightNotificationActions(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
