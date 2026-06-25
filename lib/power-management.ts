/**
 * 功耗管理與動態休眠 (Power Management)
 * 
 * 核心機制：
 * 1. 動態感測器控制 (GPS、羅盤、加速度計)
 * 2. 螢幕更新頻率調整
 * 3. 電池狀態監控
 * 4. 效能模式管理 (省電、平衡、性能)
 * 5. 背景執行優化
 */

export enum PerformanceMode {
  POWER_SAVING = 'POWER_SAVING',   // 省電模式
  BALANCED = 'BALANCED',           // 平衡模式
  PERFORMANCE = 'PERFORMANCE',     // 性能模式
}

export enum SensorState {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  LOW_POWER = 'LOW_POWER',
}

interface PowerManagementConfig {
  // 效能模式
  defaultMode: PerformanceMode;
  
  // 電池閥值
  lowBatteryThreshold: number;     // %，預設 20
  criticalBatteryThreshold: number; // %，預設 10
  
  // 感測器控制閥值
  gpsHighSpeedThreshold: number;   // km/h，預設 15
  gpsLowSpeedThreshold: number;    // km/h，預設 6
  
  compassHighSpeedThreshold: number; // km/h，預設 10
  compassLowSpeedThreshold: number;  // km/h，預設 6
  
  accelHighSpeedThreshold: number;   // km/h，預設 15
  accelLowSpeedThreshold: number;    // km/h，預設 6
  
  // 螢幕更新頻率
  screenUpdateIntervalPowerSaving: number; // ms，預設 500
  screenUpdateIntervalBalanced: number;    // ms，預設 200
  screenUpdateIntervalPerformance: number; // ms，預設 100
}

interface SensorStatus {
  gps: SensorState;
  compass: SensorState;
  accelerometer: SensorState;
  screen: SensorState;
}

export class PowerManagement {
  private config: PowerManagementConfig;
  private currentMode: PerformanceMode;
  private sensorStatus: SensorStatus;
  private batteryLevel: number = 100;
  private lastUpdateTime: number = Date.now();

  constructor(config: Partial<PowerManagementConfig> = {}) {
    this.config = {
      defaultMode: PerformanceMode.BALANCED,
      lowBatteryThreshold: 20,
      criticalBatteryThreshold: 10,
      gpsHighSpeedThreshold: 15,
      gpsLowSpeedThreshold: 6,
      compassHighSpeedThreshold: 10,
      compassLowSpeedThreshold: 6,
      accelHighSpeedThreshold: 15,
      accelLowSpeedThreshold: 6,
      screenUpdateIntervalPowerSaving: 500,
      screenUpdateIntervalBalanced: 200,
      screenUpdateIntervalPerformance: 100,
      ...config,
    };

    this.currentMode = this.config.defaultMode;
    this.sensorStatus = {
      gps: SensorState.ENABLED,
      compass: SensorState.ENABLED,
      accelerometer: SensorState.ENABLED,
      screen: SensorState.ENABLED,
    };
  }

  /**
   * 根據電池百分比自動調整效能模式
   * 
   * @param batteryLevel 電池百分比 (0-100)
   * @returns 調整後的效能模式
   */
  public updateBatteryLevel(batteryLevel: number): PerformanceMode {
    this.batteryLevel = Math.max(0, Math.min(100, batteryLevel));

    // 根據電池百分比自動調整模式
    if (this.batteryLevel < this.config.criticalBatteryThreshold) {
      // 極低電量 - 強制省電模式
      this.currentMode = PerformanceMode.POWER_SAVING;
    } else if (this.batteryLevel < this.config.lowBatteryThreshold) {
      // 低電量 - 切換到省電模式
      this.currentMode = PerformanceMode.POWER_SAVING;
    } else if (this.batteryLevel > 80) {
      // 高電量 - 可以使用性能模式
      this.currentMode = PerformanceMode.PERFORMANCE;
    } else {
      // 中等電量 - 平衡模式
      this.currentMode = PerformanceMode.BALANCED;
    }

    return this.currentMode;
  }

  /**
   * 手動設定效能模式
   */
  public setPerformanceMode(mode: PerformanceMode): void {
    this.currentMode = mode;
  }

  /**
   * 獲取當前效能模式
   */
  public getPerformanceMode(): PerformanceMode {
    return this.currentMode;
  }

