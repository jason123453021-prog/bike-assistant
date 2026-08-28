/**
 * 自動暫停有限狀態機 (Finite State Machine)
 * 
 * 核心機制：
 * 1. 滑動窗口加權移動平均過濾 (6-8 個數據點)
 * 2. 雙閥值滯後機制 (1.5 km/h 暫停 / 3.0 km/h 恢復)
 * 3. 加速度計感測器融合 (GPS 精度低或時速 < 5 km/h)
 * 4. 狀態緩衝 (2 秒延遲確認)
 */

export enum RideState {
  RIDING = 'RIDING',           // 移動中
  AUTO_PAUSED = 'AUTO_PAUSED', // 自動暫停
}

interface AutoPauseFSMConfig {
  // 雙閥值設定
  pauseThreshold: number;       // 暫停閥值 (km/h)，預設 1.5
  resumeThreshold: number;      // 恢復閥值 (km/h)，預設 3.0
  
  // 加速度計融合
  accelerometerThreshold: number; // 加速度計能量閥值，預設 0.3
  lowSpeedThreshold: number;      // 低速融合觸發 (km/h)，預設 5.0
  
  // 狀態緩衝
  bufferDuration: number;         // 狀態確認延遲 (ms)，預設 2000
  
  // 滑動窗口
  windowSize: number;             // 窗口大小，預設 8
}

interface SpeedDataPoint {
  speed: number;                  // km/h
  timestamp: number;              // ms
  accelerometerEnergy?: number;   // 加速度計能量值
}

export class AutoPauseFSM {
  private currentState: RideState = RideState.RIDING;
  private speedWindow: SpeedDataPoint[] = [];
  private bufferTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState: RideState | null = null;
  private config: AutoPauseFSMConfig;

  constructor(config: Partial<AutoPauseFSMConfig> = {}) {
    this.config = {
      pauseThreshold: 1.5,
      resumeThreshold: 3.0,
      accelerometerThreshold: 0.3,
      lowSpeedThreshold: 5.0,
      bufferDuration: 2000,
      windowSize: 8,
      ...config,
    };
  }

