/**
 * Android 優化管理器 (Android Optimization Manager)
 * 
 * 統一管理所有優化模組：
 * 1. 自動暫停狀態機 (AutoPauseFSM)
 * 2. GPS 與羅盤融合 (HeadingFusion)
 * 3. 加速度計感測器融合 (AccelerometerFusion)
 * 4. 功耗管理 (PowerManagement)
 */

import { AutoPauseFSM, RideState as AutoPauseRideState } from './auto-pause-fsm';
import { HeadingFusion } from './heading-fusion';
import { AccelerometerFusion } from './accelerometer-fusion';
import { PowerManagement, PerformanceMode, SensorState } from './power-management';

export interface AndroidOptimizationConfig {
  // 自動暫停配置
  autoPauseConfig?: {
    pauseThreshold?: number;
    resumeThreshold?: number;
    accelerometerThreshold?: number;
    bufferDuration?: number;
  };

  // 導航融合配置
  headingFusionConfig?: {
    speedThreshold?: number;
    smoothingFactor?: number;
    minHeadingChange?: number;
  };

  // 加速度計配置
  accelerometerConfig?: {
    samplingRate?: number;
    energyThreshold?: number;
  };

  // 功耗管理配置
  powerManagementConfig?: {
    defaultMode?: PerformanceMode;
    lowBatteryThreshold?: number;
  };
}

export interface RideState {
  speed: number;                    // km/h
  gpsHeading: number;               // 0-360
  compassHeading: number;           // 0-360
  accelX: number;                   // m/s²
  accelY: number;                   // m/s²
  accelZ: number;                   // m/s²
  batteryLevel: number;             // 0-100
  timestamp: number;                // ms
}

export class AndroidOptimizationManager {
  private autoPauseFsm: AutoPauseFSM;
  private headingFusion: HeadingFusion;
  private accelerometerFusion: AccelerometerFusion;
  private powerManagement: PowerManagement;

  // 回調函數
  public onAutoPauseStateChanged?: (state: RideState) => void;
  public onHeadingUpdated?: (heading: number) => void;
  public onPowerModeChanged?: (mode: PerformanceMode) => void;
  public onSensorStatusChanged?: (status: any) => void;

  constructor(config: AndroidOptimizationConfig = {}) {
    // 初始化各個優化模組
    this.autoPauseFsm = new AutoPauseFSM(config.autoPauseConfig);
    this.headingFusion = new HeadingFusion(config.headingFusionConfig);
    this.accelerometerFusion = new AccelerometerFusion(config.accelerometerConfig);
    this.powerManagement = new PowerManagement(config.powerManagementConfig);

    // 設定回調
    this.autoPauseFsm.onStateChanged = (newState) => {
      this.onAutoPauseStateChanged?.(newState as any);
    };
  }

  /**
   * 更新騎乘狀態 - 核心方法
   * 
   * @param rideState 當前騎乘狀態
   * @returns 更新後的優化結果
   */
  public updateRideState(rideState: RideState) {
    // 1. 更新功耗管理 (電池狀態)
    const previousMode = this.powerManagement.getPerformanceMode();
    const newMode = this.powerManagement.updateBatteryLevel(rideState.batteryLevel);
    
    if (previousMode !== newMode) {
      this.onPowerModeChanged?.(newMode);
    }

    // 2. 更新自動暫停狀態機
    const autoPauseState = this.autoPauseFsm.updateSpeed(
      rideState.speed,
      rideState.timestamp,
      rideState.accelX,
      rideState.accelY,
      rideState.accelZ
    );

    // 3. 更新加速度計融合
    this.accelerometerFusion.updateAccelerometer(
      rideState.accelX,
      rideState.accelY,
      rideState.accelZ,
      rideState.timestamp
    );

    // 4. 根據速度調整加速度計採樣率 (功耗優化)
    const optimalSamplingRate = this.accelerometerFusion.getOptimalSamplingRate(rideState.speed);

    // 5. 更新 GPS 與羅盤融合
    const mapHeading = this.headingFusion.updateHeading(
      rideState.speed,
      rideState.gpsHeading,
      rideState.compassHeading,
      'portrait'
    );

    this.onHeadingUpdated?.(mapHeading);

    // 6. 獲取感測器狀態建議
    const gpsState = this.powerManagement.getGpsState(rideState.speed);
    const compassState = this.powerManagement.getCompassState(rideState.speed);
    const accelState = this.powerManagement.getAccelerometerState(rideState.speed);

    return {
      autoPauseState,
      mapHeading,
      optimalSamplingRate,
      sensorStates: {
        gps: gpsState,
        compass: compassState,
        accelerometer: accelState,
      },
      powerMode: newMode,
      screenUpdateInterval: this.powerManagement.getScreenUpdateInterval(),
    };
  }

  /**
   * 獲取完整的優化統計信息
   */
  public getOptimizationStats() {
    return {
      autoPause: this.autoPauseFsm.getStats(),
      heading: this.headingFusion.getStats(),
      accelerometer: this.accelerometerFusion.getStats(),
      powerManagement: this.powerManagement.getStats(),
    };
  }

  /**
   * 判定是否應該暫停騎乘
   */
  public shouldAutoPause(): boolean {
    return this.autoPauseFsm.getState() === AutoPauseRideState.AUTO_PAUSED;
  }

  /**
   * 判定是否在低速爬坡
   */
  public isLowSpeedClimbing(speed: number): boolean {
    return this.accelerometerFusion.isMovingByAccelerometer(speed);
  }

  /**
   * 獲取當前羅盤啟用狀態
   */
  public isCompassEnabled(): boolean {
    return this.headingFusion.isCompassEnabled();
  }

  /**
   * 獲取當前效能模式
   */
  public getPerformanceMode(): PerformanceMode {
    return this.powerManagement.getPerformanceMode();
  }

  /**
   * 手動設定效能模式
   */
  public setPerformanceMode(mode: PerformanceMode): void {
    this.powerManagement.setPerformanceMode(mode);
    this.onPowerModeChanged?.(mode);
  }

  /**
   * 判定是否為低電量狀態
   */
  public isLowBattery(): boolean {
    return this.powerManagement.isLowBattery();
  }

  /**
   * 重置所有模組
   */
  public reset(): void {
    this.autoPauseFsm.reset();
    this.headingFusion.reset();
    this.accelerometerFusion.reset();
    this.powerManagement.reset();
  }
}

/**
 * 使用示例：
 * 
 * const optimizer = new AndroidOptimizationManager({
 *   autoPauseConfig: {
 *     pauseThreshold: 1.5,
 *     resumeThreshold: 3.0,
 *   },
 *   powerManagementConfig: {
 *     defaultMode: PerformanceMode.BALANCED,
 *   },
 * });
 * 
 * // 設定回調
 * optimizer.onAutoPauseStateChanged = (state) => {
 *   console.log('Auto pause state:', state);
 *   // 觸發 Haptic + TTS 提示
 * };
 * 
 * optimizer.onHeadingUpdated = (heading) => {
 *   mapView.setHeading(heading);
 * };
 * 
 * optimizer.onPowerModeChanged = (mode) => {
 *   console.log('Power mode changed to:', mode);
 * };
 * 
 * // 每次位置/感測器更新時調用
 * const result = optimizer.updateRideState({
 *   speed: 15,
 *   gpsHeading: 45,
 *   compassHeading: 42,
 *   accelX: 0.1,
 *   accelY: 0.2,
 *   accelZ: 9.9,
 *   batteryLevel: 80,
 *   timestamp: Date.now(),
 * });
 * 
 * console.log('Optimization result:', result);
 */
