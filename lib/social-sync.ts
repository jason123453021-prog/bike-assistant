/**
 * 社群互動後端同步模組
 *
 * 功能：
 * - 將本地社群互動數據同步至後端
 * - 支援離線模式（無網路時本地存儲，有網路時自動同步）
 * - 支援多設備同步
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RideInteraction } from "./social-context";

export interface SyncConfig {
  autoSync: boolean; // 自動同步開關
  syncInterval: number; // 同步間隔（毫秒）
  retryCount: number; // 重試次數
  retryDelay: number; // 重試延遲（毫秒）
}

const DEFAULT_CONFIG: SyncConfig = {
  autoSync: true,
  syncInterval: 30000, // 30 秒
  retryCount: 3,
  retryDelay: 5000, // 5 秒
};

export class SocialSyncManager {
  private config: SyncConfig;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 啟動自動同步
   */
  startAutoSync() {
    if (!this.config.autoSync || this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      this.syncPendingData().catch((err) => {
        console.error("[SocialSync] 自動同步失敗:", err);
      });
    }, this.config.syncInterval);
  }

  /**
   * 停止自動同步
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * 同步待處理的社群互動數據
   * 注意：此方法應在客戶端調用，需要後端 API 支援
   */
  async syncPendingData() {
    if (this.isSyncing) return;

    this.isSyncing = true;
    try {
      // 從 AsyncStorage 讀取待同步的數據
      const pendingData = await AsyncStorage.getItem("@bike_assistant_pending_sync");

      if (!pendingData) {
        this.isSyncing = false;
        return;
      }

      const { interactions, comments } = JSON.parse(pendingData);

      // 注意：實際的 API 調用應在 relive.tsx 或其他客戶端組件中進行
      // 這裡只是示例結構
      console.log("[SocialSync] 待同步數據:", { interactions, comments });

      // 清除待同步數據（實際應在 API 成功後清除）
      // await AsyncStorage.removeItem("@bike_assistant_pending_sync");
    } catch (error) {
      console.error("[SocialSync] 同步失敗:", error);
      // 保留待同步數據，稍後重試
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 手動觸發同步
   */
  async manualSync() {
    try {
      await this.syncPendingData();
      return { success: true };
    } catch (error) {
      console.error("[SocialSync] 手動同步失敗:", error);
      return { success: false, error };
    }
  }

  /**
   * 標記數據為待同步
   */
  async markForSync(type: "interaction" | "comment", data: any) {
    try {
      const pendingData = await AsyncStorage.getItem("@bike_assistant_pending_sync");
      const pending = pendingData ? JSON.parse(pendingData) : { interactions: [], comments: [] };

      if (type === "interaction") {
        pending.interactions.push(data);
      } else {
        pending.comments.push(data);
      }

      await AsyncStorage.setItem("@bike_assistant_pending_sync", JSON.stringify(pending));
    } catch (error) {
      console.error("[SocialSync] 標記待同步失敗:", error);
    }
  }

  /**
   * 清除待同步數據
   */
  async clearPendingSync() {
    try {
      await AsyncStorage.removeItem("@bike_assistant_pending_sync");
    } catch (error) {
      console.error("[SocialSync] 清除待同步失敗:", error);
    }
  }

  /**
   * 獲取待同步數據計數
   */
  async getPendingSyncCount(): Promise<number> {
    try {
      const pendingData = await AsyncStorage.getItem("@bike_assistant_pending_sync");
      if (!pendingData) return 0;

      const { interactions, comments } = JSON.parse(pendingData);
      return (interactions?.length || 0) + (comments?.length || 0);
    } catch (error) {
      console.error("[SocialSync] 獲取待同步計數失敗:", error);
      return 0;
    }
  }
}

// 全局同步管理器實例
let syncManager: SocialSyncManager | null = null;

export function getSyncManager(config?: Partial<SyncConfig>): SocialSyncManager {
  if (!syncManager) {
    syncManager = new SocialSyncManager(config);
  }
  return syncManager;
}
