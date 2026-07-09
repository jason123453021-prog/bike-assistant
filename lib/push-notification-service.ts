import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationPayload {
  type: 'achievement' | 'buddy' | 'emergency' | 'weather' | 'training';
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface NotificationSettings {
  achievementsEnabled: boolean;
  buddyUpdatesEnabled: boolean;
  emergencyAlertsEnabled: boolean;
  weatherAlertsEnabled: boolean;
  trainingRemindersEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const NOTIFICATION_HISTORY_KEY = 'notification_history';

export class PushNotificationService {
  /**
   * 初始化推送通知
   */
  static async initialize(): Promise<void> {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      await this.requestPermissions();
      await this.initializeSettings();
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  /**
   * 請求通知權限
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * 發送成就通知
   */
  static async sendAchievementNotification(
    achievementName: string,
    achievementDescription: string
  ): Promise<void> {
    try {
      const settings = await this.getSettings();

      if (!settings.achievementsEnabled) return;

      await this.sendNotification({
        type: 'achievement',
        title: '🏆 新成就解鎖',
        body: `恭喜！你解鎖了「${achievementName}」成就`,
        data: {
          achievementName,
          achievementDescription,
        },
      });
    } catch (error) {
      console.error('Failed to send achievement notification:', error);
    }
  }

  /**
   * 發送隊友上線通知
   */
  static async sendBuddyOnlineNotification(buddyName: string): Promise<void> {
    try {
      const settings = await this.getSettings();

      if (!settings.buddyUpdatesEnabled) return;

      await this.sendNotification({
        type: 'buddy',
        title: '👥 隊友上線',
        body: `${buddyName} 現在開始騎乘，要一起去嗎？`,
        data: {
          buddyName,
        },
      });
    } catch (error) {
      console.error('Failed to send buddy notification:', error);
    }
  }

  /**
   * 發送緊急警報通知
   */
  static async sendEmergencyNotification(
    userName: string,
    emergencyType: string,
    location: string
  ): Promise<void> {
    try {
      const settings = await this.getSettings();

      if (!settings.emergencyAlertsEnabled) return;

      await this.sendNotification({
        type: 'emergency',
        title: '🚨 緊急警報',
        body: `${userName} 在 ${location} 遇到${emergencyType}，需要幫助！`,
        data: {
          userName,
          emergencyType,
          location,
        },
      });
    } catch (error) {
      console.error('Failed to send emergency notification:', error);
    }
  }

  /**
   * 發送天氣警告通知
   */
  static async sendWeatherAlertNotification(
    weatherType: string,
    severity: 'low' | 'medium' | 'high',
    recommendation: string
  ): Promise<void> {
    try {
      const settings = await this.getSettings();

      if (!settings.weatherAlertsEnabled) return;

      const icon = severity === 'high' ? '⚠️' : severity === 'medium' ? '⚡' : '☁️';

      await this.sendNotification({
        type: 'weather',
        title: `${icon} 天氣警告`,
        body: `${weatherType}。建議：${recommendation}`,
        data: {
          weatherType,
          severity,
          recommendation,
        },
      });
    } catch (error) {
      console.error('Failed to send weather alert notification:', error);
    }
  }

  /**
   * 發送訓練提醒通知
   */
  static async sendTrainingReminderNotification(
    trainingType: string,
    recommendedTime: string
  ): Promise<void> {
    try {
      const settings = await this.getSettings();

      if (!settings.trainingRemindersEnabled) return;

      await this.sendNotification({
        type: 'training',
        title: '🏋️ 訓練提醒',
        body: `現在是${recommendedTime}，推薦進行${trainingType}訓練`,
        data: {
          trainingType,
          recommendedTime,
        },
      });
    } catch (error) {
      console.error('Failed to send training reminder notification:', error);
    }
  }

  /**
   * 獲取通知設置
   */
  static async getSettings(): Promise<NotificationSettings> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      return data
        ? JSON.parse(data)
        : {
            achievementsEnabled: true,
            buddyUpdatesEnabled: true,
            emergencyAlertsEnabled: true,
            weatherAlertsEnabled: true,
            trainingRemindersEnabled: true,
            soundEnabled: true,
            vibrationEnabled: true,
          };
    } catch (error) {
      console.error('Failed to get notification settings:', error);
      return {
        achievementsEnabled: true,
        buddyUpdatesEnabled: true,
        emergencyAlertsEnabled: true,
        weatherAlertsEnabled: true,
        trainingRemindersEnabled: true,
        soundEnabled: true,
        vibrationEnabled: true,
      };
    }
  }

  /**
   * 更新通知設置
   */
  static async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated: NotificationSettings = { ...current, ...settings } as NotificationSettings;
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  }

  /**
   * 獲取通知歷史
   */
  static async getNotificationHistory(): Promise<NotificationPayload[]> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }

  /**
   * 清除通知歷史
   */
  static async clearNotificationHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear notification history:', error);
    }
  }

  /**
   * 發送通知
   */
  private static async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      const settings = await this.getSettings();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          sound: settings.soundEnabled ? 'default' : undefined,
          vibrate: settings.vibrationEnabled ? [0, 250, 250, 250] : [],
        },
        trigger: null,
      });

      await this.addToHistory(payload);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * 添加到歷史
   */
  private static async addToHistory(payload: NotificationPayload): Promise<void> {
    try {
      const history = await this.getNotificationHistory();

      const item = {
        ...payload,
        timestamp: Date.now(),
      };

      history.unshift(item);

      const limited = history.slice(0, 100);

      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(limited));
    } catch (error) {
      console.error('Failed to add to notification history:', error);
    }
  }

  /**
   * 初始化設置
   */
  private static async initializeSettings(): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);

      if (!existing) {
        const defaultSettings: NotificationSettings = {
          achievementsEnabled: true,
          buddyUpdatesEnabled: true,
          emergencyAlertsEnabled: true,
          weatherAlertsEnabled: true,
          trainingRemindersEnabled: true,
          soundEnabled: true,
          vibrationEnabled: true,
        };

        await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(defaultSettings));
      }
    } catch (error) {
      console.error('Failed to initialize notification settings:', error);
    }
  }
}