  /**
   * 根據速度動態控制 GPS
   * 
   * @param speed 當前速度 (km/h)
   * @returns GPS 應該的狀態
   */
  public getGpsState(speed: number): SensorState {
    if (this.currentMode === PerformanceMode.POWER_SAVING) {
      // 省電模式 - 降低 GPS 精度
      if (speed > this.config.gpsHighSpeedThreshold) {
        return SensorState.LOW_POWER;
      } else if (speed < this.config.gpsLowSpeedThreshold) {
        return SensorState.LOW_POWER;
      }
    }

    return SensorState.ENABLED;
  }

  /**
   * 根據速度動態控制羅盤
   * 
   * @param speed 當前速度 (km/h)
   * @returns 羅盤應該的狀態
   */
  public getCompassState(speed: number): SensorState {
    if (speed > this.config.compassHighSpeedThreshold) {
      // 高速時關閉羅盤 (GPS 航向已足夠精準)
      return SensorState.DISABLED;
    } else if (speed < this.config.compassLowSpeedThreshold) {
      // 低速時啟用羅盤
      return SensorState.ENABLED;
    }

    return this.sensorStatus.compass;
  }

  /**
   * 根據速度動態控制加速度計
   * 
   * @param speed 當前速度 (km/h)
   * @returns 加速度計應該的狀態
   */
  public getAccelerometerState(speed: number): SensorState {
    if (speed > this.config.accelHighSpeedThreshold) {
      // 高速時關閉加速度計 (不需要低速爬坡檢測)
      return SensorState.DISABLED;
    } else if (speed < this.config.accelLowSpeedThreshold) {
      // 低速時啟用加速度計 (用於低速爬坡檢測)
      return SensorState.ENABLED;
    }

    return this.sensorStatus.accelerometer;
  }

  /**
   * 獲取螢幕更新間隔
   * 
   * @returns 螢幕更新間隔 (ms)
   */
  public getScreenUpdateInterval(): number {
    switch (this.currentMode) {
      case PerformanceMode.POWER_SAVING:
        return this.config.screenUpdateIntervalPowerSaving;
      case PerformanceMode.PERFORMANCE:
        return this.config.screenUpdateIntervalPerformance;
      case PerformanceMode.BALANCED:
      default:
        return this.config.screenUpdateIntervalBalanced;
    }
  }

  /**
   * 更新感測器狀態
   */
  public updateSensorStatus(status: Partial<SensorStatus>): void {
    this.sensorStatus = {
      ...this.sensorStatus,
      ...status,
    };
  }

  /**
   * 獲取感測器狀態
   */
  public getSensorStatus(): SensorStatus {
    return { ...this.sensorStatus };
  }

  /**
   * 獲取電池百分比
   */
  public getBatteryLevel(): number {
    return this.batteryLevel;
  }

  /**
   * 判定是否為低電量狀態
   */
  public isLowBattery(): boolean {
    return this.batteryLevel < this.config.lowBatteryThreshold;
  }

  /**
   * 判定是否為極低電量狀態
   */
  public isCriticalBattery(): boolean {
    return this.batteryLevel < this.config.criticalBatteryThreshold;
  }

  /**
   * 獲取功耗管理統計信息
   */
  public getStats() {
    return {
      currentMode: this.currentMode,
      batteryLevel: this.batteryLevel,
      isLowBattery: this.isLowBattery(),
      isCriticalBattery: this.isCriticalBattery(),
      sensorStatus: this.sensorStatus,
      screenUpdateInterval: this.getScreenUpdateInterval(),
      config: this.config,
    };
  }

  /**
   * 重置狀態
   */
  public reset(): void {
    this.currentMode = this.config.defaultMode;
    this.batteryLevel = 100;
    this.sensorStatus = {
      gps: SensorState.ENABLED,
      compass: SensorState.ENABLED,
      accelerometer: SensorState.ENABLED,
      screen: SensorState.ENABLED,
    };
  }
}

/**
 * 使用示例：
 * 
 * const powerMgmt = new PowerManagement({
 *   defaultMode: PerformanceMode.BALANCED,
 *   lowBatteryThreshold: 20,
 * });
 * 
 * // 監控電池狀態
 * powerMgmt.updateBatteryLevel(batteryLevel);
 * 
 * // 根據速度動態控制感測器
 * const gpsState = powerMgmt.getGpsState(speed);
 * const compassState = powerMgmt.getCompassState(speed);
 * const accelState = powerMgmt.getAccelerometerState(speed);
 * 
 * // 調整螢幕更新頻率
 * const updateInterval = powerMgmt.getScreenUpdateInterval();
 * 
 * // 在低電量時提示使用者
 * if (powerMgmt.isLowBattery()) {
 *   showLowBatteryWarning();
 * }
 */
