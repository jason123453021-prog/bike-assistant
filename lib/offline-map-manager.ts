import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Feature, LineString } from 'geojson';

export interface OfflineMapRegion {
  id: string;
  name: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  zoom: number;
  size: number; // 字節
  downloadedAt: number;
  expiresAt: number;
}

export interface GPXRoute {
  id: string;
  name: string;
  description?: string;
  track: Feature<LineString>;
  distance: number; // 米
  elevation: number; // 米
  estimatedTime: number; // 秒
  difficulty: 'easy' | 'moderate' | 'hard';
  downloadedAt: number;
  tags: string[];
}

const MAPS_STORAGE_KEY = 'offline_maps';
const ROUTES_STORAGE_KEY = 'gpx_routes';
const MAP_CACHE_DIR = `${FileSystem.documentDirectory}maps/`;
const ROUTES_CACHE_DIR = `${FileSystem.documentDirectory}routes/`;
const MAP_EXPIRY_DAYS = 30;

export class OfflineMapManager {
  /**
   * 初始化離線地圖管理器
   */
  static async initialize(): Promise<void> {
    try {
      // 創建緩存目錄
      await FileSystem.makeDirectoryAsync(MAP_CACHE_DIR, { intermediates: true });
      await FileSystem.makeDirectoryAsync(ROUTES_CACHE_DIR, { intermediates: true });

      // 清理過期地圖
      await this.cleanupExpiredMaps();
    } catch (error) {
      console.error('Failed to initialize offline map manager:', error);
    }
  }

  /**
   * 下載離線地圖區域
   */
  static async downloadMapRegion(
    region: OfflineMapRegion,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    try {
      const mapUrl = this.generateMapTileURL(region);
      const fileName = `map_${region.id}.mbtiles`;
      const filePath = `${MAP_CACHE_DIR}${fileName}`;

      // 模擬下載進度
      for (let i = 0; i <= 100; i += 10) {
        onProgress?.(i);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // 保存地圖元數據
      const maps = await this.getDownloadedMaps();
      const newMap: OfflineMapRegion = {
        ...region,
        downloadedAt: Date.now(),
        expiresAt: Date.now() + MAP_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      };

      maps.push(newMap);
      await AsyncStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify(maps));

      console.log(`Downloaded map region: ${region.name}`);
      return true;
    } catch (error) {
      console.error('Failed to download map region:', error);
      return false;
    }
  }

  /**
   * 生成地圖瓦片 URL
   */
  private static generateMapTileURL(region: OfflineMapRegion): string {
    // 使用 OpenStreetMap 或其他地圖服務
    const { minLat, maxLat, minLon, maxLon } = region.bounds;
    return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${minLon},${minLat},${region.zoom},0,0/1280x720@2x?access_token=YOUR_TOKEN`;
  }

  /**
   * 獲取已下載的地圖
   */
  static async getDownloadedMaps(): Promise<OfflineMapRegion[]> {
    try {
      const data = await AsyncStorage.getItem(MAPS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get downloaded maps:', error);
      return [];
    }
  }

  /**
   * 刪除地圖區域
   */
  static async deleteMapRegion(regionId: string): Promise<boolean> {
    try {
      const maps = await this.getDownloadedMaps();
      const filtered = maps.filter((m) => m.id !== regionId);

      // 刪除文件
      const fileName = `map_${regionId}.mbtiles`;
      const filePath = `${MAP_CACHE_DIR}${fileName}`;
      await FileSystem.deleteAsync(filePath, { idempotent: true });

      // 更新存儲
      await AsyncStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify(filtered));

      return true;
    } catch (error) {
      console.error('Failed to delete map region:', error);
      return false;
    }
  }

  /**
   * 清理過期地圖
   */
  static async cleanupExpiredMaps(): Promise<void> {
    try {
      const maps = await this.getDownloadedMaps();
      const now = Date.now();

      const validMaps = maps.filter((m) => m.expiresAt > now);
      const expiredMaps = maps.filter((m) => m.expiresAt <= now);

      // 刪除過期地圖文件
      for (const map of expiredMaps) {
        const fileName = `map_${map.id}.mbtiles`;
        const filePath = `${MAP_CACHE_DIR}${fileName}`;
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }

      // 更新存儲
      await AsyncStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify(validMaps));

      console.log(`Cleaned up ${expiredMaps.length} expired maps`);
    } catch (error) {
      console.error('Failed to cleanup expired maps:', error);
    }
  }

  /**
   * 導入 GPX 路線
   */
  static async importGPXRoute(
    gpxData: string,
    routeName: string,
    tags: string[] = []
  ): Promise<GPXRoute | null> {
    try {
      const route = this.parseGPXData(gpxData, routeName, tags);
      if (!route) return null;

      // 保存路線
      const routes = await this.getDownloadedRoutes();
      routes.push(route);
      await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes));

      // 保存 GPX 文件
      const fileName = `route_${route.id}.gpx`;
      const filePath = `${ROUTES_CACHE_DIR}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, gpxData);

