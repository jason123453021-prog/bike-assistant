/**
 * 騎乘會話集成模組
 * 整合所有核心模組到騎乘邏輯中
 */

import { mmkvStorage } from '../storage/mmkv-storage';
import { checkForUnfinishedSession } from '../recovery/crash-recovery-manager';
import { HeadingLockManager } from '../navigation/heading-lock-manager';
import { KalmanFilter2D, TrajectorySmoothing } from '../navigation/kalman-filter';
import { SupplyReminderManager } from '../supply/supply-reminder-manager';
import { PowerSavingManager } from '../power-saving/power-saving-manager';
import { DashboardConfigManager } from '../dashboard/dashboard-config-manager';
import { OfflineManager } from '../offline/offline-manager';

export interface RideSessionConfig {
  enableGPSSmoothing: boolean;
  enableHeadingLock: boolean;
  enableSupplyReminder: boolean;
  enablePowerSaving: boolean;
  enableOfflineMode: boolean;
  gpsUpdateInterval: number; // 毫秒
  dataBackupInterval: number; // 毫秒
}

export interface RideSessionContext {
  isActive: boolean;
  startTime: number | null;
  sessionId: string;
  userId: string;
}

/**
 * 騎乘會話集成管理器
 */
export class RideSessionIntegration {
  private config: RideSessionConfig;
  private context: RideSessionContext;

  // 核心模組
  private mmkvStorage: any;
  private recoveryManager: any;
  private headingLockManager: HeadingLockManager;
  private trajectorySmoothing: TrajectorySmoothing;
  private supplyReminderManager: SupplyReminderManager;
  private powerSavingManager: PowerSavingManager;
  private dashboardConfigManager: DashboardConfigManager;
  private offlineManager: OfflineManager;

