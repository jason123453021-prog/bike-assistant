import { useEffect, useRef } from 'react';
import type * as Notifications from 'expo-notifications';
import { PushNotificationManager } from '@/lib/push-notification-manager';

export interface UsePushNotificationOptions {
  onNotificationReceived?: (notification: Notifications.Notification) => void;
  onNotificationResponse?: (
    response: Notifications.NotificationResponse
  ) => void;
}

/**
 * 推送通知 Hook
 * 用於在 React 組件中集成推送通知功能
 */
export function usePushNotification(options: UsePushNotificationOptions = {}) {
  const { onNotificationReceived, onNotificationResponse } = options;
  const unsubscribeRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    // 初始化通知系統
    PushNotificationManager.initialize();

    // 設定通知接收監聽
    if (onNotificationReceived) {
      const unsubscribe = PushNotificationManager.addNotificationReceivedListener(
        onNotificationReceived
      );
      unsubscribeRef.current.push(unsubscribe);
    }

    // 設定通知響應監聽
    if (onNotificationResponse) {
      const unsubscribe = PushNotificationManager.addNotificationResponseListener(
        onNotificationResponse
      );
      unsubscribeRef.current.push(unsubscribe);
    }

    // 清理函數
    return () => {
      unsubscribeRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribeRef.current = [];
    };
  }, [onNotificationReceived, onNotificationResponse]);

  return {
    sendRideReminder: PushNotificationManager.sendRideReminderNotification,
    sendTurnInstruction:
      PushNotificationManager.sendTurnInstructionNotification,
    sendAchievement: PushNotificationManager.sendAchievementNotification,
    sendFriendRequest: PushNotificationManager.sendFriendRequestNotification,
    sendRouteComment: PushNotificationManager.sendRouteCommentNotification,
    sendWarning: PushNotificationManager.sendWarningNotification,
    cancelNotification: PushNotificationManager.cancelNotification,
    cancelAllNotifications: PushNotificationManager.cancelAllNotifications,
    getAllScheduledNotifications:
      PushNotificationManager.getAllScheduledNotifications,
  };
}

/**
 * 簡化版本：僅發送騎乘提醒
 */
export function useSendRideReminder() {
  return PushNotificationManager.sendRideReminderNotification;
}

/**
 * 簡化版本：僅發送轉向指令
 */
export function useSendTurnInstruction() {
  return PushNotificationManager.sendTurnInstructionNotification;
}

/**
 * 簡化版本：僅發送成就通知
 */
export function useSendAchievement() {
  return PushNotificationManager.sendAchievementNotification;
}
