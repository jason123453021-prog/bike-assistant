import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RideStatistics {
  id: string;
  startTime: number;
  endTime: number;
  totalDistance: number; // 公尺
  totalTime: number; // 秒
  averageSpeed: number; // 公里/小時
  maxSpeed: number; // 公里/小時
  totalElevationGain: number; // 公尺
  totalElevationLoss: number; // 公尺
  routeName?: string;
  routeDescription?: string;
  trackPoints: Array<{
    lat: number;
    lon: number;
    altitude?: number;
    timestamp: number;
  }>;
  calories?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  timestamp: number;
  weather?: {
    temperature: number;
    condition: string;
    humidity: number;
  };
}

export interface RideHistory {
  rides: RideStatistics[];
  totalRides: number;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
}

const RIDE_STATISTICS_KEY = 'ride_statistics';
const RIDE_HISTORY_KEY = 'ride_history';

/**
 * 騎乘統計管理器
 * 功能：
 * - 收集和計算騎乘統計數據
 * - 保存騎乘記錄
 * - 查詢騎乘歷史
 * - 生成統計摘要
 */
export class RideStatisticsManager {
  private currentRide: Partial<RideStatistics> | null = null;
  private trackPoints: RideStatistics['trackPoints'] = [];

  /**
   * 開始新的騎乘
   */
  startRide(routeName?: string): void {
    this.currentRide = {
      id: `ride_${Date.now()}`,
      startTime: Date.now(),
      totalDistance: 0,
      totalTime: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      totalElevationGain: 0,
      totalElevationLoss: 0,
      routeName,
      trackPoints: [],
      timestamp: Date.now(),
    };
    this.trackPoints = [];

    console.log('[RideStatisticsManager] Ride started:', this.currentRide.id);
  }

  /**
   * 添加位置點
   */
  addTrackPoint(
    lat: number,
    lon: number,
    altitude?: number
  ): void {
    if (!this.currentRide) {
      console.warn('[RideStatisticsManager] No active ride');
      return;
    }

    const point = {
      lat,
      lon,
      altitude,
      timestamp: Date.now(),
    };

    this.trackPoints.push(point);

    // 更新距離和速度
    if (this.trackPoints.length > 1) {
      const prevPoint = this.trackPoints[this.trackPoints.length - 2];
      const distance = this.calculateDistance(
        prevPoint.lat,
        prevPoint.lon,
        lat,
        lon
      );

      const timeDiff = (point.timestamp - prevPoint.timestamp) / 1000; // 秒
      const speed = (distance / 1000) / (timeDiff / 3600); // 公里/小時

      this.currentRide.totalDistance! += distance;
      this.currentRide.maxSpeed = Math.max(
        this.currentRide.maxSpeed || 0,
        speed
      );

      // 計算海拔變化
      if (altitude !== undefined && prevPoint.altitude !== undefined) {
        const elevationDiff = altitude - prevPoint.altitude;
        if (elevationDiff > 0) {
          this.currentRide.totalElevationGain =
            (this.currentRide.totalElevationGain || 0) + elevationDiff;
        } else {
          this.currentRide.totalElevationLoss =
            (this.currentRide.totalElevationLoss || 0) - elevationDiff;
        }
      }
    }
  }

  /**
   * 結束騎乘
   */
  async endRide(): Promise<RideStatistics | null> {
    if (!this.currentRide) {
      console.warn('[RideStatisticsManager] No active ride');
      return null;
    }

    const endTime = Date.now();
    const totalTime = (endTime - this.currentRide.startTime!) / 1000; // 秒

    const statistics: RideStatistics = {
      id: this.currentRide.id!,
      startTime: this.currentRide.startTime!,
      endTime,
      totalDistance: this.currentRide.totalDistance || 0,
      totalTime,
      averageSpeed:
        this.currentRide.totalDistance && totalTime > 0
          ? ((this.currentRide.totalDistance / 1000) / (totalTime / 3600))
          : 0,
      maxSpeed: this.currentRide.maxSpeed || 0,
      totalElevationGain: this.currentRide.totalElevationGain || 0,
      totalElevationLoss: this.currentRide.totalElevationLoss || 0,
      routeName: this.currentRide.routeName,
      routeDescription: this.currentRide.routeDescription,
      trackPoints: this.trackPoints,
      timestamp: Date.now(),
    };

    // 保存到存儲
    await this.saveRideStatistics(statistics);

    this.currentRide = null;
    this.trackPoints = [];

    console.log('[RideStatisticsManager] Ride ended:', statistics.id);
    return statistics;
  }

