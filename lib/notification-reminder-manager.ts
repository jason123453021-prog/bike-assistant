import * as Notifications from 'expo-notifications';
import { LocalStorageManager } from './local-storage-manager';

/**
 * 應用內通知和提醒管理器
 */
export class NotificationReminderManager {
  /**
   * 初始化通知
   */
  static async initialize() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('通知權限被拒絕');
        return false;
      }

      // 設置通知處理器
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  /**
   * 發送本地通知
   */
  static async sendLocalNotification(
    title: string,
    body: string,
    delay: number = 0,
    data?: any
  ) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          badge: 1,
        },
        trigger: delay > 0 ? ({ type: 'time' as const, seconds: delay } as any) : null,
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * 設置騎乘提醒
   */
  static async setRideReminder(time: string, daysOfWeek: number[]) {
    const [hours, minutes] = time.split(':').map(Number);

    for (const day of daysOfWeek) {
      const trigger = {
        type: 'calendar' as const,
        weekday: day,
        hour: hours,
        minute: minutes,
        repeats: true,
      } as any;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '騎乘提醒',
            body: '是時候出門騎乘了！',
            data: { type: 'ride_reminder' },
          },
          trigger,
        });
      } catch (error) {
        console.error('Failed to set ride reminder:', error);
      }
    }

    // 保存提醒設置
    const settings = await LocalStorageManager.getUserSettings();
    await LocalStorageManager.saveUserSettings({
      ...settings,
      rideReminder: { time, daysOfWeek },
    });
  }

  /**
   * 設置訓練提醒
   */
  static async setTrainingReminder(trainingId: string, time: string) {
    const [hours, minutes] = time.split(':').map(Number);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '訓練提醒',
          body: '開始今天的訓練課程',
          data: { type: 'training_reminder', trainingId },
        },
        trigger: {
          type: 'calendar' as const,
          hour: hours,
          minute: minutes,
          repeats: true,
        } as any,
      });
    } catch (error) {
      console.error('Failed to set training reminder:', error);
    }
  }

  /**
   * 設置成就通知
   */
  static async sendAchievementNotification(achievement: string, description: string) {
    await this.sendLocalNotification(
      '🏆 成就解鎖',
      `${achievement}: ${description}`,
      0,
      { type: 'achievement', achievement }
    );
  }

  /**
   * 設置隊友通知
   */
  static async sendBuddyNotification(buddyName: string, action: string) {
    await this.sendLocalNotification(
      '👥 隊友提醒',
      `${buddyName} ${action}`,
      0,
      { type: 'buddy', buddyName, action }
    );
  }

  /**
   * 設置天氣警告
   */
  static async sendWeatherWarning(warning: string, severity: 'low' | 'medium' | 'high') {
    const icon = severity === 'high' ? '⚠️' : severity === 'medium' ? '⚡' : '☁️';

    await this.sendLocalNotification(
      `${icon} 天氣警告`,
      warning,
      0,
      { type: 'weather_warning', severity }
    );
  }

  /**
   * 設置挑戰進度通知
   */
  static async sendChallengeProgressNotification(
    challengeName: string,
    progress: number,
    target: number
  ) {
    const percentage = Math.round((progress / target) * 100);

    await this.sendLocalNotification(
      '🎯 挑戰進度',
      `${challengeName}: ${percentage}% 完成`,
      0,
      { type: 'challenge_progress', challengeName, progress, target }
    );
  }

  /**
   * 設置每日統計通知
   */
  static async sendDailyStatisticsNotification(stats: any) {
    await this.sendLocalNotification(
      '📊 每日統計',
      `今天騎乘 ${stats.distance} km，用時 ${stats.duration} 分鐘`,
      0,
      { type: 'daily_stats', stats }
    );
  }

  /**
   * 設置提醒設置
   */
  static async setReminderPreferences(preferences: any) {
    const settings = await LocalStorageManager.getUserSettings();

    await LocalStorageManager.saveUserSettings({
      ...settings,
      reminderPreferences: {
        ...preferences,
      },
    });
  }

  /**
   * 獲取提醒設置
   */
  static async getReminderPreferences() {
    const settings = await LocalStorageManager.getUserSettings();

    return settings?.reminderPreferences || {
      rideReminders: true,
      trainingReminders: true,
      achievementNotifications: true,
      buddyNotifications: true,
      weatherWarnings: true,
      dailyStatistics: true,
    };
  }

  /**
   * 取消所有通知
   */
  static async cancelAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  /**
   * 獲取待處理通知
   */
  static async getPendingNotifications() {
    try {
      return await Notifications.getPresentedNotificationsAsync();
    } catch (error) {
      console.error('Failed to get pending notifications:', error);
      return [];
    }
  }
}