  /**
   * 計算加權移動平均速度
   * 最新數據權重 40%，其餘依序遞減
   */
  private calculateWeightedAverageSpeed(): number {
    if (this.speedWindow.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    // 最新的數據點權重最高 (40%)
    const maxWeight = 0.4;
    const weights: number[] = [];

    for (let i = 0; i < this.speedWindow.length; i++) {
      // 計算每個點的權重 (最新點 40%，其餘遞減)
      const weight = i === this.speedWindow.length - 1
        ? maxWeight
        : (maxWeight * (1 - (this.speedWindow.length - 1 - i) / this.speedWindow.length));
      
      weights.push(weight);
      totalWeight += weight;
      weightedSum += this.speedWindow[i].speed * weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * 計算加速度計能量值 (三軸加速度合成)
   * 用於偵測自行車震動特徵
   */
  private calculateAccelerometerEnergy(
    accelX: number,
    accelY: number,
    accelZ: number,
    gravity: number = 9.81
  ): number {
    // 移除重力加速度影響 (假設 Z 軸為垂直)
    const adjustedZ = accelZ - gravity;
    
    // 計算合振動幅值 (RMS - Root Mean Square)
    const energy = Math.sqrt(
      accelX * accelX + accelY * accelY + adjustedZ * adjustedZ
    );

    return energy;
  }

  /**
   * 更新速度數據並進行狀態轉換判定
   */
  public updateSpeed(
    speed: number,
    timestamp: number = Date.now(),
    accelX?: number,
    accelY?: number,
    accelZ?: number
  ): RideState {
    // 添加新數據點到滑動窗口
    const dataPoint: SpeedDataPoint = {
      speed,
      timestamp,
    };

    // 如果提供了加速度計數據，計算能量值
    if (accelX !== undefined && accelY !== undefined && accelZ !== undefined) {
      dataPoint.accelerometerEnergy = this.calculateAccelerometerEnergy(
        accelX,
        accelY,
        accelZ
      );
    }

    this.speedWindow.push(dataPoint);

    // 保持窗口大小
    if (this.speedWindow.length > this.config.windowSize) {
      this.speedWindow.shift();
    }

    // 計算加權平均速度
    const avgSpeed = this.calculateWeightedAverageSpeed();

    // 計算加速度計平均能量 (用於低速爬坡判定)
    const avgAccelerometerEnergy = this.getAverageAccelerometerEnergy();

    // 執行狀態轉換邏輯
    this.evaluateStateTransition(avgSpeed, avgAccelerometerEnergy);

    return this.currentState;
  }

  /**
   * 獲取加速度計平均能量值
   */
  private getAverageAccelerometerEnergy(): number {
    const validPoints = this.speedWindow.filter(p => p.accelerometerEnergy !== undefined);
    if (validPoints.length === 0) return 0;

    const sum = validPoints.reduce((acc, p) => acc + (p.accelerometerEnergy || 0), 0);
    return sum / validPoints.length;
  }

  /**
   * 評估狀態轉換條件
   */
  private evaluateStateTransition(avgSpeed: number, avgAccelerometerEnergy: number): void {
    let targetState: RideState | null = null;

    if (this.currentState === RideState.RIDING) {
      // 移動中 -> 自動暫停
      // 條件：加權時速 < 1.5 km/h 且 加速度計能量 < 閥值
      const speedCondition = avgSpeed < this.config.pauseThreshold;
      const accelerometerCondition = avgAccelerometerEnergy < this.config.accelerometerThreshold;

      if (speedCondition && accelerometerCondition) {
        targetState = RideState.AUTO_PAUSED;
      }
    } else if (this.currentState === RideState.AUTO_PAUSED) {
      // 自動暫停 -> 移動中
      // 條件：加權時速 >= 3.0 km/h 或 加速度計能量 >= 閥值
      const speedCondition = avgSpeed >= this.config.resumeThreshold;
      const accelerometerCondition = avgAccelerometerEnergy >= this.config.accelerometerThreshold;

      if (speedCondition || accelerometerCondition) {
        targetState = RideState.RIDING;
      }
    }

    // 如果有目標狀態，進入緩衝期
    if (targetState !== null && targetState !== this.currentState) {
      this.transitionWithBuffer(targetState);
    } else if (targetState === null) {
      // 清除緩衝期
      this.clearBuffer();
    }
  }

  /**
   * 帶緩衝的狀態轉換 (2-3 秒延遲確認)
   */
  private transitionWithBuffer(targetState: RideState): void {
    if (this.pendingState === targetState) {
      // 已在緩衝期，無需重新設定計時器
      return;
    }

    // 清除舊的計時器
    if (this.bufferTimer !== null) {
      clearTimeout(this.bufferTimer);
    }

    this.pendingState = targetState;

    // 設定緩衝計時器
    this.bufferTimer = setTimeout(() => {
      // 確認狀態轉換
      this.currentState = targetState;
      this.pendingState = null;
      this.bufferTimer = null;

      // 觸發回調 (由外部監聽)
      this.onStateChanged?.(this.currentState);
    }, this.config.bufferDuration);
  }

  /**
   * 清除緩衝期
   */
  private clearBuffer(): void {
    if (this.bufferTimer !== null) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
      this.pendingState = null;
    }
  }

  /**
   * 狀態變更回調 (由外部實現)
   */
  public onStateChanged?: (newState: RideState) => void;

  /**
   * 獲取當前狀態
   */
  public getState(): RideState {
    return this.currentState;
  }

  /**
   * 獲取待定狀態 (緩衝期中的目標狀態)
   */
  public getPendingState(): RideState | null {
    return this.pendingState;
  }

  /**
   * 獲取當前加權平均速度
   */
  public getWeightedAverageSpeed(): number {
    return this.calculateWeightedAverageSpeed();
  }

  /**
   * 重置狀態機
   */
  public reset(): void {
    this.currentState = RideState.RIDING;
    this.speedWindow = [];
    this.clearBuffer();
  }

  /**
   * 獲取狀態機統計信息 (用於調試)
   */
  public getStats() {
    return {
      currentState: this.currentState,
      pendingState: this.pendingState,
      windowSize: this.speedWindow.length,
      weightedAverageSpeed: this.calculateWeightedAverageSpeed(),
      averageAccelerometerEnergy: this.getAverageAccelerometerEnergy(),
      config: this.config,
    };
  }
}

/**
 * 使用示例：
 * 
 * const fsm = new AutoPauseFSM({
 *   pauseThreshold: 1.5,
 *   resumeThreshold: 3.0,
 * });
 * 
 * fsm.onStateChanged = (newState) => {
 *   console.log('State changed to:', newState);
 *   if (newState === RideState.AUTO_PAUSED) {
 *     // 觸發暫停提示 (Haptic + TTS)
 *   } else {
 *     // 觸發恢復提示
 *   }
 * };
 * 
 * // 每次 GPS 更新時調用
 * fsm.updateSpeed(speed, timestamp, accelX, accelY, accelZ);
 */
