/**
 * 車頭朝前視角鎖定管理模組
 * 處理地圖旋轉角度、指南針方向、移動向量等
 */

export interface HeadingState {
  enabled: boolean;
  currentHeading: number; // 0-360 度
  compassHeading: number; // 指南針方向
  movementHeading: number; // 移動向量方向
  useCompass: boolean; // 是否使用指南針
  useMovement: boolean; // 是否使用移動向量
  smoothingFactor: number; // 平滑因子 0-1
}

export interface LocationData {
  lat: number;
  lon: number;
  timestamp: number;
}

/**
 * 車頭朝前視角鎖定管理器
 */
export class HeadingLockManager {
  private state: HeadingState;
  private previousLocation: LocationData | null = null;
  private headingHistory: number[] = [];
  private maxHistorySize: number = 5;

  constructor() {
    this.state = {
      enabled: false,
      currentHeading: 0,
      compassHeading: 0,
      movementHeading: 0,
      useCompass: true,
      useMovement: true,
      smoothingFactor: 0.3,
    };
  }

  /**
   * 啟用/禁用車頭朝前模式
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    if (!enabled) {
      this.previousLocation = null;
      this.headingHistory = [];
    }
  }

  /**
   * 更新指南針方向
   */
  updateCompassHeading(heading: number): void {
    this.state.compassHeading = this.normalizeHeading(heading);
    this.updateCurrentHeading();
  }

  /**
   * 更新位置並計算移動向量方向
   */
  updateLocation(location: LocationData): void {
    if (this.previousLocation) {
      const movementHeading = this.calculateMovementHeading(
        this.previousLocation.lat,
        this.previousLocation.lon,
        location.lat,
        location.lon
      );

      // 檢查是否靜止（速度 < 1 km/h）
      if (!this.isStationary(this.previousLocation, location)) {
        this.state.movementHeading = movementHeading;
      }
    }

    this.previousLocation = location;
    this.updateCurrentHeading();
  }

  /**
   * 計算移動向量方向（bearing）
   */
  private calculateMovementHeading(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return this.normalizeHeading(bearing);
  }

  /**
   * 檢查是否靜止（速度 < 1 km/h）
   */
  private isStationary(prev: LocationData, curr: LocationData): boolean {
    const distance = this.calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    const timeDelta = (curr.timestamp - prev.timestamp) / 1000; // 秒

    if (timeDelta <= 0) return true;

    const speedKmh = (distance / 1000 / timeDelta) * 3.6;
    return speedKmh < 1;
  }

  /**
   * Haversine 公式：計算兩點間的距離（米）
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // 地球半徑（米）
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 更新當前方向（融合指南針和移動向量）
   */
  private updateCurrentHeading(): void {
    if (!this.state.enabled) return;

    let heading = 0;

    if (this.state.useCompass && this.state.useMovement) {
      // 融合指南針和移動向量
      // 如果速度足夠快，優先使用移動向量；否則使用指南針
      const isMoving = this.state.movementHeading !== 0;
      if (isMoving) {
        heading = this.state.movementHeading;
      } else {
        heading = this.state.compassHeading;
      }
    } else if (this.state.useCompass) {
      heading = this.state.compassHeading;
    } else if (this.state.useMovement) {
      heading = this.state.movementHeading;
    }

    // 應用平滑
    heading = this.smoothHeading(heading);
    this.state.currentHeading = this.normalizeHeading(heading);
  }

  /**
   * 平滑方向變化
   */
  private smoothHeading(newHeading: number): number {
    this.headingHistory.push(newHeading);

    if (this.headingHistory.length > this.maxHistorySize) {
      this.headingHistory.shift();
    }

    // 計算加權平均
    let sum = 0;
    let weightSum = 0;

    for (let i = 0; i < this.headingHistory.length; i++) {
      const weight = (i + 1) / this.headingHistory.length;
      sum += this.headingHistory[i] * weight;
      weightSum += weight;
    }

    return sum / weightSum;
  }

  /**
   * 正規化方向角（0-360）
   */
  private normalizeHeading(heading: number): number {
    return ((heading % 360) + 360) % 360;
  }

  /**
   * 獲取當前方向
   */
  getCurrentHeading(): number {
    return this.state.currentHeading;
  }

  /**
   * 獲取當前狀態
   */
  getState(): HeadingState {
    return { ...this.state };
  }

  /**
   * 設置平滑因子
   */
  setSmoothingFactor(factor: number): void {
    this.state.smoothingFactor = Math.max(0, Math.min(1, factor));
  }

  /**
   * 重置管理器
   */
  reset(): void {
    this.previousLocation = null;
    this.headingHistory = [];
    this.state.currentHeading = 0;
    this.state.movementHeading = 0;
  }
}

/**
 * 角度轉弧度
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * 計算兩個方向之間的最小角度差
 */
export function calculateHeadingDifference(heading1: number, heading2: number): number {
  let diff = heading2 - heading1;
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }
  return diff;
}

/**
 * 檢測方向變化是否超過閾值
 */
export function hasSignificantHeadingChange(
  prevHeading: number,
  currHeading: number,
  threshold: number = 10 // 度
): boolean {
  const diff = Math.abs(calculateHeadingDifference(prevHeading, currHeading));
  return diff > threshold;
}

/**
 * 計算指北方向的旋轉角度
 */
export function calculateNorthRotation(currentHeading: number): number {
  return -currentHeading; // 負值表示逆時針旋轉
}

/**
 * 計算車頭朝前方向的旋轉角度
 */
export function calculateHeadingRotation(currentHeading: number): number {
  return -currentHeading; // 負值表示逆時針旋轉
}