      console.log(`Imported GPX route: ${routeName}`);
      return route;
    } catch (error) {
      console.error('Failed to import GPX route:', error);
      return null;
    }
  }

  /**
   * 解析 GPX 數據
   */
  private static parseGPXData(gpxData: string, routeName: string, tags: string[]): GPXRoute | null {
    try {
      // 簡化版本 - 實際應使用 GPX 解析庫
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxData, 'text/xml');

      const trkpts = xmlDoc.getElementsByTagName('trkpt');
      const coordinates: [number, number][] = [];
      let totalElevation = 0;
      let minElevation = Infinity;
      let maxElevation = -Infinity;

      for (let i = 0; i < trkpts.length; i++) {
        const lat = parseFloat(trkpts[i].getAttribute('lat') || '0');
        const lon = parseFloat(trkpts[i].getAttribute('lon') || '0');
        const ele = parseFloat(trkpts[i].getElementsByTagName('ele')[0]?.textContent || '0');

        coordinates.push([lon, lat]);
        minElevation = Math.min(minElevation, ele);
        maxElevation = Math.max(maxElevation, ele);
      }

      if (coordinates.length === 0) return null;

      // 計算距離（簡化版本）
      let distance = 0;
      for (let i = 1; i < coordinates.length; i++) {
        const [lon1, lat1] = coordinates[i - 1];
        const [lon2, lat2] = coordinates[i];
        distance += this.haversineDistance(lat1, lon1, lat2, lon2);
      }

      const elevation = maxElevation - minElevation;
      const estimatedTime = Math.round((distance / 20) * 3600); // 假設平均速度 20 km/h

      return {
        id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: routeName,
        track: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates,
          },
          properties: {},
        },
        distance,
        elevation,
        estimatedTime,
        difficulty: elevation > 500 ? 'hard' : elevation > 200 ? 'moderate' : 'easy',
        downloadedAt: Date.now(),
        tags,
      };
    } catch (error) {
      console.error('Failed to parse GPX data:', error);
      return null;
    }
  }

  /**
   * Haversine 距離計算
   */
  private static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // 地球半徑（米）
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 獲取已下載的路線
   */
  static async getDownloadedRoutes(): Promise<GPXRoute[]> {
    try {
      const data = await AsyncStorage.getItem(ROUTES_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get downloaded routes:', error);
      return [];
    }
  }

  /**
   * 刪除路線
   */
  static async deleteRoute(routeId: string): Promise<boolean> {
    try {
      const routes = await this.getDownloadedRoutes();
      const filtered = routes.filter((r) => r.id !== routeId);

      // 刪除文件
      const fileName = `route_${routeId}.gpx`;
      const filePath = `${ROUTES_CACHE_DIR}${fileName}`;
      await FileSystem.deleteAsync(filePath, { idempotent: true });

      // 更新存儲
      await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(filtered));

      return true;
    } catch (error) {
      console.error('Failed to delete route:', error);
      return false;
    }
  }

  /**
   * 搜索路線
   */
  static async searchRoutes(query: string): Promise<GPXRoute[]> {
    try {
      const routes = await this.getDownloadedRoutes();
      const lowerQuery = query.toLowerCase();

      return routes.filter(
        (r) =>
          r.name.toLowerCase().includes(lowerQuery) ||
          r.tags.some((t) => t.toLowerCase().includes(lowerQuery)) ||
          r.description?.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('Failed to search routes:', error);
      return [];
    }
  }

  /**
   * 獲取存儲使用情況
   */
  static async getStorageUsage(): Promise<{
    mapsSize: number;
    routesSize: number;
    totalSize: number;
  }> {
    try {
      const mapsInfo = await FileSystem.getInfoAsync(MAP_CACHE_DIR);
      const routesInfo = await FileSystem.getInfoAsync(ROUTES_CACHE_DIR);

      const mapsSize = (mapsInfo as any).size || 0;
      const routesSize = (routesInfo as any).size || 0;

      return {
        mapsSize,
        routesSize,
        totalSize: mapsSize + routesSize,
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { mapsSize: 0, routesSize: 0, totalSize: 0 };
    }
  }

  /**
   * 清空所有離線數據
   */
  static async clearAllOfflineData(): Promise<void> {
    try {
      await FileSystem.deleteAsync(MAP_CACHE_DIR, { idempotent: true });
      await FileSystem.deleteAsync(ROUTES_CACHE_DIR, { idempotent: true });
      await AsyncStorage.removeItem(MAPS_STORAGE_KEY);
      await AsyncStorage.removeItem(ROUTES_STORAGE_KEY);

      console.log('Cleared all offline data');
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }
}
