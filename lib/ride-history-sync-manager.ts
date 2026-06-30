import AsyncStorage from '@react-native-async-storage/async-storage';
import { type RideStatistics } from '@/lib/ride-statistics-manager';
import { getUserAccountManager } from '@/lib/user-account-manager';

/**
 * 騎乘歷史同步狀態
 */
export enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  FAILED = 'failed',
}

/**
 * 騎乘歷史同步記錄
 */
export interface RideHistorySyncRecord {
  rideId: string;
  status: SyncStatus;
  lastSyncTime: number;
  retryCount: number;
  error?: string;
}

/**
 * 騎乘歷史雲端同步管理器
 */
class RideHistorySyncManager {
  private static instance: RideHistorySyncManager;
  private syncRecords: Map<string, RideHistorySyncRecord> = new Map();
  private isSyncing = false;
  private readonly STORAGE_KEY = 'bike_assistant_sync_records';
  private readonly BATCH_SIZE = 10;
  private readonly MAX_RETRIES = 3;

  private constructor() {}

  static getInstance(): RideHistorySyncManager {
    if (!RideHistorySyncManager.instance) {
      RideHistorySyncManager.instance = new RideHistorySyncManager();
    }
    return RideHistorySyncManager.instance;
  }

  /**
   * 初始化 - 加載同步記錄
   */
  async initialize(): Promise<void> {
    try {
      const recordsJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (recordsJson) {
        const records = JSON.parse(recordsJson);
        this.syncRecords = new Map(Object.entries(records));
      }
    } catch (error) {
      console.error('[RideHistorySyncManager] Error initializing:', error);
    }
  }

  /**
   * 添加騎乘記錄到同步隊列
   */
  async addRideForSync(ride: RideStatistics): Promise<void> {
    try {
      const record: RideHistorySyncRecord = {
        rideId: ride.id,
        status: SyncStatus.PENDING,
        lastSyncTime: 0,
        retryCount: 0,
      };

      this.syncRecords.set(ride.id, record);
      await this.saveSyncRecords();
    } catch (error) {
      console.error('[RideHistorySyncManager] Error adding ride for sync:', error);
    }
  }

  /**
   * 同步所有待同步的騎乘記錄
   */
  async syncAllRides(): Promise<void> {
    if (this.isSyncing) {
      console.log('[RideHistorySyncManager] Sync already in progress');
      return;
    }

    this.isSyncing = true;

    try {
      const userManager = getUserAccountManager();
      if (!userManager.isLoggedIn()) {
        console.log('[RideHistorySyncManager] User not logged in, skipping sync');
        this.isSyncing = false;
        return;
      }

      // 獲取所有待同步的騎乘記錄
      const pendingRides = Array.from(this.syncRecords.values())
        .filter((r) => r.status === SyncStatus.PENDING || r.status === SyncStatus.FAILED)
        .filter((r) => r.retryCount < this.MAX_RETRIES);

      if (pendingRides.length === 0) {
        this.isSyncing = false;
        return;
      }

      // 分批同步
      for (let i = 0; i < pendingRides.length; i += this.BATCH_SIZE) {
        const batch = pendingRides.slice(i, i + this.BATCH_SIZE);
        await Promise.all(batch.map((record) => this.syncSingleRide(record.rideId)));
      }
    } catch (error) {
      console.error('[RideHistorySyncManager] Error syncing rides:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 同步單個騎乘記錄
   */
  private async syncSingleRide(rideId: string): Promise<void> {
    try {
      const record = this.syncRecords.get(rideId);
      if (!record) {
        return;
      }

      record.status = SyncStatus.SYNCING;
      await this.saveSyncRecords();

      // 從本地存儲獲取騎乘數據
      const rideJson = await AsyncStorage.getItem(`ride_${rideId}`);
      if (!rideJson) {
        throw new Error('Ride data not found');
      }

      const ride: RideStatistics = JSON.parse(rideJson);
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      // 上傳到雲端
      const response = await fetch('/api/rides/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify(ride),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      // 標記為已同步
      record.status = SyncStatus.SYNCED;
      record.lastSyncTime = Date.now();
      record.retryCount = 0;

      await this.saveSyncRecords();
    } catch (error) {
      const record = this.syncRecords.get(rideId);
      if (record) {
        record.status = SyncStatus.FAILED;
        record.retryCount++;
        record.error = String(error);
        await this.saveSyncRecords();
      }

      console.error(`[RideHistorySyncManager] Error syncing ride ${rideId}:`, error);
    }
  }

  /**
   * 下載雲端騎乘歷史
   */
  async downloadRideHistory(): Promise<RideStatistics[]> {
    try {
      const userManager = getUserAccountManager();
      if (!userManager.isLoggedIn()) {
        throw new Error('User not logged in');
      }

      const token = userManager.getAuthToken();
      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/rides/history', {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download history');
      }

      const rides: RideStatistics[] = await response.json();

      // 保存到本地存儲
      for (const ride of rides) {
        await AsyncStorage.setItem(`ride_${ride.id}`, JSON.stringify(ride));
      }

      return rides;
    } catch (error) {
      console.error('[RideHistorySyncManager] Error downloading history:', error);
      throw error;
    }
  }

  /**
   * 獲取同步狀態
   */
  getSyncStatus(rideId: string): SyncStatus {
    const record = this.syncRecords.get(rideId);
    return record?.status || SyncStatus.PENDING;
  }

  /**
   * 獲取所有同步記錄
   */
  getAllSyncRecords(): RideHistorySyncRecord[] {
    return Array.from(this.syncRecords.values());
  }

  /**
   * 獲取待同步的騎乘數量
   */
  getPendingSyncCount(): number {
    return Array.from(this.syncRecords.values()).filter(
      (r) => r.status === SyncStatus.PENDING || r.status === SyncStatus.FAILED
    ).length;
  }

  /**
   * 是否正在同步
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * 保存同步記錄到本地存儲
   */
  private async saveSyncRecords(): Promise<void> {
    try {
      const recordsObj = Object.fromEntries(this.syncRecords);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(recordsObj));
    } catch (error) {
      console.error('[RideHistorySyncManager] Error saving sync records:', error);
    }
  }

  /**
   * 銷毀實例
   */
  destroy(): void {
    this.syncRecords.clear();
    this.isSyncing = false;
  }
}

export function getRideHistorySyncManager(): RideHistorySyncManager {
  return RideHistorySyncManager.getInstance();
}
