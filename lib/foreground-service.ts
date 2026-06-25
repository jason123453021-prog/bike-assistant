/**
 * Foreground Service 模組 (Foreground Service Module)
 * 
 * 用於 Android 後台位置追蹤和騎乘記錄
 * 確保應用程式在後台時能持續接收位置更新
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

const LOCATION_TASK_NAME = 'bike-assistant-location-tracking';

export interface ForegroundServiceConfig {
  accuracy?: Location.Accuracy;
  timeInterval?: number;           // ms
  distanceInterval?: number;       // meters
  showsBackgroundLocationIndicator?: boolean;
}

export class ForegroundServiceManager {
  private static isStarted = false;
  private static config: ForegroundServiceConfig;

  /**
   * 初始化 Foreground Service
   */
  static async initialize(config: ForegroundServiceConfig = {}) {
    if (Platform.OS !== 'android') {
      console.warn('ForegroundService: Only supported on Android');
      return;
    }

    this.config = {
      accuracy: Location.Accuracy.High,
      timeInterval: 1000,           // 1 second
      distanceInterval: 5,          // 5 meters
      showsBackgroundLocationIndicator: true,
      ...config,
    };

    // 定義後台位置追蹤任務
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.error('Location tracking error:', error);
        return;
      }

      if (data) {
        const { locations } = data as any;
        if (locations && locations.length > 0) {
          const location = locations[locations.length - 1];
          
          // 觸發位置更新回調
          await this.onLocationUpdate(location);
        }
      }
    });
  }

  /**
   * 啟動後台位置追蹤
   */
  static async startLocationTracking(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('ForegroundService: Only supported on Android');
      return false;
    }

    try {
      // 請求位置權限
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission denied');
        return false;
      }

      // 請求後台位置權限
      const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus.status !== 'granted') {
        console.warn('Background location permission denied');
        // 繼續執行，但功能受限
      }

      // 啟動後台位置追蹤任務
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: this.config.accuracy,
        timeInterval: this.config.timeInterval,
        distanceInterval: this.config.distanceInterval,
        showsBackgroundLocationIndicator: this.config.showsBackgroundLocationIndicator,
      } as any);

      // 注意：Foreground Service 通知需要在 app.config.ts 中配置

      this.isStarted = true;
      console.log('Location tracking started');
      return true;
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      return false;
    }
  }

  /**
   * 停止後台位置追蹤
   */
  static async stopLocationTracking(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('ForegroundService: Only supported on Android');
      return false;
    }

    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTracking) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        this.isStarted = false;
        console.log('Location tracking stopped');
      }
      return true;
    } catch (error) {
      console.error('Failed to stop location tracking:', error);
      return false;
    }
  }

  /**
   * 檢查位置追蹤是否已啟動
   */
  static isLocationTrackingActive(): boolean {
    return this.isStarted;
  }

  /**
   * 位置更新回調 - 由應用程式實現
   */
  private static async onLocationUpdate(location: Location.LocationObject): Promise<void> {
    // 此方法應由應用程式實現
    // 用於處理位置更新事件
    console.log('Location update:', location.coords);
  }

  /**
   * 設定位置更新回調
   */
  static setLocationUpdateCallback(callback: (location: Location.LocationObject) => void): void {
    // 重新定義任務以使用自訂回調
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.error('Location tracking error:', error);
        return;
      }

      if (data) {
        const { locations } = data as any;
        if (locations && locations.length > 0) {
          const location = locations[locations.length - 1];
          callback(location);
        }
      }
    });
  }

  /**
   * 獲取當前位置
   */
  static async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: this.config.accuracy,
      });
      return location;
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }

  /**
   * 重置配置
   */
  static reset(): void {
    this.isStarted = false;
    this.config = {};
  }
}

/**
 * 使用示例：
 * 
 * // 初始化
 * await ForegroundServiceManager.initialize({
 *   accuracy: Location.Accuracy.High,
 *   timeInterval: 1000,
 *   distanceInterval: 5,
 * });
 * 
 * // 啟動位置追蹤
 * const started = await ForegroundServiceManager.startLocationTracking();
 * 
 * // 設定位置更新回調
 * ForegroundServiceManager.setLocationUpdateCallback((location) => {
 *   console.log('New location:', location.coords);
 *   // 更新地圖、騎乘數據等
 * });
 * 
 * // 停止位置追蹤
 * await ForegroundServiceManager.stopLocationTracking();
 */
