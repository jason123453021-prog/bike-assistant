import * as Location from 'expo-location';
import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const PERMISSIONS_ONBOARDING_KEY = 'permissions_onboarding_completed';

export type PermissionType = 
  | 'location'
  | 'notification'
  | 'overlay'
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
      const overlayStatus = await this.checkOverlayPermission();
      statuses.push(overlayStatus);

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

  static async checkOverlayPermission(): Promise<PermissionStatus> {
    return {
      type: 'overlay',
      name: '懸浮窗權限',
      description: '允許 App 在鎖屏時顯示補給提醒彈窗',
      granted: false,
      required: true,
      systemSettingsUrl: 'android.settings.action.MANAGE_OVERLAY_PERMISSION',
    };
  }

  static async checkBatteryOptimizationWhitelist(): Promise<PermissionStatus> {
    return {
      type: 'battery_optimization',
      name: '電池最佳化白名單',
      description: '防止系統因省電機制關閉 App 背景進程',
      granted: false,
      required: true,
      systemSettingsUrl: 'android.settings.ACTION_BATTERY_SAVER_SETTINGS',
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
        Linking.openURL('app-settings:');
      } else if (Platform.OS === 'android') {
        const packageName = 'com.jason123453021.bikeassistant';
        
        switch (permissionType) {
          case 'location':
          case 'notification':
            Linking.openURL(`package:${packageName}`);
            break;
          case 'overlay':
            Linking.openURL('android.settings.action.MANAGE_OVERLAY_PERMISSION');
            break;
          case 'battery_optimization':
            Linking.openURL('android.settings.ACTION_BATTERY_SAVER_SETTINGS');
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