  /**
   * 獲取當前騎乘統計
   */
  getCurrentRideStats(): Partial<RideStatistics> | null {
    if (!this.currentRide) {
      return null;
    }

    const now = Date.now();
    const totalTime = (now - this.currentRide.startTime!) / 1000;

    return {
      ...this.currentRide,
      totalTime,
      averageSpeed:
        this.currentRide.totalDistance && totalTime > 0
          ? ((this.currentRide.totalDistance / 1000) / (totalTime / 3600))
          : 0,
    };
  }

  /**
   * 保存騎乘統計
   */
  private async saveRideStatistics(stats: RideStatistics): Promise<void> {
    try {
      const history = await this.getRideHistory();
      history.rides.push(stats);

      // 更新總統計
      history.totalRides = history.rides.length;
      history.totalDistance = history.rides.reduce(
        (sum, ride) => sum + ride.totalDistance,
        0
      );
      history.totalTime = history.rides.reduce(
        (sum, ride) => sum + ride.totalTime,
        0
      );
      history.averageSpeed =
        history.totalDistance && history.totalTime > 0
          ? ((history.totalDistance / 1000) / (history.totalTime / 3600))
          : 0;

      await AsyncStorage.setItem(RIDE_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('[RideStatisticsManager] Error saving statistics:', error);
    }
  }

  /**
   * 獲取騎乘歷史
   */
  async getRideHistory(): Promise<RideHistory> {
    try {
      const data = await AsyncStorage.getItem(RIDE_HISTORY_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[RideStatisticsManager] Error loading history:', error);
    }

    return {
      rides: [],
      totalRides: 0,
      totalDistance: 0,
      totalTime: 0,
      averageSpeed: 0,
    };
  }

  /**
   * 獲取特定騎乘記錄
   */
  async getRideStatistics(rideId: string): Promise<RideStatistics | null> {
    try {
      const history = await this.getRideHistory();
      return history.rides.find((ride) => ride.id === rideId) || null;
    } catch (error) {
      console.error('[RideStatisticsManager] Error getting ride stats:', error);
      return null;
    }
  }

  /**
   * 刪除騎乘記錄
   */
  async deleteRideStatistics(rideId: string): Promise<void> {
    try {
      const history = await this.getRideHistory();
      history.rides = history.rides.filter((ride) => ride.id !== rideId);

      // 重新計算總統計
      history.totalRides = history.rides.length;
      history.totalDistance = history.rides.reduce(
        (sum, ride) => sum + ride.totalDistance,
        0
      );
      history.totalTime = history.rides.reduce(
        (sum, ride) => sum + ride.totalTime,
        0
      );
      history.averageSpeed =
        history.totalDistance && history.totalTime > 0
          ? ((history.totalDistance / 1000) / (history.totalTime / 3600))
          : 0;

      await AsyncStorage.setItem(RIDE_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('[RideStatisticsManager] Error deleting statistics:', error);
    }
  }

  /**
   * 計算兩點間距離（Haversine 公式）
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // 地球半徑（公尺）
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
   * 銷毀管理器
   */
  destroy(): void {
    this.currentRide = null;
    this.trackPoints = [];
    console.log('[RideStatisticsManager] Destroyed');
  }
}

// 全局單例
let managerInstance: RideStatisticsManager | null = null;

export function getRideStatisticsManager(): RideStatisticsManager {
  if (!managerInstance) {
    managerInstance = new RideStatisticsManager();
  }
  return managerInstance;
}
