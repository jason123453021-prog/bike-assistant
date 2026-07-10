import * as Location from 'expo-location';
import { EventEmitter } from 'events';
import { KalmanFilter, TrajectoryKalmanFilter, type FilteredLocation } from './kalman-filter';

/**
 * GPS 實時位置更新管理器
 * 
 * 功能：
 * - 實時 GPS 位置追蹤
 * - 可配置的更新頻率
 * - 位置歷史記錄
 * - 速度和方向計算
 * - 停止檢測
 */

export interface GPSLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number; // m/s
  heading?: number; // 0-360 度
  timestamp: number;
}

export interface LocationStats {
  totalDistance: number; // 公尺
  totalDuration: number; // 秒
  averageSpeed: number; // m/s
  maxSpeed: number; // m/s
  currentSpeed: number; // m/s
  currentHeading: number; // 0-360 度
  isMoving: boolean;
  stopDuration: number; // 秒
}

export interface TrackerConfig {
  updateInterval?: number; // 毫秒
  minAccuracy?: number; // 公尺
  minDistance?: number; // 公尺
  enableHighAccuracy?: boolean;
  maxAge?: number; // 毫秒
}

class GPSLocationTracker extends EventEmitter {
  private locations: GPSLocation[] = [];
  private filteredLocations: FilteredLocation[] = [];
  private isTracking = false;
  private subscription: Location.LocationSubscription | null = null;
  private config: Required<TrackerConfig> = {
    updateInterval: 1000, // 1 秒
    minAccuracy: 10, // 10 公尺
    minDistance: 5, // 5 公尺
    enableHighAccuracy: true,
    maxAge: 5000, // 5 秒
  };
  private lastValidLocation: GPSLocation | null = null;
  private stopStartTime: number | null = null;
  private kalmanFilter: KalmanFilter | null = null;
  private trajectoryFilter: TrajectoryKalmanFilter = new TrajectoryKalmanFilter();
  private enableKalmanFilter: boolean = true; // 可配置的 Kalman 濾波開關

  constructor(config?: TrackerConfig) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 開始追蹤
   */
  async startTracking(): Promise<void> {
    if (this.isTracking) {
      return;
    }

    try {
      // 請求位置權限
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      this.isTracking = true;
      this.locations = [];
      this.lastValidLocation = null;
      this.stopStartTime = null;

      // 訂閱位置更新
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: this.config.enableHighAccuracy
            ? Location.Accuracy.BestForNavigation
            : Location.Accuracy.Balanced,
          timeInterval: this.config.updateInterval,
          distanceInterval: this.config.minDistance,
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      this.emit('started');
    } catch (error) {
      this.isTracking = false;
      console.error('Failed to start tracking:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 停止追蹤
   */
  stopTracking(): void {
    if (!this.isTracking) {
      return;
    }

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    this.isTracking = false;
    this.kalmanFilter = null;
    this.trajectoryFilter.clear();
    this.emit('stopped');
  }

  /**
   * 設定是否啟用 Kalman 濾波器
   */
  setKalmanFilterEnabled(enabled: boolean): void {
    this.enableKalmanFilter = enabled;
    if (!enabled) {
      this.kalmanFilter = null;
      this.trajectoryFilter.clear();
    }
  }

  /**
   * 取得濾波後的位置
   */
  getFilteredLocations(): FilteredLocation[] {
    return [...this.filteredLocations];
  }

  /**
   * 處理位置更新
   */
  private handleLocationUpdate(location: Location.LocationObject): void {
    // 檢查精度
    if (
      location.coords.accuracy &&
      location.coords.accuracy > this.config.minAccuracy
    ) {
      return;
    }

    const gpsLocation: GPSLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude || undefined,
      accuracy: location.coords.accuracy || undefined,
      speed: location.coords.speed || undefined,
      heading: location.coords.heading || undefined,
      timestamp: location.timestamp,
    };

    // 計算速度和方向
    if (this.lastValidLocation) {
      const distance = this.calculateDistance(
        this.lastValidLocation.latitude,
        this.lastValidLocation.longitude,
        gpsLocation.latitude,
        gpsLocation.longitude
      );

      const timeDiff =
        (gpsLocation.timestamp - this.lastValidLocation.timestamp) / 1000; // 秒

      if (timeDiff > 0) {
        gpsLocation.speed = distance / timeDiff; // m/s

        // 計算方向
        gpsLocation.heading = this.calculateBearing(
          this.lastValidLocation.latitude,
          this.lastValidLocation.longitude,
          gpsLocation.latitude,
          gpsLocation.longitude
        );
      }

      // 檢測停止
      const isMoving = (gpsLocation.speed || 0) > 0.5; // 0.5 m/s 閾值
      if (!isMoving && !this.stopStartTime) {
        this.stopStartTime = gpsLocation.timestamp;
      } else if (isMoving && this.stopStartTime) {
        this.stopStartTime = null;
      }
    }

    // 應用 Kalman 濾波器
    let finalLocation = gpsLocation;
    if (this.enableKalmanFilter) {
      const filteredLoc = this.trajectoryFilter.addPoint({
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
        accuracy: gpsLocation.accuracy,
        timestamp: gpsLocation.timestamp,
      });

      if (filteredLoc) {
        // 更新位置為濾波後的值
        finalLocation = {
          ...gpsLocation,
          latitude: filteredLoc.latitude,
          longitude: filteredLoc.longitude,
          speed: filteredLoc.velocity,
        };
        this.filteredLocations.push(filteredLoc);
      }
    }

    this.locations.push(finalLocation);
    this.lastValidLocation = finalLocation;

    // 發出位置更新事件
    this.emit('location', finalLocation);
    this.emit('stats', this.getStats());
  }

  /**
   * 獲取統計信息
   */
  getStats(): LocationStats {
    let totalDistance = 0;
    let maxSpeed = 0;
    let currentSpeed = 0;
    let currentHeading = 0;

    for (let i = 1; i < this.locations.length; i++) {
      const prev = this.locations[i - 1];
      const curr = this.locations[i];

      const distance = this.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );

      totalDistance += distance;

      if (curr.speed) {
        maxSpeed = Math.max(maxSpeed, curr.speed);
        currentSpeed = curr.speed;
      }

      if (curr.heading) {
        currentHeading = curr.heading;
      }
    }

    const totalDuration = this.locations.length > 0
      ? (this.locations[this.locations.length - 1].timestamp -
          this.locations[0].timestamp) /
        1000
      : 0;

    const stopDuration = this.stopStartTime
      ? (Date.now() - this.stopStartTime) / 1000
      : 0;

    const isMoving = currentSpeed > 0.5; // 0.5 m/s 閾值

    return {
      totalDistance,
      totalDuration,
      averageSpeed: totalDuration > 0 ? totalDistance / totalDuration : 0,
      maxSpeed,
      currentSpeed,
      currentHeading,
      isMoving,
      stopDuration,
    };
  }

  /**
   * 取得原始位置
   */
  getLocations(): GPSLocation[] {
    return [...this.locations];
  }

  /**
   * 清除位置歷史
   */
  clearLocations(): void {
    this.locations = [];
    this.lastValidLocation = null;
    this.stopStartTime = null;
  }

  /**
   * 計算兩點之間的距離（Haversine 公式）
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
    return R * c; // 返回公尺
  }

  /**
   * 計算方向角（0-360 度）
   */
  private calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    return ((bearing * 180) / Math.PI + 360) % 360;
  }

  /**
   * 獲取追蹤狀態
   */
  isActive(): boolean {
    return this.isTracking;
  }
}

// 導出單例
export const gpsTracker = new GPSLocationTracker();
