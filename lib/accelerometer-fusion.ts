/**
 * 加速度計感測器融合 (Accelerometer Sensor Fusion)
 * 
 * 核心機制：
 * 1. 三軸加速度數據採集
 * 2. 高通濾波移除重力加速度
 * 3. 合振動幅值計算 (Variance / Energy)
 * 4. 低速爬坡檢測 (GPS 精度低時)
 * 5. 採樣率動態調整 (20-60Hz)
 */

interface AccelerometerFusionConfig {
  // 採樣率
  samplingRate: number;             // Hz，預設 50 (SENSOR_DELAY_NORMAL)
  
  // 高通濾波參數
  highPassCutoffFrequency: number;  // Hz，預設 0.5
  
  // 能量計算
  energyWindowSize: number;         // 窗口大小，預設 10
  
  // 低速爬坡檢測
  lowSpeedThreshold: number;        // km/h，預設 5
  energyThreshold: number;          // 能量閥值，預設 0.3
  
  // 動態採樣率調整
  highSpeedSamplingRate: number;    // 高速採樣率 (Hz)，預設 20
  lowSpeedSamplingRate: number;     // 低速採樣率 (Hz)，預設 50
  
  // 重力加速度
  gravity: number;                  // m/s²，預設 9.81
}

interface AccelerometerDataPoint {
  x: number;                        // X 軸加速度 (m/s²)
  y: number;                        // Y 軸加速度 (m/s²)
  z: number;                        // Z 軸加速度 (m/s²)
  timestamp: number;                // ms
  energy?: number;                  // 計算的能量值
}

interface HighPassFilterState {
  lastX: number;
  lastY: number;
  lastZ: number;
  lastFilteredX: number;
  lastFilteredY: number;
  lastFilteredZ: number;
}

export class AccelerometerFusion {
  private config: AccelerometerFusionConfig;
  private dataWindow: AccelerometerDataPoint[] = [];
  private filterState: HighPassFilterState;
  private currentSamplingRate: number;
  private isMoving: boolean = false;

  constructor(config: Partial<AccelerometerFusionConfig> = {}) {
    this.config = {
      samplingRate: 50,
      highPassCutoffFrequency: 0.5,
      energyWindowSize: 10,
      lowSpeedThreshold: 5,
      energyThreshold: 0.3,
      highSpeedSamplingRate: 20,
      lowSpeedSamplingRate: 50,
      gravity: 9.81,
      ...config,
    };

    this.currentSamplingRate = this.config.samplingRate;
    this.filterState = {
      lastX: 0,
      lastY: 0,
      lastZ: 0,
      lastFilteredX: 0,
      lastFilteredY: 0,
      lastFilteredZ: 0,
    };
  }

  /**
   * 高通濾波 - 移除重力加速度和低頻噪聲
   * 使用一階 IIR 高通濾波器
   * 
   * @param rawAccel 原始加速度值
   * @param lastRawAccel 上次原始加速度值
   * @param lastFilteredAccel 上次濾波後的加速度值
   * @returns 濾波後的加速度值
   */
  private highPassFilter(
    rawAccel: number,
    lastRawAccel: number,
    lastFilteredAccel: number
  ): number {
    // 計算濾波係數
    const dt = 1 / this.config.samplingRate;
    const rc = 1 / (2 * Math.PI * this.config.highPassCutoffFrequency);
    const alpha = rc / (rc + dt);

    // 一階 IIR 高通濾波
    const filteredAccel = alpha * (lastFilteredAccel + rawAccel - lastRawAccel);
    return filteredAccel;
  }

  /**
   * 計算合振動幅值 (RMS - Root Mean Square)
   * 用於偵測自行車震動特徵
   */
  private calculateEnergy(x: number, y: number, z: number): number {
    // 計算合振動幅值
    const energy = Math.sqrt(x * x + y * y + z * z);
    return energy;
  }

