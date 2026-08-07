/**
 * 離線架構管理
 * 
 * 功能：
 * 1. 本地存儲管理
 * 2. GPX 匯入備份
 * 3. 手動同步功能
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RideRecord {
  id: string;
  startTime: number;
  endTime?: number;
  distance: number;
  duration: number;
  ascent: number;
  calories: number;
  waterLoss: number;
  gpxData?: string;
  metadata?: Record<string, any>;
}

export interface OfflineArchitectureState {
  records: RideRecord[];
  lastSyncTime?: number;
  storageUsage: number; // 字節
}

const STORAGE_KEY_RECORDS = 'bike_assistant_records';
const STORAGE_KEY_SYNC = 'bike_assistant_last_sync';
const MAX_STORAGE_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * 創建默認的離線架構狀態
 */
export function createDefaultOfflineState(): OfflineArchitectureState {
  return {
    records: [],
    lastSyncTime: undefined,
    storageUsage: 0,
  };
}

/**
 * 保存騎乘紀錄
 */
export async function saveRideRecord(record: RideRecord): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY_RECORDS);
    const records = existing ? JSON.parse(existing) : [];
    records.push(record);
    await AsyncStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to save record:', error);
    throw error;
  }
}

/**
 * 載入所有騎乘紀錄
 */
export async function loadAllRideRecords(): Promise<RideRecord[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY_RECORDS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to load records:', error);
    return [];
  }
}

/**
 * 刪除騎乘紀錄
 */
export async function deleteRideRecord(recordId: string): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY_RECORDS);
    if (!existing) return;

    const records = JSON.parse(existing);
    const filtered = records.filter((r: RideRecord) => r.id !== recordId);
    await AsyncStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(filtered));
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to delete record:', error);
    throw error;
  }
}

/**
 * 匯入 GPX 檔案
 */
export async function importGPXFile(gpxContent: string, name: string): Promise<RideRecord> {
  try {
    const record: RideRecord = {
      id: `gpx_${Date.now()}`,
      startTime: Date.now(),
      distance: 0,
      duration: 0,
      ascent: 0,
      calories: 0,
      waterLoss: 0,
      gpxData: gpxContent,
      metadata: { name, importedAt: Date.now() },
    };

    await saveRideRecord(record);
    return record;
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to import GPX:', error);
    throw error;
  }
}

/**
 * 匯出騎乘紀錄為 GPX
 */
export function exportRideRecordAsGPX(record: RideRecord): string {
  if (!record.gpxData) {
    return '';
  }
  return record.gpxData;
}

/**
 * 計算存儲使用量
 */
export async function calculateStorageUsage(): Promise<number> {
  try {
    const records = await loadAllRideRecords();
    let totalSize = 0;

    for (const record of records) {
      totalSize += JSON.stringify(record).length;
    }

    return totalSize;
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to calculate storage:', error);
    return 0;
  }
}

/**
 * 檢查存儲是否充足
 */
export async function hasEnoughStorage(requiredBytes: number): Promise<boolean> {
  const usage = await calculateStorageUsage();
  return usage + requiredBytes < MAX_STORAGE_SIZE;
}

/**
 * 清理舊紀錄（保留最近 N 天）
 */
export async function cleanupOldRecords(daysToKeep: number = 30): Promise<void> {
  try {
    const records = await loadAllRideRecords();
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    const filtered = records.filter((r) => r.startTime > cutoffTime);

    await AsyncStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(filtered));
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to cleanup records:', error);
    throw error;
  }
}

/**
 * 記錄同步時間
 */
export async function recordSyncTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_SYNC, Date.now().toString());
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to record sync time:', error);
  }
}

/**
 * 獲取上次同步時間
 */
export async function getLastSyncTime(): Promise<number | undefined> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY_SYNC);
    return data ? parseInt(data, 10) : undefined;
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to get sync time:', error);
    return undefined;
  }
}

/**
 * 批量導入紀錄
 */
export async function batchImportRecords(records: RideRecord[]): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY_RECORDS);
    const allRecords = existing ? JSON.parse(existing) : [];

    // 去重：避免導入重複的紀錄
    const existingIds = new Set(allRecords.map((r: RideRecord) => r.id));
    const newRecords = records.filter((r) => !existingIds.has(r.id));

    const combined = [...allRecords, ...newRecords];
    await AsyncStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(combined));
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to batch import:', error);
    throw error;
  }
}

/**
 * 獲取統計信息
 */
export async function getStatistics(): Promise<{
  totalRecords: number;
  totalDistance: number;
  totalDuration: number;
  totalCalories: number;
  averageDistance: number;
}> {
  try {
    const records = await loadAllRideRecords();

    const totalDistance = records.reduce((sum, r) => sum + r.distance, 0);
    const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
    const totalCalories = records.reduce((sum, r) => sum + r.calories, 0);

    return {
      totalRecords: records.length,
      totalDistance,
      totalDuration,
      totalCalories,
      averageDistance: records.length > 0 ? totalDistance / records.length : 0,
    };
  } catch (error) {
    console.error('[OfflineArchitecture] Failed to get statistics:', error);
    return {
      totalRecords: 0,
      totalDistance: 0,
      totalDuration: 0,
      totalCalories: 0,
      averageDistance: 0,
    };
  }
}
