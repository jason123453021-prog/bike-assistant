/**
 * 前台服務管理模組
 * 用於 Android 前台服務，確保 App 在背景持續獲取 GPS 定位
 */

import { NativeModules, Platform } from 'react-native';

const { ForegroundServiceModule } = NativeModules;

export interface ForegroundServiceConfig {
  channelId: string;
  channelName: string;
  notificationId: number;
  notificationTitle: string;
  notificationBody: string;
  smallIcon: string;
  largeIcon?: string;
  priority: 'high' | 'default' | 'low';
  ongoingNotification: boolean;
}

export interface ServiceState {
  isRunning: boolean;
  startTime: number | null;
  lastUpdate: number | null;
  gpsUpdates: number;
  batteryUsage: number;
}

/**
 * 前台服務管理器
 */
export class ForegroundServiceManager {
  private config: ForegroundServiceConfig;
  private state: ServiceState;
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<ForegroundServiceConfig> = {}) {
    this.config = {
      channelId: 'bike_assistant_channel',
      channelName: '智慧單車騎乘助手',
      notificationId: 1,
      notificationTitle: '騎乘中',
      notificationBody: '正在記錄您的騎乘數據...',
      smallIcon: 'ic_notification',
      priority: 'high',
      ongoingNotification: true,
      ...config,
    };

    this.state = {
      isRunning: false,
      startTime: null,
      lastUpdate: null,
      gpsUpdates: 0,
      batteryUsage: 0,
    };
  }

  /**
   * 啟動前台服務
   */
  async startService(): Promise<boolean> {
    if (!Platform.OS.includes('android')) {
      console.warn('[ForegroundService] Service only available on Android');
      return false;
    }

    if (this.state.isRunning) {
      console.warn('[ForegroundService] Service already running');
      return true;
    }

    try {
      if (!ForegroundServiceModule) {
        console.error('[ForegroundService] Native module not available');
        return false;
      }

      const result = await ForegroundServiceModule.startService({
        channelId: this.config.channelId,
        channelName: this.config.channelName,
        notificationId: this.config.notificationId,
        notificationTitle: this.config.notificationTitle,
        notificationBody: this.config.notificationBody,
        smallIcon: this.config.smallIcon,
        largeIcon: this.config.largeIcon,
        priority: this.config.priority,
        ongoingNotification: this.config.ongoingNotification,
      });

      if (result) {
        this.state.isRunning = true;
        this.state.startTime = Date.now();
        console.log('[ForegroundService] Service started successfully');
        this.startStateMonitoring();
        return true;
      }

      return false;
    } catch (error) {
      console.error('[ForegroundService] Error starting service:', error);
      return false;
    }
  }

  /**
   * 停止前台服務
   */
  async stopService(): Promise<boolean> {
    if (!this.state.isRunning) {
      console.warn('[ForegroundService] Service not running');
      return true;
    }

    try {
      if (!ForegroundServiceModule) {
        console.error('[ForegroundService] Native module not available');
        return false;
      }

      const result = await ForegroundServiceModule.stopService();

      if (result) {
        this.state.isRunning = false;
        this.stopStateMonitoring();
        console.log('[ForegroundService] Service stopped successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[ForegroundService] Error stopping service:', error);
      return false;
    }
  }

  /**
   * 更新通知內容
   */
  async updateNotification(title: string, body: string): Promise<boolean> {
    if (!this.state.isRunning) {
      return false;
    }

    try {
      if (!ForegroundServiceModule) {
        return false;
      }

      const result = await ForegroundServiceModule.updateNotification({
        notificationId: this.config.notificationId,
        title,
        body,
      });

      if (result) {
        this.config.notificationTitle = title;
        this.config.notificationBody = body;
        this.state.lastUpdate = Date.now();
      }

      return result;
    } catch (error) {
      console.error('[ForegroundService] Error updating notification:', error);
      return false;
    }
  }

  /**
   * 記錄 GPS 更新
   */
  recordGPSUpdate(): void {
    this.state.gpsUpdates++;
    this.state.lastUpdate = Date.now();
  }

  /**
   * 獲取服務狀態
   */
  getState(): ServiceState {
    return { ...this.state };
  }

  /**
   * 獲取運行時間（秒）
   */
  getRunningDuration(): number {
    if (!this.state.startTime) return 0;
    return (Date.now() - this.state.startTime) / 1000;
  }

  /**
   * 獲取 GPS 更新頻率（更新/秒）
   */
  getGPSUpdateRate(): number {
    const duration = this.getRunningDuration();
    if (duration === 0) return 0;
    return this.state.gpsUpdates / duration;
  }

  /**
   * 開始狀態監控
   */
  private startStateMonitoring(): void {
    this.updateInterval = setInterval(() => {
      // 定期檢查服務狀態
      this.checkServiceHealth();
    }, 5000); // 每 5 秒檢查一次
  }

  /**
   * 停止狀態監控
   */
  private stopStateMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 檢查服務健康狀態
   */
  private async checkServiceHealth(): Promise<void> {
    if (!this.state.isRunning) {
      return;
    }

    try {
      if (!ForegroundServiceModule) {
        return;
      }

      const isHealthy = await ForegroundServiceModule.isServiceRunning();

      if (!isHealthy) {
        console.warn('[ForegroundService] Service health check failed');
        this.state.isRunning = false;
        this.stopStateMonitoring();
      }
    } catch (error) {
      console.error('[ForegroundService] Error checking service health:', error);
    }
  }

  /**
   * 重置狀態
   */
  reset(): void {
    this.state = {
      isRunning: false,
      startTime: null,
      lastUpdate: null,
      gpsUpdates: 0,
      batteryUsage: 0,
    };
    this.stopStateMonitoring();
  }
}

/**
 * 全局前台服務實例
 */
let globalForegroundService: ForegroundServiceManager | null = null;

/**
 * 獲取全局前台服務實例
 */
export function getForegroundServiceInstance(
  config?: Partial<ForegroundServiceConfig>
): ForegroundServiceManager {
  if (!globalForegroundService) {
    globalForegroundService = new ForegroundServiceManager(config);
  }
  return globalForegroundService;
}

/**
 * 檢查前台服務是否可用
 */
export function isForegroundServiceAvailable(): boolean {
  return Platform.OS === 'android' && ForegroundServiceModule !== undefined;
}

/**
 * 檢查必要的權限
 */
export const REQUIRED_PERMISSIONS = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
];
