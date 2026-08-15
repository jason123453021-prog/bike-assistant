/**
 * 回饋服務 — 震動、TTS 語音播報、通知
 *
 * 注意：expo-notifications 的遠端推播功能在 Expo Go SDK 53+ 已移除。
 * 本地通知（scheduleNotificationAsync）在 Expo Go 中仍可使用，
 * 但所有呼叫均加上 try-catch 以防止未預期的錯誤。
 */

import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Platform } from "react-native";
import { getLocalNotifications } from "@/lib/local-notifications";
import { configureSupplyNotificationActions, SUPPLY_NOTIFICATION_CATEGORY, type SupplyNotificationKind } from "@/lib/supply-notification-actions";
import type { SupplyPlan } from "@/lib/smart-supply-plan";

let rideSpeechSuppressed = false;

/** 系統通話或其他音訊中斷期間，暫停騎乘語音且不佇列或補播。 */
export function setRideSpeechSuppressed(suppressed: boolean) {
  rideSpeechSuppressed = suppressed;
}

export function isRideSpeechSuppressed(): boolean {
  return rideSpeechSuppressed;
}

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
  if (!enabled || rideSpeechSuppressed || Platform.OS === "web") return;
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

/**
 * 依目前智慧補給計畫組合可直接聽懂的提醒內容。這項計算完全在本機完成，
 * 因此不依賴網路或雲端語音服務。
 */
export function formatSmartSupplyReminder(type: "calorie" | "water", plan: SupplyPlan): string {
  const reason = plan.reason.trim() ? `。原因：${plan.reason}` : "";
  if (type === "calorie") {
    return `智慧補給提醒。建議補充 ${Math.round(plan.energyRecommendationKcal)} 大卡能量，約 ${Math.round(plan.carbohydrateRecommendationG)} 公克碳水${reason}`;
  }
  return `智慧補水提醒。建議補充 ${Math.round(plan.waterRecommendationMl)} 毫升水分${reason}`;
}

/** 在智慧補給模式下播報本輪的具體建議補給量與計算原因。 */
export async function speakSmartSupplyReminder(
  type: "calorie" | "water",
  plan: SupplyPlan,
  enabled: boolean,
) {
  if (!enabled) return;
  await speak(formatSmartSupplyReminder(type, plan), enabled);
}

export async function speakAutoPause(enabled: boolean) {
  await speak("自動暫停", enabled);
}

export async function speakAutoResume(enabled: boolean) {
  await speak("繼續騎乘", enabled);
}

// ─── 通知設定 ─────────────────────────────────────────────────────────────────

export async function setupNotifications() {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;

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
  await configureSupplyNotificationActions();
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return false;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export interface SupplyNotificationRecommendation {
  energyKcal?: number;
  carbohydrateG?: number;
  waterMl?: number;
  reason?: string;
}

const SMART_SUPPLY_NOTIFICATION_IDS = {
  calorie: "bike-assistant-smart-calorie-due",
  water: "bike-assistant-smart-water-due",
} as const;

/**
 * 將已計算的智慧倒數交給 Android 本機排程；鎖定／背景時系統通知是唯一可立即呈現的介面。
 * App 回到前景後，導航頁會依同一待確認狀態補顯示原生 Modal。
 */
export async function scheduleSmartSupplyDueNotification(type: "calorie" | "water", dueAtMs: number) {
  const Notifications = await getLocalNotifications();
  if (!Notifications || dueAtMs <= Date.now()) return;
  try {
    await configureSupplyNotificationActions();
    await Notifications.cancelScheduledNotificationAsync(SMART_SUPPLY_NOTIFICATION_IDS[type]).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: SMART_SUPPLY_NOTIFICATION_IDS[type],
      content: {
        title: type === "calorie" ? "補給提醒" : "補水提醒",
        body: type === "calorie" ? "請補給能量，完成後在 App 內確認。" : "請補給水分，完成後在 App 內確認。",
        sound: true,
        badge: 1,
        categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
        data: { type: "supply_reminder", supplyKind: type, smartCountdown: true },
        ...(Platform.OS === "android" ? { channelId: "supply" } : {}),
      } as any,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(dueAtMs),
      } as any,
    });
  } catch {}
}

/** 使用者確認補給或結束騎乘後，清除對應的未到期／已呈現系統提醒。 */
export async function clearSmartSupplyDueNotification(type: "calorie" | "water") {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;
  const identifier = SMART_SUPPLY_NOTIFICATION_IDS[type];
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
    await Notifications.dismissNotificationAsync(identifier).catch(() => {});
  } catch {}
}

export async function showSupplyNotification(
  type: SupplyNotificationKind,
  recommendation?: SupplyNotificationRecommendation,
) {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;

  const title = type === "calorie" ? "🍌 補給提醒" : type === "water" ? "💧 補水提醒" : "補給提醒";
  const body = type === "calorie"
    ? recommendation?.energyKcal
      ? `建議補充約 ${recommendation.energyKcal} kcal${recommendation.carbohydrateG ? `（${recommendation.carbohydrateG} g 碳水）` : ""}${recommendation.reason ? `；${recommendation.reason}` : ""}`
      : "已消耗大量卡路里，請補充能量！"
    : type === "water"
      ? recommendation?.waterMl
        ? `建議補充約 ${recommendation.waterMl} ml 水分${recommendation.reason ? `；${recommendation.reason}` : ""}`
        : "水分不足，請補充水分！"
      : "已達自訂補給間隔，請依騎乘狀況補充能量與水分。";
  try {
    await configureSupplyNotificationActions();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        badge: 1,
        categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
        data: { type: "supply_reminder", supplyKind: type },
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
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;

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
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;

  try {
    await Notifications.dismissNotificationAsync(RIDING_NOTIFICATION_ID).catch(() => {});
    await Notifications.dismissAllNotificationsAsync();
  } catch {}
}
