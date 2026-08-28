/**
 * 車頭朝前地圖跟隨視角鎖定系統
 * 實時連動 GPS/指南針方向，動態鎖定用戶為地圖中心
 */

export interface HeadingLockConfig {
  enabled: boolean;
  useCompass: boolean; // 使用指南針
  useGPS: boolean; // 使用 GPS 方向
  smoothingFactor: number; // 平滑係數 (0-1)
  staticThreshold: number; // 靜止速度閾值 (km/h)
  compassWeight: number; // 指南針權重 (0-1)
  gpsWeight: number; // GPS 權重 (0-1)
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  heading?: number; // GPS 方向 (0-360)
  speed?: number; // 速度 (m/s)
  accuracy?: number; // 精度 (米)
}

export interface CompassUpdate {
  heading: number; // 指南針方向 (0-360)
  accuracy?: number; // 精度
}

export interface MapViewState {
  latitude: number;
  longitude: number;
  heading: number; // 地圖旋轉角度 (0-360)
  zoom: number;
  pitch: number;
}

export class HeadingLockManager {
  private config: HeadingLockConfig;
  private currentHeading: number = 0;
  private smoothedHeading: number = 0;
  private lastHeading: number = 0;
  private isStatic: boolean = false;
  private staticCounter: number = 0;
  private staticThresholdCount: number = 3; // 連續 3 次低速判定為靜止

  constructor(config: Partial<HeadingLockConfig> = {}) {
    this.config = {
      enabled: true,
      useCompass: true,
      useGPS: true,
      smoothingFactor: 0.3,
      staticThreshold: 1, // 1 km/h
      compassWeight: 0.6,
      gpsWeight: 0.4,
      ...config,
    };
  }

  /**
   * 更新位置信息（GPS）
   */
  updateLocation(location: LocationUpdate): MapViewState {
    const speedKmh = (location.speed || 0) * 3.6; // m/s 轉換為 km/h

    // 檢測靜止狀態
    if (speedKmh < this.config.staticThreshold) {
      this.staticCounter++;
      if (this.staticCounter >= this.staticThresholdCount) {
        this.isStatic = true;
      }
    } else {
      this.staticCounter = 0;
      this.isStatic = false;
    }

    // 如果有 GPS 方向且不是靜止狀態，使用 GPS 方向
    if (location.heading !== undefined && !this.isStatic && this.config.useGPS) {
      this.currentHeading = location.heading;
    }

    // 應用平滑過濾
    this.smoothedHeading = this.applySmoothingFilter(this.currentHeading);

    return {
      latitude: location.latitude,
      longitude: location.longitude,
      heading: this.smoothedHeading,
      zoom: 18, // 騎乘時的推薦縮放級別
      pitch: 45, // 3D 視角傾斜度
    };
  }

  /**
   * 更新指南針信息
   */
  updateCompass(compass: CompassUpdate): number {
    if (!this.config.useCompass) {
      return this.smoothedHeading;
    }

    // 靜止時使用指南針方向
    if (this.isStatic) {
      this.currentHeading = compass.heading;
    } else if (this.config.useGPS && this.config.useCompass) {
      // 移動時混合 GPS 和指南針方向
      this.currentHeading = this.blendHeadings(
        this.currentHeading,
        compass.heading,
        this.config.gpsWeight,
        this.config.compassWeight
      );
    }

    // 應用平滑過濾
    this.smoothedHeading = this.applySmoothingFilter(this.currentHeading);
    return this.smoothedHeading;
  }

  /**
   * 應用平滑過濾（指數移動平均）
   */
  private applySmoothingFilter(newHeading: number): number {
    // 處理 360° 邊界情況
    let delta = newHeading - this.lastHeading;
    if (delta > 180) {
      delta -= 360;
    } else if (delta < -180) {
      delta += 360;
    }

    const smoothed = this.lastHeading + delta * this.config.smoothingFactor;
    this.lastHeading = smoothed;

    // 確保結果在 0-360 範圍內
    return ((smoothed % 360) + 360) % 360;
  }

  /**
   * 混合 GPS 和指南針方向
   */
  private blendHeadings(
    gpsHeading: number,
    compassHeading: number,
    gpsWeight: number,
    compassWeight: number
  ): number {
    // 計算兩個方向之間的最短角度差
    let diff = compassHeading - gpsHeading;
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }

    // 加權混合
    const blended = gpsHeading + diff * (compassWeight / (gpsWeight + compassWeight));

    // 確保結果在 0-360 範圍內
    return ((blended % 360) + 360) % 360;
  }

  /**
   * 獲取當前方向
   */
  getCurrentHeading(): number {
    return this.smoothedHeading;
  }

  /**
   * 獲取靜止狀態
   */
  isStationary(): boolean {
    return this.isStatic;
  }

  /**
   * 設定配置
   */
  setConfig(config: Partial<HeadingLockConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 獲取配置
   */
  getConfig(): HeadingLockConfig {
    return { ...this.config };
  }

  /**
   * 重置狀態
   */
  reset(): void {
    this.currentHeading = 0;
    this.smoothedHeading = 0;
    this.lastHeading = 0;
    this.isStatic = false;
    this.staticCounter = 0;
  }

  /**
   * 計算地圖視角（包含中心點和旋轉）
   */
  calculateMapView(
    latitude: number,
    longitude: number,
    zoom: number = 18
  ): MapViewState {
    return {
      latitude,
      longitude,
      heading: this.smoothedHeading,
      zoom,
      pitch: 45,
    };
  }

  /**
   * 獲取靜止防抖統計信息
   */
  getDebounceStats(): {
    isStatic: boolean;
    staticCounter: number;
    currentHeading: number;
    smoothedHeading: number;
  } {
    return {
      isStatic: this.isStatic,
      staticCounter: this.staticCounter,
      currentHeading: this.currentHeading,
      smoothedHeading: this.smoothedHeading,
    };
  }
}

/**
 * 計算方向角度差異
 */
export function calculateHeadingDifference(heading1: number, heading2: number): number {
  let diff = heading2 - heading1;
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }
  return Math.abs(diff);
}

/**
 * 規範化方向角度到 0-360 範圍
 */
export function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

/**
 * 判斷方向是否發生顯著變化
 */
export function hasSignificantHeadingChange(
  oldHeading: number,
  newHeading: number,
  threshold: number = 5 // 5 度
): boolean {
  return calculateHeadingDifference(oldHeading, newHeading) > threshold;
}
