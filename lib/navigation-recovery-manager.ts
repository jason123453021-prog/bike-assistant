import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationObject } from 'expo-location';

export interface NavigationCheckpoint {
  id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  stepIndex: number;
  distance: number; // 已騎行距離（米）
  duration: number; // 已騎行時間（秒）
  routePolyline: [number, number][]; // 路線多邊形
  instructions: any[]; // 轉向指令
}

export interface RecoveryState {
  hasCheckpoint: boolean;
  checkpoint?: NavigationCheckpoint;
  offlineMode: boolean;
  lastSyncTime: number;
}

const STORAGE_KEY = 'navigation_checkpoint';
const SYNC_INTERVAL = 30000; // 30 秒同步一次

/**
 * 導航中斷和軌跡恢復管理器
 * 功能：
 * - 定期保存導航檢查點
 * - 網絡中斷時使用本地緩存繼續導航
 * - App 崩潰時恢復導航狀態
 * - 自動同步到服務器
 */
export class NavigationRecoveryManager {
  private currentCheckpoint: NavigationCheckpoint | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private offlineMode = false;
  private lastSyncTime = 0;

  /**
   * 初始化恢復管理器
   */
  async initialize(): Promise<RecoveryState> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.currentCheckpoint = JSON.parse(saved);
        console.log('[NavigationRecoveryManager] Loaded checkpoint:', this.currentCheckpoint?.id);
      }
    } catch (error) {
      console.error('[NavigationRecoveryManager] Error loading checkpoint:', error);
    }

    return this.getState();
  }

  /**
   * 保存導航檢查點
   */
  async saveCheckpoint(
    latitude: number,
    longitude: number,
    stepIndex: number,
    distance: number,
    duration: number,
    routePolyline: [number, number][],
    instructions: any[]
  ): Promise<void> {
    try {
      const checkpoint: NavigationCheckpoint = {
        id: `checkpoint_${Date.now()}`,
        timestamp: Date.now(),
        latitude,
        longitude,
        stepIndex,
        distance,
        duration,
        routePolyline,
        instructions,
      };

      this.currentCheckpoint = checkpoint;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(checkpoint));

      console.log('[NavigationRecoveryManager] Checkpoint saved:', checkpoint.id);
    } catch (error) {
      console.error('[NavigationRecoveryManager] Error saving checkpoint:', error);
    }
  }

  /**
   * 啟動自動同步
   */
  startAutoSync(onSync?: (checkpoint: NavigationCheckpoint) => Promise<void>): void {
    if (this.syncInterval) {
      console.warn('[NavigationRecoveryManager] Auto sync already started');
      return;
    }

    console.log('[NavigationRecoveryManager] Starting auto sync');

    this.syncInterval = setInterval(async () => {
      if (this.currentCheckpoint && onSync) {
        try {
          await onSync(this.currentCheckpoint);
          this.lastSyncTime = Date.now();
          console.log('[NavigationRecoveryManager] Synced checkpoint:', this.currentCheckpoint.id);
        } catch (error) {
          console.error('[NavigationRecoveryManager] Sync error:', error);
          this.offlineMode = true;
        }
      }
    }, SYNC_INTERVAL);
  }

  /**
   * 停止自動同步
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[NavigationRecoveryManager] Auto sync stopped');
    }
  }

  /**
   * 檢測網絡連接
   */
  setOfflineMode(offline: boolean): void {
    if (this.offlineMode !== offline) {
      this.offlineMode = offline;
      console.log(`[NavigationRecoveryManager] Offline mode: ${offline}`);
    }
  }

  /**
   * 獲取當前恢復狀態
   */
  getState(): RecoveryState {
    return {
      hasCheckpoint: this.currentCheckpoint !== null,
      checkpoint: this.currentCheckpoint || undefined,
      offlineMode: this.offlineMode,
      lastSyncTime: this.lastSyncTime,
    };
  }

  /**
   * 清除檢查點
   */
  async clearCheckpoint(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      this.currentCheckpoint = null;
      console.log('[NavigationRecoveryManager] Checkpoint cleared');
    } catch (error) {
      console.error('[NavigationRecoveryManager] Error clearing checkpoint:', error);
    }
  }

  /**
   * 獲取恢復建議
   */
  getRecoveryOptions(): {
    canResumeNavigation: boolean;
    resumeMessage: string;
    remainingDistance: number;
    remainingTime: number;
  } {
    if (!this.currentCheckpoint) {
      return {
        canResumeNavigation: false,
        resumeMessage: '沒有可恢復的導航',
        remainingDistance: 0,
        remainingTime: 0,
      };
    }

    const timeSinceCheckpoint = (Date.now() - this.currentCheckpoint.timestamp) / 1000;
    const isStale = timeSinceCheckpoint > 3600; // 1 小時後視為過期

    return {
      canResumeNavigation: !isStale,
      resumeMessage: isStale
        ? '導航已過期，請重新開始'
        : `從 ${this.formatDistance(this.currentCheckpoint.distance)} 處恢復`,
      remainingDistance: this.currentCheckpoint.distance,
      remainingTime: this.currentCheckpoint.duration,
    };
  }

  /**
   * 驗證檢查點有效性
   */
  isCheckpointValid(maxAgeSeconds: number = 3600): boolean {
    if (!this.currentCheckpoint) {
      return false;
    }

    const age = (Date.now() - this.currentCheckpoint.timestamp) / 1000;
    return age <= maxAgeSeconds;
  }

  /**
   * 計算恢復進度
   */
  getRecoveryProgress(): {
    completedDistance: number;
    completedDuration: number;
    completedSteps: number;
    totalSteps: number;
    progressPercentage: number;
  } {
    if (!this.currentCheckpoint) {
      return {
        completedDistance: 0,
        completedDuration: 0,
        completedSteps: 0,
        totalSteps: 0,
        progressPercentage: 0,
      };
    }

    const totalSteps = this.currentCheckpoint.instructions.length;
    const completedSteps = this.currentCheckpoint.stepIndex;
    const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    return {
      completedDistance: this.currentCheckpoint.distance,
      completedDuration: this.currentCheckpoint.duration,
      completedSteps,
      totalSteps,
      progressPercentage,
    };
  }

  /**
   * 清理資源
   */
  destroy(): void {
    this.stopAutoSync();
    this.currentCheckpoint = null;
  }

  /**
   * 格式化距離
   */
  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} 公尺`;
    } else {
      return `${(meters / 1000).toFixed(1)} 公里`;
    }
  }
}

// 全局單例
let managerInstance: NavigationRecoveryManager | null = null;

export function getNavigationRecoveryManager(): NavigationRecoveryManager {
  if (!managerInstance) {
    managerInstance = new NavigationRecoveryManager();
  }
  return managerInstance;
}
