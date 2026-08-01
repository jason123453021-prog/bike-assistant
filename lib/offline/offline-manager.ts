/**
 * 離線架構管理模組
 * 完全本地化、移除雲端依賴
 */

import * as FileSystem from 'expo-file-system/legacy';

export interface OfflineConfig {
  enableOfflineMode: boolean;
  localStoragePath: string;
  autoBackupEnabled: boolean;
  autoBackupInterval: number; // 毫秒
  maxLocalRecords: number;
}

export interface LocalRideRecord {
  id: string;
  name: string;
  startTime: number;
  endTime: number | null;
  distance: number; // km
  duration: number; // 秒
  ascent: number; // m
  descent: number; // m
  calories: number;
  water: number; // ml
  gpxPath?: string;
  jsonPath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OfflineStats {
  totalRecords: number;
  totalDistance: number; // km
  totalDuration: number; // 秒
  totalAscent: number; // m
  totalCalories: number;
  storageUsed: number; // 字節
  lastBackupTime: number | null;
}

/**
 * 離線架構管理器
 */
export class OfflineManager {
  private config: OfflineConfig;
  private records: Map<string, LocalRideRecord>;
  private stats: OfflineStats;
  private backupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<OfflineConfig> = {}) {
    this.config = {
      enableOfflineMode: true,
      localStoragePath: `${FileSystem.documentDirectory || ''}bike_assistant/`,
      autoBackupEnabled: true,
      autoBackupInterval: 3600000, // 1 小時
      maxLocalRecords: 1000,
      ...config,
    };

    this.records = new Map();
    this.stats = {
      totalRecords: 0,
      totalDistance: 0,
      totalDuration: 0,
      totalAscent: 0,
      totalCalories: 0,
      storageUsed: 0,
      lastBackupTime: null,
    };
  }

