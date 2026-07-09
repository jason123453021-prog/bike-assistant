import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feature, LineString, Point } from 'geojson';

export interface RideRecord {
  id: string;
  startTime: number; // 時間戳
  endTime: number;
  duration: number; // 秒
  distance: number; // 米
  averageSpeed: number; // km/h
  maxSpeed: number; // km/h
  averagePower: number; // 瓦
  maxPower: number; // 瓦
  calories: number; // kcal
  elevation: number; // 米
  track: Feature<LineString>; // 騎乘軌跡
  weather?: {
    temperature: number;
    humidity: number;
    windSpeed: number;
  };
  notes?: string;
}

const STORAGE_KEY = 'bike_assistant_ride_records';
const MAX_RECORDS = 100;

export class RideRecordManager {
  /**
   * 保存騎乘記錄
   * @param record 騎乘記錄
   * @returns 記錄 ID
   */
  static async saveRideRecord(record: Omit<RideRecord, 'id'>): Promise<string> {
    try {
      const records = await this.getAllRecords();
      
      // 生成唯一 ID
      const id = `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newRecord: RideRecord = {
        ...record,
        id,
      };

      // 添加到記錄列表
      records.unshift(newRecord);

      // 保留最近 100 條記錄
      if (records.length > MAX_RECORDS) {
        records.pop();
      }

      // 保存到存儲
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));

      return id;
    } catch (error) {
      console.error('Failed to save ride record:', error);
      throw error;
    }
  }

  /**
   * 獲取所有騎乘記錄
   * @returns 騎乘記錄數組
   */
  static async getAllRecords(): Promise<RideRecord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get ride records:', error);
      return [];
    }
  }

  /**
   * 獲取單條騎乘記錄
   * @param id 記錄 ID
   * @returns 騎乘記錄或 null
   */
  static async getRideRecord(id: string): Promise<RideRecord | null> {
    try {
      const records = await this.getAllRecords();
      return records.find((r) => r.id === id) || null;
    } catch (error) {
      console.error('Failed to get ride record:', error);
      return null;
    }
  }

  /**
   * 刪除騎乘記錄
   * @param id 記錄 ID
   */
  static async deleteRideRecord(id: string): Promise<void> {
    try {
      const records = await this.getAllRecords();
      const filtered = records.filter((r) => r.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to delete ride record:', error);
      throw error;
    }
  }

  /**
   * 獲取統計數據
   * @returns 統計數據
   */
  static async getStatistics() {
    try {
      const records = await this.getAllRecords();

      if (records.length === 0) {
        return {
          totalRides: 0,
          totalDistance: 0,
          totalDuration: 0,
          totalCalories: 0,
          averageSpeed: 0,
          maxSpeed: 0,
          averagePower: 0,
        };
      }

      const totalDistance = records.reduce((sum, r) => sum + r.distance, 0);
      const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
      const totalCalories = records.reduce((sum, r) => sum + r.calories, 0);
      const maxSpeed = Math.max(...records.map((r) => r.maxSpeed));
      const averageSpeed = totalDistance / (totalDuration / 3600);
      const averagePower = records.reduce((sum, r) => sum + r.averagePower, 0) / records.length;

      return {
        totalRides: records.length,
        totalDistance,
        totalDuration,
        totalCalories,
        averageSpeed,
        maxSpeed,
        averagePower,
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return null;
    }
  }

  /**
   * 獲取最近 N 條記錄
   * @param count 記錄數量
   * @returns 騎乘記錄數組
   */
  static async getRecentRecords(count: number = 10): Promise<RideRecord[]> {
    try {
      const records = await this.getAllRecords();
      return records.slice(0, count);
    } catch (error) {
      console.error('Failed to get recent records:', error);
      return [];
    }
  }

  /**
   * 按日期範圍獲取記錄
   * @param startDate 開始日期
   * @param endDate 結束日期
   * @returns 騎乘記錄數組
   */
  static async getRecordsByDateRange(startDate: Date, endDate: Date): Promise<RideRecord[]> {
    try {
      const records = await this.getAllRecords();
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();

      return records.filter((r) => r.startTime >= startTime && r.startTime <= endTime);
    } catch (error) {
      console.error('Failed to get records by date range:', error);
      return [];
    }
  }

  /**
   * 導出記錄為 JSON
   * @param id 記錄 ID
   * @returns JSON 字符串
   */
  static async exportRecordAsJSON(id: string): Promise<string | null> {
    try {
      const record = await this.getRideRecord(id);
      if (!record) return null;

      return JSON.stringify(record, null, 2);
    } catch (error) {
      console.error('Failed to export record:', error);
      return null;
    }
  }

  /**
   * 導出記錄為 GPX
   * @param id 記錄 ID
   * @returns GPX 字符串
   */
  static async exportRecordAsGPX(id: string): Promise<string | null> {
    try {
      const record = await this.getRideRecord(id);
      if (!record) return null;

      const coordinates = record.track.geometry.coordinates as [number, number][];
      const startDate = new Date(record.startTime).toISOString();

      let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Bike Assistant">
  <metadata>
    <time>${startDate}</time>
  </metadata>
  <trk>
    <name>Ride ${record.id}</name>
    <trkseg>`;

      for (const [lon, lat] of coordinates) {
        gpx += `
      <trkpt lat="${lat}" lon="${lon}">
        <time>${startDate}</time>
      </trkpt>`;
      }

      gpx += `
    </trkseg>
  </trk>
</gpx>`;

      return gpx;
    } catch (error) {
      console.error('Failed to export record as GPX:', error);
      return null;
    }
  }

  /**
   * 清空所有記錄
   */
  static async clearAllRecords(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear records:', error);
      throw error;
    }
  }
}
