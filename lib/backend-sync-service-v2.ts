import { LocalStorageManager } from './local-storage-manager';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: number;
  pendingItems: number;
  failedItems: number;
}

/**
 * 後端同步服務
 */
export class BackendSyncService {
  static async getSyncStatus(): Promise<SyncStatus> {
    return {
      isSyncing: false,
      lastSyncTime: Date.now(),
      pendingItems: 0,
      failedItems: 0,
    };
  }

  static async manualSync(): Promise<void> {
    // 模擬同步
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