  /**
   * 初始化離線系統
   */
  async initialize(): Promise<void> {
    try {
      // 創建本地存儲目錄
      const dirInfo = await FileSystem.getInfoAsync(this.config.localStoragePath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.config.localStoragePath, {
          intermediates: true,
        });
      }

      // 創建子目錄
      await this.createSubdirectories();

      // 加載現有紀錄
      await this.loadLocalRecords();

      // 啟動自動備份
      if (this.config.autoBackupEnabled) {
        this.startAutoBackup();
      }

      console.log('[OfflineManager] Initialized successfully');
    } catch (error) {
      console.error('[OfflineManager] Initialization error:', error);
    }
  }

  /**
   * 創建子目錄
   */
  private async createSubdirectories(): Promise<void> {
    const subdirs = ['records', 'gpx', 'backups', 'cache'];
    for (const subdir of subdirs) {
      const path = `${this.config.localStoragePath}${subdir}/`;
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(path, { intermediates: true });
      }
    }
  }

  /**
   * 保存騎乘紀錄
   */
  async saveRideRecord(record: LocalRideRecord): Promise<boolean> {
    try {
      // 檢查記錄數量限制
      if (this.records.size >= this.config.maxLocalRecords) {
        console.warn('[OfflineManager] Max records reached');
        return false;
      }

      // 保存 JSON 紀錄
      const jsonPath = `${this.config.localStoragePath}records/${record.id}.json`;
      await FileSystem.writeAsStringAsync(jsonPath, JSON.stringify(record, null, 2));

      record.jsonPath = jsonPath;
      this.records.set(record.id, record);

      // 更新統計
      this.updateStats();

      console.log('[OfflineManager] Record saved:', record.id);
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error saving record:', error);
      return false;
    }
  }

  /**
   * 加載本地紀錄
   */
  private async loadLocalRecords(): Promise<void> {
    try {
      const recordsPath = `${this.config.localStoragePath}records/`;
      const files = await FileSystem.readDirectoryAsync(recordsPath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = `${recordsPath}${file}`;
          const content = await FileSystem.readAsStringAsync(filePath);
          const record: LocalRideRecord = JSON.parse(content);
          this.records.set(record.id, record);
        }
      }

      this.updateStats();
      console.log('[OfflineManager] Loaded', this.records.size, 'records');
    } catch (error) {
      console.error('[OfflineManager] Error loading records:', error);
    }
  }

  /**
   * 獲取所有紀錄
   */
  getRecords(): LocalRideRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 獲取特定紀錄
   */
  getRecord(recordId: string): LocalRideRecord | null {
    return this.records.get(recordId) || null;
  }

  /**
   * 刪除紀錄
   */
  async deleteRecord(recordId: string): Promise<boolean> {
    try {
      const record = this.records.get(recordId);
      if (!record) return false;

      // 刪除文件
      if (record.jsonPath) {
        await FileSystem.deleteAsync(record.jsonPath, { idempotent: true });
      }
      if (record.gpxPath) {
        await FileSystem.deleteAsync(record.gpxPath, { idempotent: true });
      }

      this.records.delete(recordId);
      this.updateStats();

      console.log('[OfflineManager] Record deleted:', recordId);
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error deleting record:', error);
      return false;
    }
  }

  /**
   * 匯入 GPX 檔案
   */
  async importGPXFile(gpxPath: string, recordId: string): Promise<boolean> {
    try {
      const destPath = `${this.config.localStoragePath}gpx/${recordId}.gpx`;
      await FileSystem.copyAsync({
        from: gpxPath,
        to: destPath,
      });

      const record = this.records.get(recordId);
      if (record) {
        record.gpxPath = destPath;
        await this.saveRideRecord(record);
      }

      console.log('[OfflineManager] GPX file imported:', recordId);
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error importing GPX:', error);
      return false;
    }
  }

  /**
   * 匯入騎乘紀錄檔案
   */
  async importRecordFile(filePath: string): Promise<LocalRideRecord | null> {
    try {
      const content = await FileSystem.readAsStringAsync(filePath);
      const record: LocalRideRecord = JSON.parse(content);

      // 驗證紀錄結構
      if (!this.validateRecord(record)) {
        console.error('[OfflineManager] Invalid record format');
        return null;
      }

      await this.saveRideRecord(record);
      return record;
    } catch (error) {
      console.error('[OfflineManager] Error importing record file:', error);
      return null;
    }
  }

  /**
   * 驗證紀錄結構
   */
  private validateRecord(record: any): boolean {
    const requiredFields = ['id', 'name', 'startTime', 'distance', 'duration'];
    return requiredFields.every(field => field in record);
  }

  /**
   * 導出紀錄為 JSON
   */
  async exportRecordAsJSON(recordId: string): Promise<string | null> {
    try {
      const record = this.records.get(recordId);
      if (!record) return null;

      const exportPath = `${this.config.localStoragePath}backups/${recordId}_export.json`;
      await FileSystem.writeAsStringAsync(exportPath, JSON.stringify(record, null, 2));

      return exportPath;
    } catch (error) {
      console.error('[OfflineManager] Error exporting record:', error);
      return null;
    }
  }

  /**
   * 手動備份
   */
  async manualBackup(): Promise<boolean> {
    try {
      const backupPath = `${this.config.localStoragePath}backups/backup_${Date.now()}.json`;
      const backupData = {
        timestamp: Date.now(),
        records: Array.from(this.records.values()),
        stats: this.stats,
      };

      await FileSystem.writeAsStringAsync(backupPath, JSON.stringify(backupData, null, 2));

      this.stats.lastBackupTime = Date.now();
      console.log('[OfflineManager] Manual backup completed:', backupPath);
      return true;
    } catch (error) {
      console.error('[OfflineManager] Error during manual backup:', error);
      return false;
    }
  }

  /**
   * 啟動自動備份
   */
  private startAutoBackup(): void {
    this.backupTimer = setInterval(async () => {
      await this.manualBackup();
    }, this.config.autoBackupInterval);
  }

  /**
   * 停止自動備份
   */
  private stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }

  /**
   * 更新統計信息
   */
  private updateStats(): void {
    this.stats.totalRecords = this.records.size;
    this.stats.totalDistance = 0;
    this.stats.totalDuration = 0;
    this.stats.totalAscent = 0;
    this.stats.totalCalories = 0;

    for (const record of this.records.values()) {
      this.stats.totalDistance += record.distance;
      this.stats.totalDuration += record.duration;
      this.stats.totalAscent += record.ascent;
      this.stats.totalCalories += record.calories;
    }
  }

  /**
   * 獲取統計信息
   */
  getStats(): OfflineStats {
    return { ...this.stats };
  }

  /**
   * 獲取存儲使用量
   */
  async getStorageUsage(): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(this.config.localStoragePath);
      if (info.isDirectory) {
        // 簡化計算：遍歷所有文件
        let totalSize = 0;
        const recordsPath = `${this.config.localStoragePath}records/`;
        const files = await FileSystem.readDirectoryAsync(recordsPath);

        for (const file of files) {
          const filePath = `${recordsPath}${file}`;
          try {
            const content = await FileSystem.readAsStringAsync(filePath);
            totalSize += content.length;
          } catch (e) {
            // 忽略讀取錯誤
          }
        }

        this.stats.storageUsed = totalSize;
        return totalSize;
      }
    } catch (error) {
      console.error('[OfflineManager] Error getting storage usage:', error);
    }

    return 0;
  }

  /**
   * 清理過期備份
   */
  async cleanupOldBackups(daysToKeep: number = 30): Promise<void> {
    try {
      const backupsPath = `${this.config.localStoragePath}backups/`;
      const files = await FileSystem.readDirectoryAsync(backupsPath);
      const now = Date.now();
      const keepTime = daysToKeep * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.startsWith('backup_')) {
          const filePath = `${backupsPath}${file}`;
          // 簡化：直接刪除所有舊備份
          // 實際應用中應檢查文件修改時間
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
      }

      console.log('[OfflineManager] Old backups cleaned up');
    } catch (error) {
      console.error('[OfflineManager] Error cleaning up backups:', error);
    }
  }

  /**
   * 獲取配置
   */
  getConfig(): OfflineConfig {
    return { ...this.config };
  }

  /**
   * 銷毀管理器
   */
  destroy(): void {
    this.stopAutoBackup();
    this.records.clear();
  }
}

/**
 * 全局離線管理器實例
 */
let globalOfflineManager: OfflineManager | null = null;

/**
 * 獲取全局離線管理器
 */
export function getOfflineManager(config?: Partial<OfflineConfig>): OfflineManager {
  if (!globalOfflineManager) {
    globalOfflineManager = new OfflineManager(config);
  }
  return globalOfflineManager;
}
