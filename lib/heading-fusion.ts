/**
 * GPS 與羅盤融合導航 (Heading Fusion)
 * 
 * 核心機制：
 * 1. GPS 航向 (Course / Bearing) - 高速時精準
 * 2. 電子羅盤朝向 (Heading) - 低速/靜止時準確
 * 3. 速度切換演算法 (5 km/h 臨界點)
 * 4. 低通濾波平滑處理
 * 5. 震動過濾 (< 3-5 度變化忽略)
 */

interface HeadingFusionConfig {
  // 速度切換臨界點
  speedThreshold: number;           // km/h，預設 5
  
  // 低通濾波
  smoothingFactor: number;          // 0-1，預設 0.2 (較低 = 更平滑)
  
  // 震動過濾
  minHeadingChange: number;         // 度數，預設 3
  
  // 手機安裝角度補償
  displayOrientationOffset: number; // 度數，預設 0
  
  // 導航省電優化
  highSpeedThreshold: number;       // 高速關閉羅盤 (km/h)，預設 10
  lowSpeedThreshold: number;        // 低速重啟羅盤 (km/h)，預設 6
}

export class HeadingFusion {
  private config: HeadingFusionConfig;
  private currentHeading: number = 0;           // 當前方位角 (0-360)
  private targetHeading: number = 0;            // 目標方位角
  private lastSmoothedHeading: number = 0;      // 上次平滑後的方位角
  private lastRawHeading: number = 0;           // 上次原始方位角
  private compassEnabled: boolean = true;       // 羅盤是否啟用
  private lastUpdateTime: number = Date.now();

  constructor(config: Partial<HeadingFusionConfig> = {}) {
    this.config = {
      speedThreshold: 5,
      smoothingFactor: 0.2,
      minHeadingChange: 3,
      displayOrientationOffset: 0,
      highSpeedThreshold: 10,
      lowSpeedThreshold: 6,
      ...config,
    };
  }

  /**
   * 計算兩個角度之間的最短差值
   * 例如：359° 到 1° 的差值應為 2°，而不是 358°
   */
  private getAngleDifference(angle1: number, angle2: number): number {
    let diff = angle2 - angle1;
    
    // 將差值標準化到 [-180, 180] 範圍
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }
    
