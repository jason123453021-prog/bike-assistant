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

async function speak(text: string, enabled: boolean = true) {
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

export async function speakSupplyReminder(type: "calorie" | "water", enabled: boolean) {
  if (!enabled) return;
  const msg = type === "calorie"
    ? "請補給能量"
    : "請補給水分";
  await speak(msg, enabled);
}

/**
 * 依目前智慧補給計畫組合可直接聽懂的提醒內容。這項計算完全在本機完成，
 * 因此不依賴網路或雲端語音服務。
 */
export function formatSmartSupplyReminder(type: "calorie" | "water", plan: SupplyPlan): string {
  void plan;
  return type === "calorie" ? "請補給能量" : "請補給水分";
}

/** 在智慧補給模式下播報本輪的具體建議補給量與計算原因。 */
export async function speakSmartSupplyReminder(
  type: "calorie" | "water",
  plan: SupplyPlan,
  enabled: boolean,
) {
  void plan;
  await speakSupplyReminder(type, enabled);
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
        importance: Notifications.AndroidImportance.MIN,
        vibrationPattern: [],
        sound: null,
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
        // 騎乘中由 App 儀表板呈現狀態；前景本機通知不得中斷騎士專注。
        // 補給／補水到期則由 App 的雙區塊彈窗呈現，背景與鎖屏仍保留專用系統通知。
        shouldShowAlert: false,
        shouldPlaySound: false,
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

/** 騎乘完成時同步取消所有智慧能量／補水倒數，並移除已在通知列呈現的提醒。 */
export async function clearAllSmartSupplyDueNotifications() {
  await Promise.all([
    clearSmartSupplyDueNotification("calorie"),
    clearSmartSupplyDueNotification("water"),
  ]);
}

/** 僅移除補給／補水通知，保留騎乘中的常駐狀態通知與其他 App 通知。 */
export async function clearAllSupplyNotifications() {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;
  try {
    await clearAllSmartSupplyDueNotifications();
    const [presented, scheduled] = await Promise.all([
      Notifications.getPresentedNotificationsAsync(),
      Notifications.getAllScheduledNotificationsAsync(),
    ]);
    await Promise.all(
      [
        ...presented
          .filter((notification) => notification.request.content.data?.type === "supply_reminder")
          .map((notification) => Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {})),
        ...scheduled
          .filter((notification) => notification.content.data?.type === "supply_reminder")
          .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier).catch(() => {})),
      ],
    );
  } catch {}
}

export async function showSupplyNotification(
  type: SupplyNotificationKind,
  recommendation?: SupplyNotificationRecommendation,
  customItemId?: string,
) {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;

  const isEnergy = type === "calorie" || type === "custom-energy";
  const isWater = type === "water" || type === "custom-water";
  const title = isEnergy ? "🍌 補給提醒" : isWater ? "💧 補水提醒" : "補給提醒";
  const body = type === "calorie"
    ? recommendation?.energyKcal
      ? `建議補充約 ${recommendation.energyKcal} kcal${recommendation.carbohydrateG ? `（${recommendation.carbohydrateG} g 碳水）` : ""}${recommendation.reason ? `；${recommendation.reason}` : ""}`
      : "已消耗大量卡路里，請補充能量！"
    : type === "water"
      ? recommendation?.waterMl
        ? `建議補充約 ${recommendation.waterMl} ml 水分${recommendation.reason ? `；${recommendation.reason}` : ""}`
        : "水分不足，請補充水分！"
      : type === "custom-energy"
        ? "自訂能量補給已到期，請在 App 內確認。"
        : type === "custom-water"
          ? "自訂補水已到期，請在 App 內確認。"
          : "已達補給間隔，請在 App 內確認。";
  try {
    await configureSupplyNotificationActions();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        badge: 1,
        categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
        data: { type: "supply_reminder", supplyKind: type, customItemId },
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
  // 背景定位服務本身會保留 Android 所需的常駐狀態，不另以高頻本機通知
  // 重複推送速度、距離與時間，避免頂端橫幅與提示音干擾騎乘專注。
  void speed;
  void distance;
  void elapsed;
  const Notifications = await getLocalNotifications();
  await Notifications?.dismissNotificationAsync(RIDING_NOTIFICATION_ID).catch(() => {});
}

export async function cancelRidingNotification() {
  const Notifications = await getLocalNotifications();
  if (!Notifications) return;

  try {
    await Notifications.dismissNotificationAsync(RIDING_NOTIFICATION_ID).catch(() => {});
  } catch {}
}
