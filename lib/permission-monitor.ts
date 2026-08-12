import { useEffect, useRef } from 'react';
import { PermissionsManager, type PermissionStatus, type PermissionType } from './permissions-manager';
import * as Location from 'expo-location';

export interface PermissionChangeEvent {
  type: PermissionType;
  previousStatus: boolean;
  currentStatus: boolean;
  timestamp: number;
}

type PermissionChangeListener = (event: PermissionChangeEvent) => void;

class PermissionMonitorService {
  private listeners: Set<PermissionChangeListener> = new Set();
  private lastStatuses: Map<PermissionType, boolean> = new Map();
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private isMonitoring = false;

  /**
   * 訂閱權限變化事件
   */
  subscribe(listener: PermissionChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 開始監控權限變化
   * @param intervalMs 檢查間隔（毫秒），預設 5000ms
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      console.warn('[PermissionMonitor] Already monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log('[PermissionMonitor] Started monitoring permissions');

    // 初始檢查
    this.checkPermissions();

    // 定期檢查
    this.monitoringInterval = setInterval(() => {
      this.checkPermissions();
    }, intervalMs);
  }

  /**
   * 停止監控權限變化
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.warn('[PermissionMonitor] Not monitoring');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('[PermissionMonitor] Stopped monitoring permissions');
  }

  /**
   * 檢查所有權限狀態
   */
  private async checkPermissions(): Promise<void> {
    try {
      const statuses = await PermissionsManager.getAllPermissionStatuses();

      for (const status of statuses) {
        const previousStatus = this.lastStatuses.get(status.type) ?? false;
        const currentStatus = status.granted;

        // 如果狀態改變，觸發事件
        if (previousStatus !== currentStatus) {
          this.notifyListeners({
            type: status.type,
            previousStatus,
            currentStatus,
            timestamp: Date.now(),
          });
        }

        // 更新最後狀態
        this.lastStatuses.set(status.type, currentStatus);
      }
    } catch (error) {
      console.error('[PermissionMonitor] Error checking permissions:', error);
    }
  }

  /**
   * 通知所有監聽者
   */
  private notifyListeners(event: PermissionChangeEvent): void {
    console.log(
      `[PermissionMonitor] Permission changed: ${event.type} ${event.previousStatus} -> ${event.currentStatus}`
    );

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[PermissionMonitor] Error in listener:', error);
      }
    }
  }

  /**
   * 獲取當前權限狀態快照
   */
  async getSnapshot(): Promise<Map<PermissionType, boolean>> {
    const statuses = await PermissionsManager.getAllPermissionStatuses();
    const snapshot = new Map<PermissionType, boolean>();

    for (const status of statuses) {
      snapshot.set(status.type, status.granted);
    }

    return snapshot;
  }

  /**
   * 清理資源
   */
  destroy(): void {
    this.stopMonitoring();
    this.listeners.clear();
    this.lastStatuses.clear();
  }
}

// 全局單例
let monitorInstance: PermissionMonitorService | null = null;

export function getPermissionMonitor(): PermissionMonitorService {
  if (!monitorInstance) {
    monitorInstance = new PermissionMonitorService();
  }
  return monitorInstance;
}

/**
 * React Hook - 訂閱權限變化
 */
export function usePermissionMonitor(
  onPermissionChange?: (event: PermissionChangeEvent) => void,
  autoStart: boolean = true
) {
  const monitor = useRef(getPermissionMonitor());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const m = monitor.current;

    // 訂閱事件
    if (onPermissionChange) {
      unsubscribeRef.current = m.subscribe(onPermissionChange);
    }

    // 自動啟動監控
    if (autoStart && !m['isMonitoring']) {
      m.startMonitoring();
    }

    // 清理
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [onPermissionChange, autoStart]);

  return monitor.current;
}
