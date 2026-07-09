import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 離線模式管理器
 * 支援應用在無網絡環境下運行
 */

export interface OfflineData {
  id: string;
  type: 'ride' | 'comment' | 'share' | 'sync';
  data: any;
  timestamp: number;
  synced: boolean;
}

export class OfflineModeManager {
  private static isOnline = true;
  private static offlineQueue: OfflineData[] = [];
  private static readonly STORAGE_KEY = 'offline_queue';
  private static readonly NETWORK_CHECK_INTERVAL = 10000; // 10 seconds
  private static networkCheckInterval: NodeJS.Timeout | null = null;

  /**
   * 初始化離線模式
   */
  static async initialize() {
    // 檢查初始網絡狀態
    await this.checkNetworkStatus();

    // 定期檢查網絡狀態
    this.startNetworkMonitoring();

    // 加載離線隊列
    await this.loadOfflineQueue();

    // 嘗試同步待處理的數據
    await this.syncPendingData();
  }

  /**
   * 檢查網絡狀態
   */
  static async checkNetworkStatus(): Promise<boolean> {
    try {
      const isConnected = await Network.isInternetReachableAsync();
      this.isOnline = isConnected ?? false;
      console.log('[OfflineMode] Network status:', this.isOnline ? 'online' : 'offline');
      return this.isOnline;
    } catch (error) {
      console.error('[OfflineMode] Failed to check network:', error);
      return false;
    }
  }

  /**
   * 啟動網絡監控
   */
  static startNetworkMonitoring() {
    if (this.networkCheckInterval) return;

    this.networkCheckInterval = setInterval(async () => {
      const wasOnline = this.isOnline;
      await this.checkNetworkStatus();

      // 網絡恢復時嘗試同步
      if (!wasOnline && this.isOnline) {
        console.log('[OfflineMode] Network restored, syncing pending data');
        await this.syncPendingData();
      }
    }, this.NETWORK_CHECK_INTERVAL);
  }

  /**
   * 停止網絡監控
   */
  static stopNetworkMonitoring() {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
  }

  /**
   * 獲取網絡狀態
   */
  static isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * 添加到離線隊列
   */
  static async addToOfflineQueue(
    type: 'ride' | 'comment' | 'share' | 'sync',
    data: any,
  ): Promise<void> {
    const offlineData: OfflineData = {
      id: `offline_${Date.now()}_${Math.random()}`,
      type,
      data,
      timestamp: Date.now(),
      synced: false,
    };

    this.offlineQueue.push(offlineData);
    await this.saveOfflineQueue();
    console.log('[OfflineMode] Added to offline queue:', offlineData.id);
  }

  /**
   * 保存離線隊列到本地存儲
   */
  static async saveOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(this.offlineQueue),
      );
    } catch (error) {
      console.error('[OfflineMode] Failed to save offline queue:', error);
    }
  }

  /**
   * 加載離線隊列
   */
  static async loadOfflineQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (data) {
        this.offlineQueue = JSON.parse(data);
        console.log('[OfflineMode] Loaded offline queue:', this.offlineQueue.length, 'items');
      }
    } catch (error) {
      console.error('[OfflineMode] Failed to load offline queue:', error);
    }
  }

  /**
   * 同步待處理的數據
   */
  static async syncPendingData(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.length === 0) return;

    console.log('[OfflineMode] Syncing', this.offlineQueue.length, 'pending items');

    for (const item of this.offlineQueue) {
      try {
        await this.syncItem(item);
        item.synced = true;
      } catch (error) {
        console.error('[OfflineMode] Failed to sync item:', item.id, error);
      }
    }

    // 移除已同步的項目
    this.offlineQueue = this.offlineQueue.filter((item) => !item.synced);
    await this.saveOfflineQueue();
  }

  /**
   * 同步單個項目
   */
  private static async syncItem(item: OfflineData): Promise<void> {
    // 根據類型調用相應的同步 API
    switch (item.type) {
      case 'ride':
        await this.syncRideData(item.data);
        break;
      case 'comment':
        await this.syncComment(item.data);
        break;
      case 'share':
        await this.syncShare(item.data);
        break;
      case 'sync':
        await this.syncGenericData(item.data);
        break;
    }
  }

  /**
   * 同步騎乘數據
   */
  private static async syncRideData(data: any): Promise<void> {
    // 實現騎乘數據同步邏輯
    console.log('[OfflineMode] Syncing ride data:', data);
  }

  /**
   * 同步評論
   */
  private static async syncComment(data: any): Promise<void> {
    // 實現評論同步邏輯
    console.log('[OfflineMode] Syncing comment:', data);
  }

  /**
   * 同步分享
   */
  private static async syncShare(data: any): Promise<void> {
    // 實現分享同步邏輯
    console.log('[OfflineMode] Syncing share:', data);
  }

  /**
   * 同步通用數據
   */
  private static async syncGenericData(data: any): Promise<void> {
    // 實現通用數據同步邏輯
    console.log('[OfflineMode] Syncing generic data:', data);
  }

  /**
   * 獲取離線隊列
   */
  static getOfflineQueue(): OfflineData[] {
    return [...this.offlineQueue];
  }

  /**
   * 清空離線隊列
   */
  static async clearOfflineQueue(): Promise<void> {
    this.offlineQueue = [];
    await AsyncStorage.removeItem(this.STORAGE_KEY);
    console.log('[OfflineMode] Offline queue cleared');
  }

  /**
   * 獲取離線隊列統計
   */
  static getOfflineQueueStats() {
    return {
      total: this.offlineQueue.length,
      rides: this.offlineQueue.filter((item) => item.type === 'ride').length,
      comments: this.offlineQueue.filter((item) => item.type === 'comment').length,
      shares: this.offlineQueue.filter((item) => item.type === 'share').length,
      synced: this.offlineQueue.filter((item) => item.synced).length,
    };
  }
}