  // 定時器
  private gpsUpdateTimer: ReturnType<typeof setInterval> | null = null;
  private dataBackupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<RideSessionConfig> = {}) {
    this.config = {
      enableGPSSmoothing: true,
      enableHeadingLock: true,
      enableSupplyReminder: true,
      enablePowerSaving: true,
      enableOfflineMode: true,
      gpsUpdateInterval: 1000, // 1 秒
      dataBackupInterval: 10000, // 10 秒
      ...config,
    };

    this.context = {
      isActive: false,
      startTime: null,
      sessionId: '',
      userId: '',
    };

    // 初始化所有核心模組
    this.mmkvStorage = mmkvStorage;
    this.recoveryManager = { checkForUnfinishedSession };
    this.headingLockManager = new HeadingLockManager();
    this.trajectorySmoothing = new TrajectorySmoothing(5);
    this.supplyReminderManager = new SupplyReminderManager();
    this.powerSavingManager = new PowerSavingManager();
    this.dashboardConfigManager = new DashboardConfigManager();
    this.offlineManager = new OfflineManager();
  }

  /**
   * 初始化集成系統
   */
  async initialize(): Promise<void> {
    try {
      // 初始化所有模組
      await this.offlineManager.initialize();
      await this.powerSavingManager.enable();

      // 檢查是否有未完成的會話需要恢復
      const recovery = checkForUnfinishedSession();
      if (recovery.hasUnfinishedSession) {
        console.log('[RideIntegration] Unfinished session detected, initiating recovery');
        await this.recoverSession(recovery);
      }

      console.log('[RideIntegration] Initialization completed');
    } catch (error) {
      console.error('[RideIntegration] Initialization error:', error);
    }
  }

  /**
   * 開始騎乘會話
   */
  async startSession(userId: string): Promise<boolean> {
    try {
      if (this.context.isActive) {
        console.warn('[RideIntegration] Session already active');
        return false;
      }

      this.context.isActive = true;
      this.context.startTime = Date.now();
      this.context.sessionId = `ride-${Date.now()}`;
      this.context.userId = userId;

      // 初始化會話數據
      const sessionData = {
        sessionId: this.context.sessionId,
        userId,
        startTime: this.context.startTime,
        coordinates: [] as any[],
        statistics: {
          distance: 0,
          duration: 0,
          ascent: 0,
          descent: 0,
          calories: 0,
          water: 0,
        },
      };

      // 保存會話數據
      this.mmkvStorage.saveSession(this.context.sessionId, sessionData);

      // 啟動定時器
      this.startGPSUpdateTimer();
      this.startDataBackupTimer();

      // 啟用車頭朝前
      if (this.config.enableHeadingLock) {
        this.headingLockManager.setEnabled(true);
      }

      // 啟用補給提醒
      if (this.config.enableSupplyReminder) {
        this.setupSupplyReminders();
      }

      console.log('[RideIntegration] Session started:', this.context.sessionId);
      return true;
    } catch (error) {
      console.error('[RideIntegration] Error starting session:', error);
      this.context.isActive = false;
      return false;
    }
  }

  /**
   * 結束騎乘會話
   */
  async endSession(): Promise<boolean> {
    try {
      if (!this.context.isActive) {
        console.warn('[RideIntegration] No active session');
        return false;
      }

      // 停止定時器
      this.stopGPSUpdateTimer();
      this.stopDataBackupTimer();

      // 禁用車頭朝前
      this.headingLockManager.setEnabled(false);

      // 保存最終會話數據
      const sessionData = this.mmkvStorage.getSession(this.context.sessionId);
      if (sessionData) {
        sessionData.endTime = Date.now();
        this.mmkvStorage.saveSession(this.context.sessionId, sessionData);

        // 保存到離線存儲
        await this.offlineManager.saveRideRecord({
          id: this.context.sessionId,
          name: `Ride ${new Date(sessionData.startTime).toLocaleString()}`,
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          distance: sessionData.statistics.distance,
          duration: sessionData.statistics.duration,
          ascent: sessionData.statistics.ascent,
          descent: sessionData.statistics.descent,
          calories: sessionData.statistics.calories,
          water: sessionData.statistics.water,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      this.context.isActive = false;
      console.log('[RideIntegration] Session ended:', this.context.sessionId);
      return true;
    } catch (error) {
      console.error('[RideIntegration] Error ending session:', error);
      return false;
    }
  }

  /**
   * 處理 GPS 更新
   */
  handleGPSUpdate(lat: number, lon: number, accuracy: number, altitude: number): void {
    if (!this.context.isActive) return;

    try {
      const timestamp = Date.now();

      // 應用 Kalman 濾波平滑
      if (this.config.enableGPSSmoothing) {
        const smoothed = this.trajectorySmoothing.addReading({
          lat,
          lon,
          accuracy,
          timestamp,
        });

        lat = smoothed.lat;
        lon = smoothed.lon;
      }

      // 更新車頭朝前
      if (this.config.enableHeadingLock) {
        this.headingLockManager.updateLocation({
          lat,
          lon,
          timestamp,
        });
      }

      // 保存座標點
      const sessionData = this.mmkvStorage.getSession(this.context.sessionId);
      if (sessionData) {
        sessionData.coordinates.push({
          lat,
          lon,
          altitude,
          accuracy,
          timestamp,
        });

        // 計算距離增量
        if (sessionData.coordinates.length > 1) {
          const prev = sessionData.coordinates[sessionData.coordinates.length - 2];
          const curr = sessionData.coordinates[sessionData.coordinates.length - 1];

          const distance = this.calculateDistance(
            prev.lat,
            prev.lon,
            curr.lat,
            curr.lon
          );

          sessionData.statistics.distance += distance / 1000; // 轉換為 km

          // 計算爬升/下降
          const elevationDiff = curr.altitude - prev.altitude;
          if (elevationDiff > 0) {
            sessionData.statistics.ascent += elevationDiff;
          } else {
            sessionData.statistics.descent += Math.abs(elevationDiff);
          }
        }

        // 更新補給提醒（假設已計算卡路里和水分）
        if (this.config.enableSupplyReminder) {
          // 這裡應該基於實際的卡路里和水分計算
          // this.supplyReminderManager.updateCalories(caloriesDelta);
          // this.supplyReminderManager.updateWater(waterDelta);
        }

        this.mmkvStorage.saveSession(this.context.sessionId, sessionData);
      }
    } catch (error) {
      console.error('[RideIntegration] Error handling GPS update:', error);
    }
  }

  /**
   * 計算兩點間距離（Haversine）
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // 地球半徑（米）
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度轉弧度
   */
  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * 啟動 GPS 更新定時器
   */
  private startGPSUpdateTimer(): void {
    // 這個定時器應該由外部 GPS 監聽器觸發
    // 這裡只是佔位符
    console.log('[RideIntegration] GPS update timer started');
  }

  /**
   * 停止 GPS 更新定時器
   */
  private stopGPSUpdateTimer(): void {
    if (this.gpsUpdateTimer) {
      clearInterval(this.gpsUpdateTimer);
      this.gpsUpdateTimer = null;
    }
  }

  /**
   * 啟動數據備份定時器
   */
  private startDataBackupTimer(): void {
    this.dataBackupTimer = setInterval(async () => {
      if (this.context.isActive && this.context.sessionId) {
        const sessionData = this.mmkvStorage.getSession(this.context.sessionId);
        if (sessionData) {
          // 更新持續時間
          sessionData.statistics.duration = Math.floor(
            (Date.now() - this.context.startTime!) / 1000
          );
          this.mmkvStorage.saveSession(this.context.sessionId, sessionData);
        }
      }
    }, this.config.dataBackupInterval);
  }

  /**
   * 停止數據備份定時器
   */
  private stopDataBackupTimer(): void {
    if (this.dataBackupTimer) {
      clearInterval(this.dataBackupTimer);
      this.dataBackupTimer = null;
    }
  }

  /**
   * 設置補給提醒
   */
  private setupSupplyReminders(): void {
    this.supplyReminderManager.setOnReminderCallback((reminder) => {
      console.log('[RideIntegration] Supply reminder:', reminder.name);
      // 觸發 UI 提醒
    });

    this.supplyReminderManager.setOnRefillCallback((thresholdId) => {
      console.log('[RideIntegration] Supply refilled:', thresholdId);
    });
  }

  /**
   * 恢復未完成的會話
   */
  private async recoverSession(recovery: any): Promise<void> {
    try {
      const sessionData = this.mmkvStorage.getSession(recovery.sessionId);
      if (sessionData) {
        this.context.sessionId = recovery.sessionId;
        this.context.startTime = sessionData.startTime;
        this.context.isActive = true;

        // 重新啟動定時器
        this.startGPSUpdateTimer();
        this.startDataBackupTimer();

        console.log('[RideIntegration] Session recovered:', recovery.sessionId);
      }
    } catch (error) {
      console.error('[RideIntegration] Error recovering session:', error);
    }
  }

  /**
   * 獲取當前會話數據
   */
  getSessionData(): any {
    if (!this.context.sessionId) return null;
    return this.mmkvStorage.getSession(this.context.sessionId);
  }

  /**
   * 獲取當前上下文
   */
  getContext(): RideSessionContext {
    return { ...this.context };
  }

  /**
   * 銷毀集成系統
   */
  async destroy(): Promise<void> {
    await this.endSession();
    this.stopGPSUpdateTimer();
    this.stopDataBackupTimer();
    await this.powerSavingManager.destroy();
    this.offlineManager.destroy();
  }
}

/**
 * 全局騎乘會話集成實例
 */
let globalRideSessionIntegration: RideSessionIntegration | null = null;

/**
 * 獲取全局騎乘會話集成實例
 */
export function getRideSessionIntegration(
  config?: Partial<RideSessionConfig>
): RideSessionIntegration {
  if (!globalRideSessionIntegration) {
    globalRideSessionIntegration = new RideSessionIntegration(config);
  }
  return globalRideSessionIntegration;
}
