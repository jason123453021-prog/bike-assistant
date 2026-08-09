/**
 * 回饋服務 — 震動、TTS 語音播報、通知
 *
 * 注意：expo-notifications 的遠端推播功能在 Expo Go SDK 53+ 已移除。
 * 本地通知（scheduleNotificationAsync）在 Expo Go 中仍可使用，
 * 但所有呼叫均加上 try-catch 以防止未預期的錯誤。
 */

import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ─── 震動回饋 ─────────────────────────────────────────────────────────────────

export async function vibrateLight() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export async function vibrateMedium() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

export async function vibrateHeavy() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {}
}

export async function vibrateSuccess() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

export async function vibrateWarning() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

// ─── TTS 語音播報 ─────────────────────────────────────────────────────────────

export async function speak(text: string, enabled: boolean = true) {
  if (!enabled || Platform.OS === "web") return;
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) await Speech.stop();
    Speech.speak(text, {
      language: "zh-TW",
      pitch: 1.0,
      rate: 0.9,
    });
  } catch {}
}

export async function stopSpeech() {
  if (Platform.OS === "web") return;
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) await Speech.stop();
  } catch {}
}

export async function speakRideUpdate(
  speed: number,
  power: number,
  distance: number,
  enabled: boolean
) {
  if (!enabled) return;
  const distKm = (distance / 1000).toFixed(1);
  await speak(`速度 ${Math.round(speed)} 公里，功率 ${power} 瓦，距離 ${distKm} 公里`, enabled);
}

export async function speakSupplyReminder(type: "calorie" | "water", enabled: boolean) {
  if (!enabled) return;
  const msg = type === "calorie"
    ? "補給提醒，請補充能量棒或食物"
    : "補給提醒，請補充水分";
  await speak(msg, enabled);
}

export async function speakAutoPause(enabled: boolean) {
  await speak("自動暫停", enabled);
}

export async function speakAutoResume(enabled: boolean) {
  await speak("繼續騎乘", enabled);
}

// ─── 通知設定 ─────────────────────────────────────────────────────────────────

export async function setupNotifications() {
  if (Platform.OS === "android") {
    try {
      // 設定本地通知頻道（禁止遠端推播）
      await Notifications.setNotificationChannelAsync("ride", {
        name: "騎乘通知",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00C896",
      });
      await Notifications.setNotificationChannelAsync("supply", {
        name: "補給提醒",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: "#FF9500",
      });
      await Notifications.setNotificationChannelAsync("friends", {
        name: "好友邀請",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 150, 300],
        lightColor: "#4ADE80",
      });
    } catch {}
  }
  
  // 禁止遠端推播初始化（本地通知專用）
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {}
}

export async function showFriendInviteNotification(senderName: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "👥 好友邀請",
        body: `${senderName} 向您發送了好友邀請`,
        sound: true,
        data: { type: "friend_invite" },
        ...(Platform.OS === "android" ? { channelId: "friends" } : {}),
      },
      trigger: null,
    });
  } catch {}
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function showSupplyNotification(type: "calorie" | "water") {
  const title = type === "calorie" ? "🍌 補給提醒" : "💧 補水提醒";
  const body = type === "calorie"
    ? "已消耗大量卡路里，請補充能量！"
    : "水分不足，請補充水分！";
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        badge: 1,
        categoryIdentifier: "SUPPLY_REMINDER",
      } as any,
      trigger: null,
    });
    // Android 特定設定（使用 Android 通知 API）
    if (Platform.OS === "android") {
      // 通知頻道已在 setupNotifications 中設定為 MAX 優先級
    }
  } catch {}
}

const RIDING_NOTIFICATION_ID = "bike-assistant-riding-status";

export async function showRidingNotification(
  speed: number,
  distance: number,
  elapsed: number
) {
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const timeStr = h > 0 ? `${h}時${m}分` : `${m}分`;
  try {
    // 先取消舊通知，再建立同 identifier 的新通知（保持通知欄只有一則）
    await Notifications.dismissNotificationAsync(RIDING_NOTIFICATION_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: RIDING_NOTIFICATION_ID,
      content: {
        title: "🚴 智慧單車騎乘助手",
        body: `速度 ${Math.round(speed)} km/h · 距離 ${(distance / 1000).toFixed(1)} km · 時間 ${timeStr}`,
        sticky: true,
        data: { type: "riding_status" },
      },
      trigger: null,
    });
  } catch {}
}

export async function cancelRidingNotification() {
  try {
    await Notifications.dismissNotificationAsync(RIDING_NOTIFICATION_ID).catch(() => {});
    await Notifications.dismissAllNotificationsAsync();
  } catch {}
}
