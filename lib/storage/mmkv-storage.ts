/**
 * MMKV 存儲管理模組
 * 用於高性能的本地數據持久化，特別是 GPS 座標與運動數據的實時寫入
 */

import { createMMKV } from 'react-native-mmkv';

// 創建 MMKV 實例
let mmkvStorageInstance: any;

try {
  mmkvStorageInstance = createMMKV({
    id: 'bike-assistant-storage',
  });
} catch (error) {
  console.warn('[MMKV] Failed to initialize MMKV, using fallback storage');
  mmkvStorageInstance = {
    set: () => {},
    getString: () => null,
    delete: () => {},
    clearAll: () => {},
    getAllKeys: () => [],
  };
}

export const mmkvStorage = mmkvStorageInstance;

/**
 * 騎乘數據持久化結構
 */
export interface RideSessionData {
  id: string;
  startTime: number;
  endTime?: number;
  isActive: boolean;
  
  // 軌跡數據
  coordinates: Array<{
    lat: number;
    lon: number;
    ele: number; // 海拔
    timestamp: number;
  }>;
  
  // 統計數據
  totalDistance: number; // 公里
  totalElapsed: number; // 秒
  totalPausedTime: number; // 秒
  totalCalories: number; // kcal
  totalAscent: number; // 米
  totalDescent: number; // 米
  
  // 當前狀態
  currentSpeed: number; // km/h
  currentPower: number; // W
  currentHeartRate?: number; // bpm
  currentCadence?: number; // rpm
  
  // 補給數據
  caloriesSinceLastRefill: number;
  waterSinceLastRefill: number; // ml
  refillCount: number;
  
  // 路線信息
  routeId?: string;
  routeName?: string;
  
  // 其他
  notes?: string;
}

/**
 * 存儲當前騎乘會話
 */
export function saveCurrentSession(session: RideSessionData): void {
  try {
    mmkvStorage.set('current-session', JSON.stringify(session));
  } catch (error) {
    console.error('[MMKV] Error saving current session:', error);
  }
}

/**
 * 獲取當前騎乘會話
 */
export function getCurrentSession(): RideSessionData | null {
  try {
    const data = mmkvStorage.getString('current-session');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[MMKV] Error retrieving current session:', error);
    return null;
  }
}

/**
 * 清除當前騎乘會話
 */
export function clearCurrentSession(): void {
  try {
    mmkvStorage.delete('current-session');
  } catch (error) {
    console.error('[MMKV] Error clearing current session:', error);
  }
}

/**
 * 實時更新 GPS 座標
 */
export function addCoordinate(
  lat: number,
  lon: number,
  ele: number,
  timestamp: number = Date.now()
): void {
  try {
    const session = getCurrentSession();
    if (!session) return;
    
    session.coordinates.push({
      lat,
      lon,
      ele,
      timestamp,
    });
    
    // 為了避免數據過大，每 100 個座標點檢查一次大小
    if (session.coordinates.length % 100 === 0) {
      saveCurrentSession(session);
    }
  } catch (error) {
    console.error('[MMKV] Error adding coordinate:', error);
  }
}

/**
 * 批量更新統計數據
 */
export function updateSessionStats(updates: Partial<RideSessionData>): void {
  try {
    const session = getCurrentSession();
    if (!session) return;
    
    const updated = {
      ...session,
      ...updates,
    };
    
    saveCurrentSession(updated);
  } catch (error) {
    console.error('[MMKV] Error updating session stats:', error);
  }
}

/**
 * 保存歷史騎乘紀錄
 */
export function saveHistoryRecord(record: RideSessionData): void {
  try {
    const key = `history-${record.id}`;
    mmkvStorage.set(key, JSON.stringify(record));
    
    // 更新歷史紀錄索引
    const indexKey = 'history-index';
    const indexData = mmkvStorage.getString(indexKey) || '[]';
    const index: string[] = JSON.parse(indexData);
    
    if (!index.includes(record.id)) {
      index.push(record.id);
      mmkvStorage.set(indexKey, JSON.stringify(index));
    }
  } catch (error) {
    console.error('[MMKV] Error saving history record:', error);
  }
}

/**
 * 獲取所有歷史紀錄
 */
export function getAllHistoryRecords(): RideSessionData[] {
  try {
    const indexKey = 'history-index';
    const indexData = mmkvStorage.getString(indexKey) || '[]';
    const index: string[] = JSON.parse(indexData);
    
    const records: RideSessionData[] = [];
    for (const id of index) {
      const key = `history-${id}`;
      const data = mmkvStorage.getString(key);
      if (data) {
        records.push(JSON.parse(data));
      }
    }
    
    return records.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  } catch (error) {
    console.error('[MMKV] Error retrieving history records:', error);
    return [];
  }
}

/**
 * 獲取單個歷史紀錄
 */
export function getHistoryRecord(id: string): RideSessionData | null {
  try {
    const key = `history-${id}`;
    const data = mmkvStorage.getString(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[MMKV] Error retrieving history record:', error);
    return null;
  }
}

/**
 * 刪除歷史紀錄
 */
export function deleteHistoryRecord(id: string): void {
  try {
    const key = `history-${id}`;
    mmkvStorage.delete(key);
    
    // 更新歷史紀錄索引
    const indexKey = 'history-index';
    const indexData = mmkvStorage.getString(indexKey) || '[]';
    const index: string[] = JSON.parse(indexData);
    
    const updatedIndex = index.filter(recordId => recordId !== id);
    mmkvStorage.set(indexKey, JSON.stringify(updatedIndex));
  } catch (error) {
    console.error('[MMKV] Error deleting history record:', error);
  }
}

/**
 * 保存應用設定
 */
export function saveSettings(settings: Record<string, any>): void {
  try {
    mmkvStorage.set('app-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('[MMKV] Error saving settings:', error);
  }
}

/**
 * 獲取應用設定
 */
export function getSettings(): Record<string, any> {
  try {
    const data = mmkvStorage.getString('app-settings');
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('[MMKV] Error retrieving settings:', error);
    return {};
  }
}

/**
 * 清除所有數據（用於調試或完全重置）
 */
export function clearAllData(): void {
  try {
    mmkvStorage.clearAll();
  } catch (error) {
    console.error('[MMKV] Error clearing all data:', error);
  }
}

/**
 * 獲取存儲大小（字節）
 */
export function getStorageSize(): number {
  try {
    const keys = mmkvStorage.getAllKeys();
    return keys.reduce((total: number, key: string) => {
      const data = mmkvStorage.getString(key);
      return total + (data ? data.length : 0);
    }, 0);
  } catch (error) {
    console.error('[MMKV] Error getting storage size:', error);
    return 0;
  }
}
