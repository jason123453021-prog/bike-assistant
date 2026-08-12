import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

type NotificationsModule = typeof import("expo-notifications");

let notificationsPromise: Promise<NotificationsModule | null> | null = null;

/**
 * Expo Go 自 SDK 53 起不再提供 Android 遠端推播 token 功能。為避免套件載入時
 * 觸發該警告，Expo Go 一律不動態載入 expo-notifications；畫面內的補給 Modal、
 * 語音與震動仍照常提供提醒。原生開發版與正式版則繼續使用本機通知。
 */
export function isExpoGoRuntime(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function canUseNativeLocalNotifications(): boolean {
  return Platform.OS !== "web" && !isExpoGoRuntime();
}

export async function getLocalNotifications(): Promise<NotificationsModule | null> {
  if (!canUseNativeLocalNotifications()) {
    return null;
  }

  if (!notificationsPromise) {
    notificationsPromise = import("expo-notifications")
      .then(async (notifications) => {
        // 強制關閉任何先前遺留的遠端 device token 自動註冊設定。
        await notifications.setAutoServerRegistrationEnabledAsync(false).catch(() => {});
        return notifications;
      })
      .catch((error) => {
        console.warn("[LocalNotifications] 無法載入本機通知模組：", error);
        return null;
      });
  }

  return notificationsPromise;
}
