import { Platform } from 'react-native';
import { RideTrackingNative } from './ride-tracking-native';

export interface BatteryOptimizationStatus {
  isIgnoringOptimizations: boolean;
  lastChecked: number;
  lastPromptTime: number | null;
}

class BatteryOptimizationMonitorService {
  private status: BatteryOptimizationStatus = {
    isIgnoringOptimizations: false,
    lastChecked: 0,
    lastPromptTime: null,
  };

  private listeners: Set<(status: BatteryOptimizationStatus) => void> = new Set();
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private isMonitoring = false;

  /**
   * 訂閱電池最佳化狀態變化
   */
  subscribe(listener: (status: BatteryOptimizationStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 開始監控電池最佳化狀態
   * @param intervalMs 檢查間隔（毫秒），預設 30000ms
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      console.warn('[BatteryOptimizationMonitor] Already monitoring');
      return;
    }

    if (Platform.OS !== 'android') {
      console.log('[BatteryOptimizationMonitor] Battery optimization monitoring only available on Android');
      return;
    }

    this.isMonitoring = true;
    console.log('[BatteryOptimizationMonitor] Started monitoring battery optimization');

    // 初始檢查
    this.checkBatteryOptimization();

    // 定期檢查
    this.monitoringInterval = setInterval(() => {
      this.checkBatteryOptimization();
    }, intervalMs);
  }

  /**
   * 停止監控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.warn('[BatteryOptimizationMonitor] Not monitoring');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('[BatteryOptimizationMonitor] Stopped monitoring');
  }

  /**
   * 檢查電池最佳化狀態
   */
  private async checkBatteryOptimization(): Promise<void> {
    try {
      const isIgnoring = await RideTrackingNative.isIgnoringBatteryOptimizations();
      const previousStatus = this.status.isIgnoringOptimizations;

      this.status = {
        ...this.status,
        isIgnoringOptimizations: isIgnoring,
        lastChecked: Date.now(),
      };

      // 如果狀態改變，通知監聽者
      if (previousStatus !== isIgnoring) {
        console.log(
          `[BatteryOptimizationMonitor] Status changed: ${previousStatus} -> ${isIgnoring}`
        );
        this.notifyListeners();
      }
    } catch (error) {
      console.error('[BatteryOptimizationMonitor] Error checking battery optimization:', error);
    }
  }

  /**
   * 主動請求電池最佳化豁免
   */
  async requestBatteryOptimizationExemption(): Promise<boolean> {
    try {
      console.log('[BatteryOptimizationMonitor] Requesting battery optimization exemption');
      await RideTrackingNative.requestIgnoreBatteryOptimizations();

      // 更新提示時間
      this.status.lastPromptTime = Date.now();

      // 延遲檢查以確保系統更新
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await this.checkBatteryOptimization();

      return this.status.isIgnoringOptimizations;
    } catch (error) {
      console.error('[BatteryOptimizationMonitor] Error requesting exemption:', error);
      return false;
    }
  }

  /**
   * 獲取當前狀態
   */
  getStatus(): BatteryOptimizationStatus {
    return { ...this.status };
  }

  /**
   * 檢查是否需要提示用戶（避免頻繁提示）
   */
  shouldPromptUser(minIntervalMs: number = 3600000): boolean {
    // 如果已經在白名單中，不需要提示
    if (this.status.isIgnoringOptimizations) {
      return false;
    }

    // 如果從未提示過，需要提示
    if (this.status.lastPromptTime === null) {
      return true;
    }

    // 如果距離上次提示超過最小間隔，需要提示
    return Date.now() - this.status.lastPromptTime > minIntervalMs;
  }

  /**
   * 通知所有監聽者
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.status);
      } catch (error) {
        console.error('[BatteryOptimizationMonitor] Error in listener:', error);
      }
    }
  }

  /**
   * 清理資源
   */
  destroy(): void {
    this.stopMonitoring();
    this.listeners.clear();
  }
}

// 全局單例
let monitorInstance: BatteryOptimizationMonitorService | null = null;

export function getBatteryOptimizationMonitor(): BatteryOptimizationMonitorService {
  if (!monitorInstance) {
    monitorInstance = new BatteryOptimizationMonitorService();
  }
  return monitorInstance;
}
