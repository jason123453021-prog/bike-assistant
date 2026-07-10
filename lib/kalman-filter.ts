/**
 * Kalman 濾波器 - 優化 GPS 位置精度
 * 
 * 用於平滑 GPS 位置抖動，特別是在城市峽谷環境中
 * 基於二維 Kalman 濾波器實現，支持速度估計
 */

export interface KalmanState {
  // 位置狀態
  x: number; // 緯度
  y: number; // 經度
  vx: number; // 緯度速度
  vy: number; // 經度速度
  
  // 協方差矩陣（4x4）
  P: number[][];
}

export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy?: number; // GPS 精度（公尺）
  timestamp: number;
}

export interface FilteredLocation extends GpsLocation {
  filtered: boolean; // 是否經過濾波
  velocity: number; // 速度（m/s）
}

/**
 * 二維 Kalman 濾波器實現
 * 用於平滑 GPS 位置序列
 */
export class KalmanFilter {
  private state: KalmanState;
  private dt: number = 1; // 時間步長（秒）
  private processNoise: number = 0.01; // 過程噪聲
  private measurementNoise: number = 10; // 測量噪聲（GPS 精度）
  private lastTimestamp: number = 0;

  constructor(initialLat: number, initialLon: number, initialAccuracy: number = 5) {
    // 初始化狀態
    this.state = {
      x: initialLat,
      y: initialLon,
      vx: 0,
      vy: 0,
      P: [
        [initialAccuracy, 0, 0, 0],
        [0, initialAccuracy, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };
  }

  /**
   * 更新濾波器狀態
   * @param measurement 新的 GPS 測量值
   * @returns 濾波後的位置
   */
  update(measurement: GpsLocation): FilteredLocation {
    // 計算時間步長
    if (this.lastTimestamp > 0) {
      this.dt = (measurement.timestamp - this.lastTimestamp) / 1000;
      // 限制時間步長在合理範圍內
      this.dt = Math.max(0.1, Math.min(5, this.dt));
    }
    this.lastTimestamp = measurement.timestamp;

    // 更新測量噪聲（基於 GPS 精度）
    const accuracy = measurement.accuracy || 5;
    this.measurementNoise = Math.max(1, accuracy * accuracy);

    // 1. 預測步驟（Prediction）
    this.predict();

    // 2. 更新步驟（Update）
    this.updateWithMeasurement(measurement);

    // 計算速度
    const velocity = Math.sqrt(this.state.vx ** 2 + this.state.vy ** 2);

    return {
      latitude: this.state.x,
      longitude: this.state.y,
      accuracy: accuracy,
      timestamp: measurement.timestamp,
      filtered: true,
      velocity: velocity,
    };
  }

  /**
   * 預測步驟
   */
  private predict(): void {
    const { x, y, vx, vy, P } = this.state;
    const dt = this.dt;
    const dt2 = dt * dt;

    // 狀態轉移矩陣 F
    // [x']   [1  0  dt  0] [x]
    // [y'] = [0  1  0   dt][y]
    // [vx']  [0  0  1   0] [vx]
    // [vy']  [0  0  0   1] [vy]

    // 更新位置
    this.state.x = x + vx * dt;
    this.state.y = y + vy * dt;
    // 速度保持不變

    // 更新協方差矩陣
    // P' = F * P * F^T + Q
    const Q = this.getProcessNoiseMatrix();
    const F = this.getStateTransitionMatrix();
    const FT = this.transposeMatrix(F);

    // P' = F * P * F^T + Q
    const FP = this.multiplyMatrix(F, P);
    const FPF = this.multiplyMatrix(FP, FT);
    this.state.P = this.addMatrix(FPF, Q);
  }

  /**
   * 更新步驟
   */
  private updateWithMeasurement(measurement: GpsLocation): void {
    const { x, y, P } = this.state;
    const z_x = measurement.latitude;
    const z_y = measurement.longitude;

    // 測量矩陣 H（只測量位置）
    // [1  0  0  0]
    // [0  1  0  0]
    const H = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ];

    // 測量殘差
    const y_x = z_x - x;
    const y_y = z_y - y;

    // 測量協方差 R
    const R = [
      [this.measurementNoise, 0],
      [0, this.measurementNoise],
    ];

    // 計算 Kalman 增益 K = P * H^T * (H * P * H^T + R)^-1
    const HT = this.transposeMatrix(H);
    const HP = this.multiplyMatrix(H, P);
    const HPHT = this.multiplyMatrix(HP, HT);
    const S = this.addMatrix(HPHT, R);
    const S_inv = this.invertMatrix2x2(S);
    const PHT = this.multiplyMatrix(P, HT);
    const K = this.multiplyMatrix(PHT, S_inv);

    // 更新狀態
    const residual = [[y_x], [y_y]];
    const correction = this.multiplyMatrix(K, residual);

    this.state.x += correction[0][0];
    this.state.y += correction[1][0];
    this.state.vx += correction[2]?.[0] ?? 0;
    this.state.vy += correction[3]?.[0] ?? 0;

    // 更新協方差 P = (I - K * H) * P
    const I = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const KH = this.multiplyMatrix(K, H);
    const I_KH = this.subtractMatrix(I, KH);
    this.state.P = this.multiplyMatrix(I_KH, P);
  }

  /**
   * 獲取狀態轉移矩陣
   */
  private getStateTransitionMatrix(): number[][] {
    const dt = this.dt;
    return [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  }

  /**
   * 獲取過程噪聲矩陣
   */
  private getProcessNoiseMatrix(): number[][] {
    const q = this.processNoise;
    const dt = this.dt;
    const dt2 = dt * dt;
    const dt3 = dt2 * dt;
    const dt4 = dt2 * dt2;

    return [
      [dt4 / 4 * q, 0, dt3 / 2 * q, 0],
      [0, dt4 / 4 * q, 0, dt3 / 2 * q],
      [dt3 / 2 * q, 0, dt2 * q, 0],
      [0, dt3 / 2 * q, 0, dt2 * q],
    ];
  }

  /**
   * 矩陣轉置
   */
  private transposeMatrix(matrix: number[][]): number[][] {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result: number[][] = Array(cols)
      .fill(null)
      .map(() => Array(rows).fill(0));

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[j][i] = matrix[i][j];
      }
    }
    return result;
  }

