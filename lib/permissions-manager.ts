import * as Location from 'expo-location';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import { getLocalNotifications, isExpoGoRuntime } from '@/lib/local-notifications';

const PERMISSIONS_ONBOARDING_KEY = 'permissions_onboarding_completed';

export type PermissionType = 
  | 'location'
  | 'notification'
  | 'battery_optimization';

export interface PermissionStatus {
  type: PermissionType;
  name: string;
  description: string;
  granted: boolean;
  required: boolean;
  systemSettingsUrl?: string;
}

export class PermissionsManager {
  static async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(PERMISSIONS_ONBOARDING_KEY);
      return completed === 'true';
    } catch {
      return false;
    }
  }

  static async markOnboardingCompleted(): Promise<void> {
    try {
      await AsyncStorage.setItem(PERMISSIONS_ONBOARDING_KEY, 'true');
    } catch (error) {
      console.error('[PermissionsManager] Failed to mark onboarding completed:', error);
    }
  }

  static async getAllPermissionStatuses(): Promise<PermissionStatus[]> {
    const statuses: PermissionStatus[] = [];

    const locationStatus = await this.checkLocationPermission();
    statuses.push(locationStatus);

    const notificationStatus = await this.checkNotificationPermission();
    statuses.push(notificationStatus);

    if (Platform.OS === 'android') {
      const batteryStatus = await this.checkBatteryOptimizationWhitelist();
      statuses.push(batteryStatus);
    }

    return statuses;
  }

  static async checkLocationPermission(): Promise<PermissionStatus> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();
      
      const granted = status === 'granted' && backgroundStatus.status === 'granted';
      
      return {
        type: 'location',
        name: '位置權限',
        description: '允許 App 在背景記錄您的騎乘軌跡',
        granted,
        required: true,
        systemSettingsUrl: this.getLocationSettingsUrl(),
      };
    } catch (error) {
      console.error('[PermissionsManager] Error checking location permission:', error);
      return {
        type: 'location',
        name: '位置權限',
        description: '允許 App 在背景記錄您的騎乘軌跡',
        granted: false,
        required: true,
      };
    }
  }

  static async checkNotificationPermission(): Promise<PermissionStatus> {
    const Notifications = await getLocalNotifications();
    if (!Notifications) {
      return {
        type: 'notification',
        name: '通知權限',
        description: isExpoGoRuntime()
          ? 'Expo Go 使用畫面、語音與震動提醒；安裝版可啟用本機通知'
          : '此裝置暫時無法使用本機通知',
        granted: false,
        required: !isExpoGoRuntime(),
      };
    }

    try {
      const settings = await Notifications.getPermissionsAsync();
      
      return {
        type: 'notification',
        name: '通知權限',
        description: '允許 App 發送導航提示與補給提醒通知',
        granted: settings.granted,
        required: true,
        systemSettingsUrl: this.getNotificationSettingsUrl(),
      };
    } catch (error) {
      console.error('[PermissionsManager] Error checking notification permission:', error);
      return {
        type: 'notification',
        name: '通知權限',
        description: '允許 App 發送導航提示與補給提醒通知',
        granted: false,
        required: true,
      };
    }
  }

  static async checkBatteryOptimizationWhitelist(): Promise<PermissionStatus> {
    return {
      type: 'battery_optimization',
      name: '電池不受限制',
      description: '在系統頁將本 App 設為「不受限制」，降低省電機制中斷背景騎乘的機率',
      granted: false,
      required: true,
      systemSettingsUrl: IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
    };
  }

  static async requestLocationPermission(): Promise<boolean> {
    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== 'granted') {
        return false;
      }

      const background = await Location.requestBackgroundPermissionsAsync();
      return background.status === 'granted';
    } catch (error) {
      console.error('[PermissionsManager] Error requesting location permission:', error);
      return false;
    }
  }

  static async requestNotificationPermission(): Promise<boolean> {
    const Notifications = await getLocalNotifications();
    if (!Notifications) return false;

    try {
      const settings = await Notifications.requestPermissionsAsync();
      return settings.granted;
    } catch (error) {
      console.error('[PermissionsManager] Error requesting notification permission:', error);
      return false;
    }
  }

  static async openSystemSettings(permissionType: PermissionType): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        const { Linking } = await import('react-native');
        await Linking.openSettings();
      } else if (Platform.OS === 'android') {
        const packageName = Constants.expoConfig?.android?.package;
        
        switch (permissionType) {
          case 'location':
            await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
              data: packageName ? `package:${packageName}` : undefined,
            });
            break;
          case 'notification':
            await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
              extra: packageName ? { 'android.provider.extra.APP_PACKAGE': packageName } : undefined,
            });
            break;
          case 'battery_optimization':
            await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            break;
        }
      }
    } catch (error) {
      console.error('[PermissionsManager] Error opening system settings:', error);
      Alert.alert('錯誤', '無法打開系統設定，請手動進入設定頁面');
    }
  }

  private static getLocationSettingsUrl(): string {
    if (Platform.OS === 'ios') {
      return 'app-settings:';
    } else {
      return 'android.settings.LOCATION_SOURCE_SETTINGS';
    }
  }

  private static getNotificationSettingsUrl(): string {
    if (Platform.OS === 'ios') {
      return 'app-settings:';
    } else {
      return 'android.settings.APP_NOTIFICATION_SETTINGS';
    }
  }
}