  /**
   * 更新加速度計數據
   * 
   * @param x X 軸加速度 (m/s²)
   * @param y Y 軸加速度 (m/s²)
   * @param z Z 軸加速度 (m/s²)
   * @param timestamp 時間戳 (ms)
   * @returns 計算的能量值
   */
  public updateAccelerometer(
    x: number,
    y: number,
    z: number,
    timestamp: number = Date.now()
  ): number {
    // 應用高通濾波移除重力加速度
    const filteredX = this.highPassFilter(x, this.filterState.lastX, this.filterState.lastFilteredX);
    const filteredY = this.highPassFilter(y, this.filterState.lastY, this.filterState.lastFilteredY);
    const filteredZ = this.highPassFilter(z, this.filterState.lastZ, this.filterState.lastFilteredZ);

    // 更新濾波器狀態
    this.filterState.lastX = x;
    this.filterState.lastY = y;
    this.filterState.lastZ = z;
    this.filterState.lastFilteredX = filteredX;
    this.filterState.lastFilteredY = filteredY;
    this.filterState.lastFilteredZ = filteredZ;

    // 計算能量值
    const energy = this.calculateEnergy(filteredX, filteredY, filteredZ);

    // 添加到數據窗口
    const dataPoint: AccelerometerDataPoint = {
      x: filteredX,
      y: filteredY,
      z: filteredZ,
      timestamp,
      energy,
    };

    this.dataWindow.push(dataPoint);

    // 保持窗口大小
    if (this.dataWindow.length > this.config.energyWindowSize) {
      this.dataWindow.shift();
    }

    return energy;
  }

  /**
   * 獲取平均能量值
   */
  public getAverageEnergy(): number {
    if (this.dataWindow.length === 0) return 0;

    const sum = this.dataWindow.reduce((acc, p) => acc + (p.energy || 0), 0);
    return sum / this.dataWindow.length;
  }

  /**
   * 獲取最大能量值
   */
  public getMaxEnergy(): number {
    if (this.dataWindow.length === 0) return 0;

    return Math.max(...this.dataWindow.map(p => p.energy || 0));
  }

  /**
   * 獲取最小能量值
   */
  public getMinEnergy(): number {
    if (this.dataWindow.length === 0) return 0;

    return Math.min(...this.dataWindow.map(p => p.energy || 0));
  }

  /**
   * 判定是否在移動 (低速爬坡檢測)
   * 
   * @param speed 當前速度 (km/h)
   * @returns 是否在移動
   */
  public isMovingByAccelerometer(speed: number): boolean {
    // 如果速度較高，不需要加速度計判定
    if (speed > this.config.lowSpeedThreshold) {
      this.isMoving = true;
      return true;
    }

    // 低速時，根據加速度計能量判定
    const avgEnergy = this.getAverageEnergy();
    this.isMoving = avgEnergy >= this.config.energyThreshold;

    return this.isMoving;
  }

  /**
   * 動態調整採樣率 (功耗優化)
   * 
   * @param speed 當前速度 (km/h)
   * @returns 應該使用的採樣率 (Hz)
   */
  public getOptimalSamplingRate(speed: number): number {
    if (speed > this.config.lowSpeedThreshold) {
      // 高速時降低採樣率以節省功耗
      this.currentSamplingRate = this.config.highSpeedSamplingRate;
    } else {
      // 低速時提高採樣率以提高準確性
      this.currentSamplingRate = this.config.lowSpeedSamplingRate;
    }

    return this.currentSamplingRate;
  }

  /**
   * 獲取當前採樣率
   */
  public getCurrentSamplingRate(): number {
    return this.currentSamplingRate;
  }

  /**
   * 獲取融合統計信息 (用於調試)
   */
  public getStats() {
    return {
      windowSize: this.dataWindow.length,
      averageEnergy: this.getAverageEnergy(),
      maxEnergy: this.getMaxEnergy(),
      minEnergy: this.getMinEnergy(),
      isMoving: this.isMoving,
      currentSamplingRate: this.currentSamplingRate,
      config: this.config,
    };
  }

  /**
   * 重置狀態
   */
  public reset(): void {
    this.dataWindow = [];
    this.filterState = {
      lastX: 0,
      lastY: 0,
      lastZ: 0,
      lastFilteredX: 0,
      lastFilteredY: 0,
      lastFilteredZ: 0,
    };
    this.isMoving = false;
  }
}

/**
 * 使用示例：
 * 
 * const accelFusion = new AccelerometerFusion({
 *   samplingRate: 50,
 *   energyThreshold: 0.3,
 * });
 * 
 * // 每次加速度計更新時調用
 * accelFusion.updateAccelerometer(accelX, accelY, accelZ);
 * 
 * // 判定是否在移動 (低速爬坡檢測)
 * const isMoving = accelFusion.isMovingByAccelerometer(speed);
 * 
 * // 動態調整採樣率 (功耗優化)
 * const samplingRate = accelFusion.getOptimalSamplingRate(speed);
 */
