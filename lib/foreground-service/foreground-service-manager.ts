import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { getLocalNotifications } from "@/lib/local-notifications";

export class ForegroundServiceManager {
  private static instance: ForegroundServiceManager;
  private isRunning: boolean = false;
  private notificationId: string | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;

  private constructor() {}

  static getInstance(): ForegroundServiceManager {
    if (!ForegroundServiceManager.instance) {
      ForegroundServiceManager.instance = new ForegroundServiceManager();
    }
    return ForegroundServiceManager.instance;
  }

  /**
   * 啟動前台服務與常駐即時騎乘狀態通知，並開始高精度背景 GPS 定位
   */
  async startForegroundService(
    onLocationUpdate?: (location: Location.LocationObject) => void
  ): Promise<boolean> {
    if (this.isRunning) {
      console.log('[ForegroundService] Already running');
      return true;
    }

    try {
      const Notifications = await getLocalNotifications();

      if (Platform.OS === 'android') {
        // 請求前景與背景定位權限
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          console.error('[ForegroundService] Foreground location permission denied');
          return false;
        }

        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          console.warn('[ForegroundService] Background location permission denied, but continuing with foreground tracking');
        }

        // 確保通知權限
        if (Notifications) {
          const { status: notifStatus } = await Notifications.requestPermissionsAsync();
          if (notifStatus !== 'granted') {
            console.warn('[ForegroundService] Notification permission denied');
          }
        }
      }

      // 發送常駐騎乘狀態通知
      if (Notifications) {
        this.notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚴 智慧單車騎乘中',
            body: 'GPS 正在背景持續紀錄軌跡與數據，保障行程不中斷。',
            sticky: true,
            autoDismiss: false,
            sound: false,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });
      }

      // 開始高精度背景 GPS 定位監聽
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000, // 每 3 秒更新一次
          distanceInterval: 3, // 每移動 3 公尺更新一次
        },
        (location) => {
          if (onLocationUpdate) {
            onLocationUpdate(location);
          }
        }
      );

      this.isRunning = true;
      console.log('[ForegroundService] Started successfully');
      return true;
    } catch (error) {
      console.error('[ForegroundService] Failed to start:', error);
      return false;
    }
  }

  /**
   * 停止前台服務與 GPS 定位監聽，並清除常駐通知
   */
  async stopForegroundService(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const Notifications = await getLocalNotifications();

      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      if (Notifications && this.notificationId) {
        await Notifications.dismissNotificationAsync(this.notificationId);
        this.notificationId = null;
      }

      // 取消所有常駐推播
      if (Notifications) {
        await Notifications.dismissAllNotificationsAsync();
      }

      this.isRunning = false;
      console.log('[ForegroundService] Stopped successfully');
    } catch (error) {
      console.error('[ForegroundService] Error stopping service:', error);
    }
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const foregroundServiceManager = ForegroundServiceManager.getInstance();
