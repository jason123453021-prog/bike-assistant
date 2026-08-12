import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NotificationType =
  | 'ride_reminder'
  | 'turn_instruction'
  | 'achievement'
  | 'friend_request'
  | 'route_comment'
  | 'warning';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
}

/**
 * 推送通知管理器
 * 用於管理本地和遠程推送通知
 */
export class PushNotificationManager {
  /**
   * 初始化通知系統
   */
  static async initialize(): Promise<void> {
    try {
      console.log('[PushNotification] 初始化本機通知系統...');

      // Expo Go SDK 53+ 不支援 Android 遠端推播；關閉自動 token 註冊，
      // 但保留 scheduleNotificationAsync 所需的本機通知能力。
      try {
        await Notifications.setAutoServerRegistrationEnabledAsync(false);
      } catch {
        // 舊版 Expo Go 沒有此方法時，仍可使用本機通知。
      }

      // 設定通知處理器
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // 請求通知權限
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        console.log('[PushNotification] 通知權限狀態:', status);
      }

      console.log('[PushNotification] 本機通知初始化完成');
    } catch (error) {
      console.error('[PushNotification] 初始化失敗:', error);
    }
  }

  /**
   * 發送本地通知
   */
  static async sendLocalNotification(
    payload: NotificationPayload,
    delayInSeconds: number = 0
  ): Promise<string | null> {
    try {
      console.log('[PushNotification] 發送本地通知:', payload);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: {
            type: payload.type,
            ...payload.data,
          },
          sound: payload.sound || 'default',
          badge: payload.badge || 1,
        },
        trigger: {
          type: 'timeInterval',
          seconds: Math.max(delayInSeconds, 1),
        } as any,
      });

      console.log('[PushNotification] 通知已發送，ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('[PushNotification] 發送本地通知失敗:', error);
      return null;
    }
  }

  /**
   * 發送騎乘提醒通知
   */
  static async sendRideReminderNotification(
    message: string,
    delayInSeconds: number = 0
  ): Promise<string | null> {
    return this.sendLocalNotification(
      {
        type: 'ride_reminder',
        title: '🚴 騎乘提醒',
        body: message,
        sound: 'default',
      },
      delayInSeconds
    );
  }

  /**
   * 發送轉向指令通知
   */
  static async sendTurnInstructionNotification(
    instruction: string,
    delayInSeconds: number = 0
  ): Promise<string | null> {
    return this.sendLocalNotification(
      {
        type: 'turn_instruction',
        title: '🗺️ 轉向指令',
        body: instruction,
        sound: 'default',
      },
      delayInSeconds
    );
  }

  /**
   * 發送成就通知
   */
  static async sendAchievementNotification(
    achievement: string,
    delayInSeconds: number = 0
  ): Promise<string | null> {
    return this.sendLocalNotification(
      {
        type: 'achievement',
        title: '🏆 成就解鎖',
        body: achievement,
        sound: 'default',
        badge: 1,
      },
      delayInSeconds
    );
  }

  /**
   * 發送好友請求通知
   */
  static async sendFriendRequestNotification(
    friendName: string,
    delayInSeconds: number = 0
  ): Promise<string | null> {
    return this.sendLocalNotification(
      {
        type: 'friend_request',
        title: '👥 好友請求',
        body: `${friendName} 想要加您為好友`,
        sound: 'default',
        badge: 1,
      },
      delayInSeconds
    );
  }

  /**
   * 發送路線評論通知
   */
  static async sendRouteCommentNotification(
    userName: string,
    comment: string,
    delayInSeconds: number = 0
  ): Promise<string | null> {
    return this.sendLocalNotification(
      {
        type: 'route_comment',
        title: '💬 路線評論',
        body: `${userName}: ${comment}`,
        sound: 'default',
        badge: 1,
      },
      delayInSeconds
    );
  }

  /**
   * 發送警告通知
   */
  static async sendWarningNotification(
    warning: string,
    delayInSeconds: number = 0
  ): Promise<string | null> {
    return this.sendLocalNotification(
      {
        type: 'warning',
        title: '⚠️ 警告',
        body: warning,
        sound: 'default',
        badge: 1,
      },
      delayInSeconds
    );
  }

  /**
   * 取消通知
   */
  static async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('[PushNotification] 已取消通知:', notificationId);
    } catch (error) {
      console.error('[PushNotification] 取消通知失敗:', error);
    }
  }

  /**
   * 取消所有通知
   */
  static async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[PushNotification] 已取消所有通知');
    } catch (error) {
      console.error('[PushNotification] 取消所有通知失敗:', error);
    }
  }

  /**
   * 獲取所有待發送的通知
   */
  static async getAllScheduledNotifications(): Promise<
    Notifications.NotificationRequest[]
  > {
    try {
      const notifications =
        await Notifications.getAllScheduledNotificationsAsync();
      console.log('[PushNotification] 待發送通知數:', notifications.length);
      return notifications;
    } catch (error) {
      console.error('[PushNotification] 獲取待發送通知失敗:', error);
      return [];
    }
  }

  /**
   * 設定通知響應監聽
   */
  static addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): () => void {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(callback);

    return () => {
      subscription.remove();
    };
  }

  /**
   * 設定通知接收監聽
   */
  static addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): () => void {
    const subscription =
      Notifications.addNotificationReceivedListener(callback);

    return () => {
      subscription.remove();
    };
  }
}

/**
 * 獲取單例實例
 */
export function getPushNotificationManager(): typeof PushNotificationManager {
  return PushNotificationManager;
}
