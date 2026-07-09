import * as Location from 'expo-location';

/**
 * 實時位置共享管理器
 */
export class RealTimeLocationSharing {
  private static locationSubscription: any = null;
  private static currentLocation: any = null;
  private static buddyLocations: Map<string, any> = new Map();

  /**
   * 開始位置共享
   */
  static async startLocationSharing(onLocationUpdate?: (location: any) => void) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('位置權限被拒絕');
      }

      // 訂閱位置更新
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // 每 5 秒更新一次
          distanceInterval: 10, // 或距離變化 10 米時更新
        },
        (location) => {
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
            speed: location.coords.speed,
            heading: location.coords.heading,
          };

          onLocationUpdate?.(this.currentLocation);
        }
      );

      return true;
    } catch (error) {
      console.error('Failed to start location sharing:', error);
      return false;
    }
  }

  /**
   * 停止位置共享
   */
  static stopLocationSharing() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  /**
   * 獲取當前位置
   */
  static getCurrentLocation() {
    return this.currentLocation;
  }

  /**
   * 更新隊友位置
   */
  static updateBuddyLocation(buddyId: string, location: any) {
    this.buddyLocations.set(buddyId, {
      ...location,
      lastUpdated: Date.now(),
    });
  }

  /**
   * 獲取所有隊友位置
   */
  static getAllBuddyLocations() {
    return Array.from(this.buddyLocations.values());
  }

  /**
   * 計算兩點間距離（Haversine 公式）
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // 地球半徑（公里）
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 計算方向角
   */
  static calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = this.toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRad(lat2));
    const x =
      Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
      Math.sin(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    return (this.toDeg(bearing) + 360) % 360;
  }

  /**
   * 獲取隊友相對位置
   */
  static getBuddyRelativePosition(buddyId: string) {
    if (!this.currentLocation) {
      return null;
    }

    const buddy = this.buddyLocations.get(buddyId);
    if (!buddy) {
      return null;
    }

    const distance = this.calculateDistance(
      this.currentLocation.latitude,
      this.currentLocation.longitude,
      buddy.latitude,
      buddy.longitude
    );

    const bearing = this.calculateBearing(
      this.currentLocation.latitude,
      this.currentLocation.longitude,
      buddy.latitude,
      buddy.longitude
    );

    return {
      distance: distance * 1000, // 轉換為米
      bearing,
      direction: this.getDirectionName(bearing),
    };
  }

  /**
   * 獲取隊伍中心位置
   */
  static getTeamCenterLocation(buddyIds: string[]) {
    if (buddyIds.length === 0) {
      return this.currentLocation;
    }

    const locations = [
      this.currentLocation,
      ...buddyIds
        .map((id) => this.buddyLocations.get(id))
        .filter((loc) => loc !== undefined),
    ];

    const avgLat = locations.reduce((s, l) => s + l.latitude, 0) / locations.length;
    const avgLon = locations.reduce((s, l) => s + l.longitude, 0) / locations.length;

    return {
      latitude: avgLat,
      longitude: avgLon,
      timestamp: Date.now(),
    };
  }

  /**
   * 檢查隊伍是否聚集
   */
  static isTeamClustered(buddyIds: string[], maxDistance: number = 1000): boolean {
    if (buddyIds.length === 0) {
      return true;
    }

    const center = this.getTeamCenterLocation(buddyIds);

    return [this.currentLocation, ...buddyIds.map((id) => this.buddyLocations.get(id))]
      .filter((loc) => loc !== undefined)
      .every((loc) => {
        const distance = this.calculateDistance(
          center.latitude,
          center.longitude,
          loc.latitude,
          loc.longitude
        );
        return distance * 1000 <= maxDistance;
      });
  }

  private static toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private static toDeg(rad: number): number {
    return (rad * 180) / Math.PI;
  }

  private static getDirectionName(bearing: number): string {
    const directions = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }
}
