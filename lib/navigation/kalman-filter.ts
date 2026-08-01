/**
 * Kalman 濾波器
 * 用於平滑 GPS 位置抖動，提高軌跡精度，特別是在城市峽谷環境中
 */

export interface GPSReading {
  lat: number;
  lon: number;
  accuracy: number; // 精度（米）
  timestamp: number;
}

export interface FilteredPosition {
  lat: number;
  lon: number;
  accuracy: number;
}

/**
 * 2D Kalman 濾波器實現
 */
export class KalmanFilter2D {
  private x: number; // 狀態向量 [lat, lon]
  private y: number;
  private vx: number; // 速度 [d_lat, d_lon]
  private vy: number;
  
  private px: number; // 協方差矩陣
  private py: number;
  private pvx: number;
  private pvy: number;
  
  private q: number; // 過程噪聲
  private r: number; // 測量噪聲
  
  private lastTimestamp: number;

  constructor(
    initialLat: number,
    initialLon: number,
    processNoise: number = 0.0001,
    measurementNoise: number = 0.01
  ) {
    this.x = initialLat;
    this.y = initialLon;
    this.vx = 0;
    this.vy = 0;
    
    this.px = 1;
    this.py = 1;
    this.pvx = 0.1;
    this.pvy = 0.1;
    
    this.q = processNoise;
    this.r = measurementNoise;
    
    this.lastTimestamp = Date.now();
  }

  /**
   * 更新濾波器狀態
   */
  update(reading: GPSReading): FilteredPosition {
    const now = Date.now();
    const dt = (now - this.lastTimestamp) / 1000; // 轉換為秒
    this.lastTimestamp = now;

    // 預測步驟
    this.predict(dt);

    // 更新步驟
    this.correct(reading);

    return {
      lat: this.x,
      lon: this.y,
      accuracy: Math.sqrt(this.px + this.py),
    };
  }

  /**
   * 預測步驟：基於速度預測下一個位置
   */
  private predict(dt: number): void {
    // 更新位置
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 更新協方差
    this.px += this.pvx * dt * dt + this.q;
    this.py += this.pvy * dt * dt + this.q;
    this.pvx += this.q;
    this.pvy += this.q;
  }

  /**
   * 更新步驟：使用測量值修正預測
   */
  private correct(reading: GPSReading): void {
    // 計算 Kalman 增益
    const kx = this.px / (this.px + this.r / (reading.accuracy * reading.accuracy));
    const ky = this.py / (this.py + this.r / (reading.accuracy * reading.accuracy));

    // 更新位置
    this.x += kx * (reading.lat - this.x);
    this.y += ky * (reading.lon - this.y);

    // 更新速度（基於位置變化）
    const dt = (reading.timestamp - this.lastTimestamp) / 1000;
    if (dt > 0) {
      this.vx = (reading.lat - this.x) / dt;
      this.vy = (reading.lon - this.y) / dt;
    }

    // 更新協方差
    this.px *= 1 - kx;
    this.py *= 1 - ky;
  }

  /**
   * 重置濾波器
   */
  reset(lat: number, lon: number): void {
    this.x = lat;
    this.y = lon;
    this.vx = 0;
    this.vy = 0;
    this.px = 1;
    this.py = 1;
    this.lastTimestamp = Date.now();
  }
}

/**
 * 簡化的 Kalman 濾波器（用於快速計算）
 */
export class SimpleKalmanFilter {
  private value: number;
  private estimate: number;
  private q: number; // 過程噪聲
  private r: number; // 測量噪聲
  private p: number; // 協方差
  private k: number; // Kalman 增益

  constructor(
    initialValue: number,
    processNoise: number = 0.01,
    measurementNoise: number = 0.1
  ) {
    this.value = initialValue;
    this.estimate = initialValue;
    this.q = processNoise;
    this.r = measurementNoise;
    this.p = 1;
    this.k = 0;
  }