  /**
   * 矩陣相乘
   */
  private multiplyMatrix(a: number[][], b: number[][]): number[][] {
    const result: number[][] = Array(a.length)
      .fill(null)
      .map(() => Array(b[0].length).fill(0));

    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b[0].length; j++) {
        for (let k = 0; k < b.length; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    return result;
  }

  /**
   * 矩陣相加
   */
  private addMatrix(a: number[][], b: number[][]): number[][] {
    return a.map((row, i) => row.map((val, j) => val + b[i][j]));
  }

  /**
   * 矩陣相減
   */
  private subtractMatrix(a: number[][], b: number[][]): number[][] {
    return a.map((row, i) => row.map((val, j) => val - b[i][j]));
  }

  /**
   * 2x2 矩陣求逆
   */
  private invertMatrix2x2(matrix: number[][]): number[][] {
    const [[a, b], [c, d]] = matrix;
    const det = a * d - b * c;

    if (Math.abs(det) < 1e-10) {
      // 矩陣奇異，返回單位矩陣
      return [
        [1, 0],
        [0, 1],
      ];
    }

    return [
      [d / det, -b / det],
      [-c / det, a / det],
    ];
  }

  /**
   * 重置濾波器
   */
  reset(initialLat: number, initialLon: number, initialAccuracy: number = 5): void {
    this.state = {
      x: initialLat,
      y: initialLon,
      vx: 0,
      vy: 0,
      P: [
        [initialAccuracy, 0, 0, 0],
        [0, initialAccuracy, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };
    this.lastTimestamp = 0;
  }

  /**
   * 獲取當前狀態
   */
  getState(): KalmanState {
    return { ...this.state };
  }
}

/**
 * 多點 Kalman 濾波器管理器
 * 用於管理軌跡點的濾波
 */
export class TrajectoryKalmanFilter {
  private filter: KalmanFilter | null = null;
  private filteredPoints: FilteredLocation[] = [];
  private minDistanceThreshold: number = 2; // 最小距離閾值（公尺）

  /**
   * 添加 GPS 點
   */
  addPoint(location: GpsLocation): FilteredLocation | null {
    // 初始化濾波器
    if (!this.filter) {
      this.filter = new KalmanFilter(
        location.latitude,
        location.longitude,
        location.accuracy
      );
      const filtered = this.filter.update(location);
      this.filteredPoints.push(filtered);
      return filtered;
    }

    // 檢查距離閾值（避免重複點）
    const lastPoint = this.filteredPoints[this.filteredPoints.length - 1];
    const distance = this.calculateDistance(lastPoint, location);

    if (distance < this.minDistanceThreshold) {
      return null; // 距離太近，忽略
    }

    // 更新濾波器
    const filtered = this.filter.update(location);
    this.filteredPoints.push(filtered);
    return filtered;
  }

  /**
   * 計算兩點之間的距離（公尺）
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // 地球半徑（公尺）
    const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.latitude * Math.PI) / 180) *
        Math.cos((point2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 獲取濾波後的軌跡點
   */
  getFilteredPoints(): FilteredLocation[] {
    return [...this.filteredPoints];
  }

  /**
   * 清空軌跡
   */
  clear(): void {
    this.filter = null;
    this.filteredPoints = [];
  }

  /**
   * 獲取軌跡點數量
   */
  getPointCount(): number {
    return this.filteredPoints.length;
  }
}