    return diff;
  }

  /**
   * 標準化角度到 [0, 360) 範圍
   */
  private normalizeAngle(angle: number): number {
    let normalized = angle % 360;
    if (normalized < 0) {
      normalized += 360;
    }
    return normalized;
  }

  /**
   * 低通濾波平滑處理
   * 使用指數移動平均 (Exponential Moving Average)
   */
  private smoothHeading(rawHeading: number, previousSmoothed: number): number {
    const diff = this.getAngleDifference(previousSmoothed, rawHeading);
    return this.normalizeAngle(previousSmoothed + diff * this.config.smoothingFactor);
  }

  /**
   * 震動過濾 - 如果角度變化小於閥值，忽略更新
   */
  private shouldUpdateHeading(newHeading: number, lastHeading: number): boolean {
    const diff = Math.abs(this.getAngleDifference(lastHeading, newHeading));
    return diff >= this.config.minHeadingChange;
  }

  /**
   * 手機安裝角度補償
   * 根據顯示方向調整羅盤讀數
   * 
   * @param compassHeading 原始羅盤讀數 (0-360)
   * @param displayOrientation 顯示方向 ('portrait' | 'landscape')
   * @returns 補償後的方位角
   */
  private applyDisplayOrientationOffset(
    compassHeading: number,
    displayOrientation: 'portrait' | 'landscape' = 'portrait'
  ): number {
    let offset = 0;
    
    if (displayOrientation === 'landscape') {
      // 橫屏時需要旋轉 90 度
      offset = 90;
    }
    
    offset += this.config.displayOrientationOffset;
    return this.normalizeAngle(compassHeading + offset);
  }

  /**
   * 更新方位角 - 核心融合邏輯
   * 
   * @param speed 當前速度 (km/h)
   * @param gpsHeading GPS 航向 (0-360)
   * @param compassHeading 電子羅盤朝向 (0-360)
   * @param displayOrientation 顯示方向
   * @returns 融合後的方位角 (0-360)
   */
  public updateHeading(
    speed: number,
    gpsHeading: number,
    compassHeading: number,
    displayOrientation: 'portrait' | 'landscape' = 'portrait'
  ): number {
    // 應用手機安裝角度補償
    const adjustedCompassHeading = this.applyDisplayOrientationOffset(
      compassHeading,
      displayOrientation
    );

    // 根據速度選擇數據來源
    if (speed > this.config.speedThreshold) {
      // 高速：使用 GPS 航向
      this.targetHeading = gpsHeading;
      this.compassEnabled = false;
    } else {
      // 低速/靜止：使用羅盤朝向
      this.targetHeading = adjustedCompassHeading;
      this.compassEnabled = true;
    }

    // 震動過濾 - 檢查是否應該更新
    if (!this.shouldUpdateHeading(this.targetHeading, this.lastRawHeading)) {
      return this.currentHeading;
    }

    // 低通濾波平滑處理
    const smoothedHeading = this.smoothHeading(this.targetHeading, this.lastSmoothedHeading);

    // 更新內部狀態
    this.currentHeading = smoothedHeading;
    this.lastSmoothedHeading = smoothedHeading;
    this.lastRawHeading = this.targetHeading;
    this.lastUpdateTime = Date.now();

    return this.currentHeading;
  }

  /**
   * 導航省電優化 - 根據速度動態控制羅盤
   * 
   * @param speed 當前速度 (km/h)
   * @returns 羅盤是否應該啟用
   */
  public shouldEnableCompass(speed: number): boolean {
    if (speed > this.config.highSpeedThreshold) {
      // 高速時關閉羅盤
      return false;
    } else if (speed < this.config.lowSpeedThreshold) {
      // 低速時啟用羅盤
      return true;
    } else {
      // 中速時保持當前狀態
      return this.compassEnabled;
    }
  }

  /**
   * 獲取當前方位角
   */
  public getHeading(): number {
    return this.currentHeading;
  }

  /**
   * 獲取目標方位角 (未平滑)
   */
  public getTargetHeading(): number {
    return this.targetHeading;
  }

  /**
   * 獲取羅盤啟用狀態
   */
  public isCompassEnabled(): boolean {
    return this.compassEnabled;
  }

  /**
   * 獲取融合統計信息 (用於調試)
   */
  public getStats() {
    return {
      currentHeading: this.currentHeading,
      targetHeading: this.targetHeading,
      lastSmoothedHeading: this.lastSmoothedHeading,
      compassEnabled: this.compassEnabled,
      lastUpdateTime: this.lastUpdateTime,
      config: this.config,
    };
  }

  /**
   * 重置狀態
   */
  public reset(): void {
    this.currentHeading = 0;
    this.targetHeading = 0;
    this.lastSmoothedHeading = 0;
    this.lastRawHeading = 0;
    this.compassEnabled = true;
    this.lastUpdateTime = Date.now();
  }
}

/**
 * 使用示例：
 * 
 * const fusion = new HeadingFusion({
 *   speedThreshold: 5,
 *   smoothingFactor: 0.2,
 *   minHeadingChange: 3,
 * });
 * 
 * // 每次位置/羅盤更新時調用
 * const mapHeading = fusion.updateHeading(
 *   speed,
 *   gpsHeading,
 *   compassHeading,
 *   'portrait'
 * );
 * 
 * // 更新地圖方位角
 * mapView.setHeading(mapHeading);
 * 
 * // 根據速度動態控制羅盤功耗
 * if (!fusion.shouldEnableCompass(speed)) {
 *   compassManager.disable();
 * } else {
 *   compassManager.enable();
 * }
 */
