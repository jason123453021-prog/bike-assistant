import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 本地存儲管理器 - 處理所有本地數據的持久化
 */
export class LocalStorageManager {
  private static readonly PREFIX = '@bike_assistant_';

  /**
   * 保存騎乘記錄
   */
  static async saveRideRecord(record: any): Promise<void> {
    try {
      const key = `${this.PREFIX}ride_${record.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(record));
    } catch (error) {
      console.error('Failed to save ride record:', error);
      throw error;
    }
  }

  /**
   * 獲取騎乘記錄
   */
  static async getRideRecord(id: string): Promise<any | null> {
    try {
      const key = `${this.PREFIX}ride_${id}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get ride record:', error);
      return null;
    }
  }

  /**
   * 獲取所有騎乘記錄
   */
  static async getAllRideRecords(): Promise<any[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const rideKeys = keys.filter((k) => k.startsWith(`${this.PREFIX}ride_`));
      const records: any[] = [];

      for (const key of rideKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          records.push(JSON.parse(data));
        }
      }

      return records.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get all ride records:', error);
      return [];
    }
  }

  /**
   * 刪除騎乘記錄
   */
  static async deleteRideRecord(id: string): Promise<void> {
    try {
      const key = `${this.PREFIX}ride_${id}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to delete ride record:', error);
      throw error;
    }
  }

  /**
   * 保存用戶設置
   */
  static async saveUserSettings(settings: any): Promise<void> {
    try {
      const key = `${this.PREFIX}user_settings`;
      await AsyncStorage.setItem(key, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save user settings:', error);
      throw error;
    }
  }

  /**
   * 獲取用戶設置
   */
  static async getUserSettings(): Promise<any | null> {
    try {
      const key = `${this.PREFIX}user_settings`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get user settings:', error);
      return null;
    }
  }

  /**
   * 保存同步狀態
   */
  static async saveSyncStatus(status: any): Promise<void> {
    try {
      const key = `${this.PREFIX}sync_status`;
      await AsyncStorage.setItem(key, JSON.stringify(status));
    } catch (error) {
      console.error('Failed to save sync status:', error);
      throw error;
    }
  }

  /**
   * 獲取同步狀態
   */
  static async getSyncStatus(): Promise<any | null> {
    try {
      const key = `${this.PREFIX}sync_status`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return null;
    }
  }

  /**
   * 保存隊友位置
   */
  static async saveBuddyLocation(buddyId: string, location: any): Promise<void> {
    try {
      const key = `${this.PREFIX}buddy_location_${buddyId}`;
      await AsyncStorage.setItem(key, JSON.stringify(location));
    } catch (error) {
      console.error('Failed to save buddy location:', error);
      throw error;
    }
  }

  /**
   * 獲取隊友位置
   */
  static async getBuddyLocation(buddyId: string): Promise<any | null> {
    try {
      const key = `${this.PREFIX}buddy_location_${buddyId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get buddy location:', error);
      return null;
    }
  }

  /**
   * 保存成績數據
   */
  static async savePerformanceData(data: any): Promise<void> {
    try {
      const key = `${this.PREFIX}performance_data`;
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save performance data:', error);
      throw error;
    }
  }

  /**
   * 獲取成績數據
   */
  static async getPerformanceData(): Promise<any | null> {
    try {
      const key = `${this.PREFIX}performance_data`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get performance data:', error);
      return null;
    }
  }

  /**
   * 清除所有數據
   */
  static async clearAllData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter((k) => k.startsWith(this.PREFIX));
      await AsyncStorage.multiRemove(appKeys);
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * 獲取存儲大小信息
   */
  static async getStorageInfo(): Promise<{ totalSize: number; itemCount: number }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter((k) => k.startsWith(this.PREFIX));
      let totalSize = 0;

      for (const key of appKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }

      return {
        totalSize,
        itemCount: appKeys.length,
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { totalSize: 0, itemCount: 0 };
    }
  }
}