  /**
   * 更新濾波器
   */
  update(measurement: number): number {
    // 預測
    this.p = this.p + this.q;

    // 更新
    this.k = this.p / (this.p + this.r);
    this.value = this.value + this.k * (measurement - this.value);
    this.p = (1 - this.k) * this.p;

    return this.value;
  }

  /**
   * 獲取當前值
   */
  getValue(): number {
    return this.value;
  }

  /**
   * 重置濾波器
   */
  reset(initialValue: number): void {
    this.value = initialValue;
    this.estimate = initialValue;
    this.p = 1;
    this.k = 0;
  }
}

/**
 * 軌跡平滑器
 * 使用移動平均和 Kalman 濾波的組合
 */
export class TrajectorySmoothing {
  private kalmanX: KalmanFilter2D | null = null;
  private windowSize: number;
  private readings: GPSReading[] = [];

  constructor(windowSize: number = 5) {
    this.windowSize = Math.max(1, windowSize);
  }

  /**
   * 添加 GPS 讀數並返回平滑後的位置
   */
  addReading(reading: GPSReading): FilteredPosition {
    this.readings.push(reading);

    // 保持窗口大小
    if (this.readings.length > this.windowSize) {
      this.readings.shift();
    }

    // 初始化 Kalman 濾波器
    if (!this.kalmanX) {
      this.kalmanX = new KalmanFilter2D(reading.lat, reading.lon);
    }

    // 使用 Kalman 濾波器
    const filtered = this.kalmanX.update(reading);

    // 應用移動平均
    return this.applyMovingAverage(filtered);
  }

  /**
   * 應用移動平均
   */
  private applyMovingAverage(filtered: FilteredPosition): FilteredPosition {
    if (this.readings.length === 0) return filtered;

    let sumLat = 0;
    let sumLon = 0;
    let sumAccuracy = 0;

    for (const reading of this.readings) {
      sumLat += reading.lat;
      sumLon += reading.lon;
      sumAccuracy += reading.accuracy;
    }

    return {
      lat: sumLat / this.readings.length,
      lon: sumLon / this.readings.length,
      accuracy: sumAccuracy / this.readings.length,
    };
  }

  /**
   * 重置平滑器
   */
  reset(): void {
    this.readings = [];
    this.kalmanX = null;
  }

  /**
   * 獲取當前讀數數量
   */
  getReadingCount(): number {
    return this.readings.length;
  }
}

/**
 * 檢測靜止狀態（速度低於閾值）
 */
export function isStationary(
  prevLat: number,
  prevLon: number,
  currLat: number,
  currLon: number,
  timeDeltaSeconds: number,
  speedThreshold: number = 1 // km/h
): boolean {
  // 計算距離（Haversine）
  const R = 6371000; // 地球半徑（米）
  const dLat = toRad(currLat - prevLat);
  const dLon = toRad(currLon - prevLon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(prevLat)) * Math.cos(toRad(currLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // 米

  // 計算速度
  const speedMs = distance / timeDeltaSeconds;
  const speedKmh = speedMs * 3.6;

  return speedKmh < speedThreshold;
}

/**
 * 角度轉弧度
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * 檢測異常 GPS 讀數
 */
export function isAnomalousReading(
  reading: GPSReading,
  previousReading: GPSReading | null,
  maxSpeedKmh: number = 100 // 最大合理速度
): boolean {
  // 檢查精度
  if (reading.accuracy > 100) {
    return true; // 精度太低
  }

  if (!previousReading) {
    return false;
  }

  // 計算速度
  const R = 6371000;
  const dLat = toRad(reading.lat - previousReading.lat);
  const dLon = toRad(reading.lon - previousReading.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(previousReading.lat)) * Math.cos(toRad(reading.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  const timeDelta = (reading.timestamp - previousReading.timestamp) / 1000;
  if (timeDelta <= 0) return true;

  const speedMs = distance / timeDelta;
  const speedKmh = speedMs * 3.6;

  return speedKmh > maxSpeedKmh;
}
