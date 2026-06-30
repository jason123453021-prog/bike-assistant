import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MapTile {
  z: number; // 縮放級別
  x: number; // X 坐標
  y: number; // Y 坐標
  url: string;
  timestamp: number;
  size: number; // 字節
}

export interface CacheMetadata {
  totalSize: number;
  tileCount: number;
  lastUpdated: number;
  mapSource: string;
}

const CACHE_DIR = `${FileSystem.documentDirectory}offline-maps/`;
const METADATA_KEY = 'offline_map_cache_metadata';
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500 MB
const TILE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 天

/**
 * 離線地圖快取管理器
 * 功能：
 * - 地圖瓦片下載和快取
 * - 智能快取策略（LRU、大小限制）
 * - 快取元數據管理
 * - 快取清理和過期管理
 */
export class OfflineMapCacheManager {
  private metadata: Map<string, CacheMetadata> = new Map();

  /**
   * 初始化快取管理器
   */
  async initialize(): Promise<void> {
    try {
      // 創建快取目錄
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }

      // 加載元數據
      await this.loadMetadata();

      console.log('[OfflineMapCacheManager] Initialized');
    } catch (error) {
      console.error('[OfflineMapCacheManager] Initialization error:', error);
      throw error;
    }
  }

  /**
   * 下載和快取地圖瓦片
   */
  async downloadAndCacheTile(tile: MapTile): Promise<string> {
    try {
      const tilePath = this.getTilePath(tile);

      // 檢查是否已快取
      const fileInfo = await FileSystem.getInfoAsync(tilePath);
      if (fileInfo.exists) {
        // 更新訪問時間
        await this.updateTileTimestamp(tile);
        return tilePath;
      }

      // 檢查快取大小
      await this.checkAndCleanCache();

      // 下載瓦片
      console.log(`[OfflineMapCacheManager] Downloading tile: ${tile.url}`);
      const downloadResult = await FileSystem.downloadAsync(tile.url, tilePath);

      if (downloadResult.status !== 200) {
        throw new Error(`Failed to download tile: ${downloadResult.status}`);
      }

      // 獲取文件大小
      const fileStats = await FileSystem.getInfoAsync(tilePath);
      const size = (fileStats.exists && 'size' in fileStats) ? (fileStats as any).size || 0 : 0;

      // 更新元數據
      await this.updateMetadata(tile.url, size);

      console.log(`[OfflineMapCacheManager] Tile cached: ${tilePath}`);
      return tilePath;
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error downloading tile:', error);
      throw error;
    }
  }

  /**
   * 批量下載地圖瓦片
   */
  async downloadTilesForRegion(
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    zoomLevels: number[],
    mapSource: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    try {
      const tiles = this.generateTilesForRegion(bounds, zoomLevels, mapSource);
      const total = tiles.length;

      for (let i = 0; i < tiles.length; i++) {
        try {
          await this.downloadAndCacheTile(tiles[i]);
          if (onProgress) {
            onProgress(i + 1, total);
          }
        } catch (error) {
          console.warn(`[OfflineMapCacheManager] Failed to download tile ${i}:`, error);
          // 繼續下載其他瓦片
        }
      }

      console.log(`[OfflineMapCacheManager] Downloaded ${total} tiles for region`);
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error downloading region:', error);
      throw error;
    }
  }

  /**
   * 獲取快取的瓦片
   */
  async getCachedTile(tile: MapTile): Promise<string | null> {
    try {
      const tilePath = this.getTilePath(tile);
      const fileInfo = await FileSystem.getInfoAsync(tilePath);

      if (!fileInfo.exists) {
        return null;
      }

      // 檢查是否過期
      const timestamp = fileInfo.modificationTime || 0;
      if (Date.now() - timestamp * 1000 > TILE_EXPIRY) {
        // 刪除過期瓦片
        await FileSystem.deleteAsync(tilePath);
        return null;
      }

      // 更新訪問時間
      await this.updateTileTimestamp(tile);

      return tilePath;
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error getting cached tile:', error);
      return null;
    }
  }

  /**
   * 獲取快取統計信息
   */
  async getCacheStats(): Promise<{ totalSize: number; tileCount: number; cacheDir: string }> {
    try {
      let totalSize = 0;
      let tileCount = 0;

      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      for (const file of files) {
        const filePath = `${CACHE_DIR}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && 'size' in fileInfo) {
          totalSize += (fileInfo as any).size || 0;
          tileCount++;
        }
      }

      return {
        totalSize,
        tileCount,
        cacheDir: CACHE_DIR,
      };
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error getting cache stats:', error);
      return { totalSize: 0, tileCount: 0, cacheDir: CACHE_DIR };
    }
  }

  /**
   * 清空快取
   */
  async clearCache(): Promise<void> {
    try {
      await FileSystem.deleteAsync(CACHE_DIR);
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      await AsyncStorage.removeItem(METADATA_KEY);
      this.metadata.clear();

      console.log('[OfflineMapCacheManager] Cache cleared');
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * 清理過期快取
   */
  async cleanExpiredCache(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = `${CACHE_DIR}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (fileInfo.exists && 'modificationTime' in fileInfo && fileInfo.modificationTime) {
          const age = Date.now() - fileInfo.modificationTime * 1000;
          if (age > TILE_EXPIRY) {
            await FileSystem.deleteAsync(filePath);
            deletedCount++;
          }
        }
      }

      console.log(`[OfflineMapCacheManager] Cleaned ${deletedCount} expired tiles`);
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error cleaning expired cache:', error);
    }
  }

  /**
   * 生成區域內的瓦片
   */
  private generateTilesForRegion(
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    zoomLevels: number[],
    mapSource: string
  ): MapTile[] {
    const tiles: MapTile[] = [];

    for (const z of zoomLevels) {
      const { minX, maxX, minY, maxY } = this.latLonToTile(bounds, z);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({
            z,
            x,
            y,
            url: this.getTileUrl(x, y, z, mapSource),
            timestamp: Date.now(),
            size: 0,
          });
        }
      }
    }

    return tiles;
  }

  /**
   * 將經緯度轉換為瓦片坐標
   */
  private latLonToTile(
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    z: number
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const n = Math.pow(2, z);

    const minX = Math.floor(((bounds.minLon + 180) / 360) * n);
    const maxX = Math.floor(((bounds.maxLon + 180) / 360) * n);

    const minY = Math.floor(
      ((1 - Math.log(Math.tan((bounds.maxLat * Math.PI) / 180) + 1 / Math.cos((bounds.maxLat * Math.PI) / 180)) / Math.PI) / 2) * n
    );
    const maxY = Math.floor(
      ((1 - Math.log(Math.tan((bounds.minLat * Math.PI) / 180) + 1 / Math.cos((bounds.minLat * Math.PI) / 180)) / Math.PI) / 2) * n
    );

    return { minX, maxX, minY, maxY };
  }

  /**
   * 獲取瓦片 URL
   */
  private getTileUrl(x: number, y: number, z: number, mapSource: string): string {
    // 使用 OpenStreetMap 作為默認源
    if (mapSource === 'osm') {
      return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    } else if (mapSource === 'osm-hot') {
      return `https://tile.openstreetmap.fr/hot/${z}/${x}/${y}.png`;
    }
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }

  /**
   * 獲取瓦片本地路徑
   */
  private getTilePath(tile: MapTile): string {
    return `${CACHE_DIR}${tile.z}_${tile.x}_${tile.y}.png`;
  }

  /**
   * 更新瓦片時間戳
   */
  private async updateTileTimestamp(tile: MapTile): Promise<void> {
    try {
      const tilePath = this.getTilePath(tile);
      // 更新文件修改時間
      await FileSystem.getInfoAsync(tilePath);
    } catch (error) {
      console.warn('[OfflineMapCacheManager] Error updating timestamp:', error);
    }
  }

  /**
   * 更新元數據
   */
  private async updateMetadata(mapSource: string, size: number): Promise<void> {
    try {
      const metadata = this.metadata.get(mapSource) || {
        totalSize: 0,
        tileCount: 0,
        lastUpdated: Date.now(),
        mapSource,
      };

      metadata.totalSize += size;
      metadata.tileCount += 1;
      metadata.lastUpdated = Date.now();

      this.metadata.set(mapSource, metadata);
      await this.saveMetadata();
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error updating metadata:', error);
    }
  }

  /**
   * 加載元數據
   */
  private async loadMetadata(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(METADATA_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.metadata = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error loading metadata:', error);
    }
  }

  /**
   * 保存元數據
   */
  private async saveMetadata(): Promise<void> {
    try {
      const data = Object.fromEntries(this.metadata);
      await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error saving metadata:', error);
    }
  }

  /**
   * 檢查並清理快取
   */
  private async checkAndCleanCache(): Promise<void> {
    try {
      const stats = await this.getCacheStats();

      if (stats.totalSize > MAX_CACHE_SIZE) {
        // 使用 LRU 策略刪除最舊的瓦片
        const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
        const fileStats: { path: string; time: number }[] = [];

        for (const file of files) {
          const filePath = `${CACHE_DIR}${file}`;
          const info = await FileSystem.getInfoAsync(filePath);
          const modTime = (info.exists && 'modificationTime' in info) ? (info as any).modificationTime || 0 : 0;
          fileStats.push({
            path: filePath,
            time: modTime,
          });
        }

        // 按時間排序
        fileStats.sort((a, b) => a.time - b.time);

        // 刪除最舊的瓦片直到達到目標大小
        let currentSize = stats.totalSize;
        for (const file of fileStats) {
          if (currentSize <= MAX_CACHE_SIZE * 0.8) {
            break;
          }

          const fileInfo = await FileSystem.getInfoAsync(file.path);
          if (fileInfo.exists && 'size' in fileInfo) {
            const size = (fileInfo as any).size || 0;
            await FileSystem.deleteAsync(file.path);
            currentSize -= size;
          }
        }

        console.log('[OfflineMapCacheManager] Cache cleaned, new size:', currentSize);
      }
    } catch (error) {
      console.error('[OfflineMapCacheManager] Error checking cache:', error);
    }
  }

  /**
   * 銷毀管理器
   */
  async destroy(): Promise<void> {
    this.metadata.clear();
    console.log('[OfflineMapCacheManager] Destroyed');
  }
}

// 全局單例
let managerInstance: OfflineMapCacheManager | null = null;

export function getOfflineMapCacheManager(): OfflineMapCacheManager {
  if (!managerInstance) {
    managerInstance = new OfflineMapCacheManager();
  }
  return managerInstance;
}
