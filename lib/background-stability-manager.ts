import { AppState, type AppStateStatus, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import { RideTrackingNative } from './ride-tracking-native';

export interface BackgroundStabilityConfig {
  enableWakeLock?: boolean; // 保持螢幕喚醒
  enableForegroundService?: boolean; // 前台服務
  enableLocationTracking?: boolean; // 背景位置追蹤
  enableHeartbeatMonitoring?: boolean; // 心跳監控
  heartbeatInterval?: number; // 心跳間隔（毫秒）
  maxBackgroundTime?: number; // 最大背景運行時間（秒）
}

export interface BackgroundStabilityStatus {
  isRunning: boolean;
  appState: AppStateStatus;
  backgroundTime: number; // 背景運行時間（秒）
  lastHeartbeat: number;
  isStable: boolean;
}

const HEARTBEAT_TASK_NAME = 'background-heartbeat-task';
const HEARTBEAT_INTERVAL = 60000; // 60 秒

/**
 * 背景執行穩定性管理器
 * 功能：
 * - 前台服務保活
 * - 心跳監控
 * - 背景時間追蹤
 * - 異常恢復
 */
export class BackgroundStabilityManager {
  private config: Required<BackgroundStabilityConfig>;
  private appState: AppStateStatus = 'active';
  private backgroundStartTime: number | null = null;
  private lastHeartbeat: number = Date.now();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(status: BackgroundStabilityStatus) => void> = new Set();

  constructor(config: BackgroundStabilityConfig = {}) {
    this.config = {
      enableWakeLock: config.enableWakeLock ?? true,
      enableForegroundService: config.enableForegroundService ?? true,
      enableLocationTracking: config.enableLocationTracking ?? true,
      enableHeartbeatMonitoring: config.enableHeartbeatMonitoring ?? true,
      heartbeatInterval: config.heartbeatInterval ?? HEARTBEAT_INTERVAL,
      maxBackgroundTime: config.maxBackgroundTime ?? 3600, // 1 小時
    };
  }

  /**
   * 初始化穩定性管理器
   */
  async initialize(): Promise<void> {
    console.log('[BackgroundStabilityManager] Initializing');

    // 監聽 App 狀態變化
    const subscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

    // 註冊心跳任務
    if (this.config.enableHeartbeatMonitoring) {
      await this.registerHeartbeatTask();
    }

    // 啟動前台服務
    if (this.config.enableForegroundService && Platform.OS === 'android') {
      await this.startForegroundService();
    }

    console.log('[BackgroundStabilityManager] Initialized');
  }

  /**
   * 訂閱穩定性狀態變化
   */
  subscribe(listener: (status: BackgroundStabilityStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 處理 App 狀態變化
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    console.log(`[BackgroundStabilityManager] App state changed: ${this.appState} -> ${nextAppState}`);

    if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
      // 進入背景
      this.backgroundStartTime = Date.now();
      this.startHeartbeatMonitoring();
    } else if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // 返回前台
      if (this.backgroundStartTime) {
        const backgroundDuration = (Date.now() - this.backgroundStartTime) / 1000;
        console.log(`[BackgroundStabilityManager] Background duration: ${backgroundDuration}s`);
        this.backgroundStartTime = null;
      }
      this.stopHeartbeatMonitoring();
    }

    this.appState = nextAppState;
    this.notifyListeners();
  }

  /**
   * 啟動心跳監控
   */
  private startHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      console.warn('[BackgroundStabilityManager] Heartbeat monitoring already started');
      return;
    }

    console.log('[BackgroundStabilityManager] Starting heartbeat monitoring');

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳監控
   */
  private stopHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[BackgroundStabilityManager] Stopped heartbeat monitoring');
    }
  }

  /**
   * 發送心跳
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      this.lastHeartbeat = Date.now();

      // 檢查背景時間是否超過限制
      if (this.backgroundStartTime) {
        const backgroundDuration = (Date.now() - this.backgroundStartTime) / 1000;
        if (backgroundDuration > this.config.maxBackgroundTime) {
          console.warn(
            `[BackgroundStabilityManager] Background time exceeded: ${backgroundDuration}s`
          );
          // 觸發恢復機制
          await this.triggerRecovery();
        }
      }

      // 定期檢查位置追蹤狀態
      if (this.config.enableLocationTracking) {
        await this.checkLocationTracking();
      }

      this.notifyListeners();
    } catch (error) {
      console.error('[BackgroundStabilityManager] Heartbeat error:', error);
    }
  }

  /**
   * 註冊心跳任務
   */
  private async registerHeartbeatTask(): Promise<void> {
    try {
      await TaskManager.defineTask(HEARTBEAT_TASK_NAME, async () => {
        console.log('[BackgroundStabilityManager] Heartbeat task executed');
        this.lastHeartbeat = Date.now();
        return;
      });

      console.log('[BackgroundStabilityManager] Heartbeat task registered');
    } catch (error) {
      console.error('[BackgroundStabilityManager] Error registering heartbeat task:', error);
    }
  }

  /**
   * 啟動前台服務
   */
  private async startForegroundService(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await RideTrackingNative.startTracking();
        console.log('[BackgroundStabilityManager] Foreground service started');
      }
    } catch (error) {
      console.error('[BackgroundStabilityManager] Error starting foreground service:', error);
    }
  }

  /**
   * 停止前台服務
   */
  private async stopForegroundService(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await RideTrackingNative.stopTracking();
        console.log('[BackgroundStabilityManager] Foreground service stopped');
      }
    } catch (error) {
      console.error('[BackgroundStabilityManager] Error stopping foreground service:', error);
    }
  }

  /**
   * 檢查位置追蹤狀態
   */
  private async checkLocationTracking(): Promise<void> {
    try {
      await RideTrackingNative.startTracking();
    } catch (error) {
      console.error('[BackgroundStabilityManager] Error checking location tracking:', error);
    }
  }

  /**
   * 觸發恢復機制
   */
  private async triggerRecovery(): Promise<void> {
    console.log('[BackgroundStabilityManager] Triggering recovery mechanism');

    try {
      // 重啟位置追蹤
      await RideTrackingNative.startTracking();

      console.log('[BackgroundStabilityManager] Recovery completed');
    } catch (error) {
      console.error('[BackgroundStabilityManager] Recovery error:', error);
    }
  }

  /**
   * 獲取穩定性狀態
   */
  getStatus(): BackgroundStabilityStatus {
    const backgroundTime = this.backgroundStartTime
      ? (Date.now() - this.backgroundStartTime) / 1000
      : 0;

    return {
      isRunning: this.appState.match(/inactive|background/) !== null,
      appState: this.appState,
      backgroundTime,
      lastHeartbeat: this.lastHeartbeat,
      isStable: backgroundTime < this.config.maxBackgroundTime,
    };
  }

  /**
   * 通知所有監聽者
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('[BackgroundStabilityManager] Error in listener:', error);
      }
    }
  }

  /**
   * 清理資源
   */
  async destroy(): Promise<void> {
    this.stopHeartbeatMonitoring();
    await this.stopForegroundService();
    this.listeners.clear();
    console.log('[BackgroundStabilityManager] Destroyed');
  }
}

// 全局單例
let managerInstance: BackgroundStabilityManager | null = null;

export function getBackgroundStabilityManager(
  config?: BackgroundStabilityConfig
): BackgroundStabilityManager {
  if (!managerInstance) {
    managerInstance = new BackgroundStabilityManager(config);
  }
  return managerInstance;
}
