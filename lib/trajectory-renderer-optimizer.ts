/**
 * 軌跡渲染性能優化模組
 * 
 * 功能：
 * - 軌跡點抽樣（Douglas-Peucker 演算法）
 * - 增量渲染管理
 * - 動態密度調整
 * - 性能監控
 */

export interface TrajectoryPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

export interface RenderOptimizationConfig {
  maxPointsPerFrame?: number; // 每幀最多渲染點數
  simplificationTolerance?: number; // 簡化容差（度）
  enableDynamicDensity?: boolean; // 啟用動態密度調整
  maxCacheSize?: number; // 最大快取大小
}

/**
 * Douglas-Peucker 軌跡簡化演算法
 */
export class DouglasPeuckerSimplifier {
  /**
   * 簡化軌跡點序列
   * @param points 原始軌跡點
   * @param tolerance 容差（度）
   * @returns 簡化後的軌跡點
   */
  static simplify(points: TrajectoryPoint[], tolerance: number = 0.00001): TrajectoryPoint[] {
    if (points.length <= 2) {
      return points;
    }

    // 計算每個點到起點-終點連線的距離
    const dmax = { index: 0, distance: 0 };

    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.perpendicularDistance(
        points[i],
        points[0],
        points[points.length - 1]
      );

      if (distance > dmax.distance) {
        dmax.distance = distance;
        dmax.index = i;
      }
    }

    // 如果最大距離大於容差，遞迴簡化
    if (dmax.distance > tolerance) {
      const recursiveResults1 = this.simplify(points.slice(0, dmax.index + 1), tolerance);
      const recursiveResults2 = this.simplify(points.slice(dmax.index), tolerance);

      // 合併結果（避免重複終點）
      return recursiveResults1.slice(0, -1).concat(recursiveResults2);
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  /**
   * 計算點到直線的垂直距離
   */
  private static perpendicularDistance(
    point: TrajectoryPoint,
    lineStart: TrajectoryPoint,
    lineEnd: TrajectoryPoint
  ): number {
    const dx = lineEnd.longitude - lineStart.longitude;
    const dy = lineEnd.latitude - lineStart.latitude;

    if (dx === 0 && dy === 0) {
      // 線段退化為點
      return Math.sqrt(
        (point.longitude - lineStart.longitude) ** 2 +
          (point.latitude - lineStart.latitude) ** 2
      );
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.longitude - lineStart.longitude) * dx +
          (point.latitude - lineStart.latitude) * dy) /
          (dx * dx + dy * dy)
      )
    );

    const closestX = lineStart.longitude + t * dx;
    const closestY = lineStart.latitude + t * dy;

    return Math.sqrt(
      (point.longitude - closestX) ** 2 + (point.latitude - closestY) ** 2
    );
  }
}

/**
 * 軌跡渲染優化器
 */
export class TrajectoryRenderOptimizer {
  private allPoints: TrajectoryPoint[] = [];
  private simplifiedPoints: TrajectoryPoint[] = [];
  private renderedPoints: TrajectoryPoint[] = [];
  private config: Required<RenderOptimizationConfig> = {
    maxPointsPerFrame: 500,
    simplificationTolerance: 0.00001,
    enableDynamicDensity: true,
    maxCacheSize: 5000,
  };
  private lastRenderTime: number = 0;
  private frameTime: number = 0; // 幀渲染時間（毫秒）

  constructor(config?: RenderOptimizationConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 添加軌跡點
   */
  addPoint(point: TrajectoryPoint): void {
    this.allPoints.push(point);

    // 限制快取大小
    if (this.allPoints.length > this.config.maxCacheSize) {
      this.allPoints = this.allPoints.slice(-this.config.maxCacheSize);
      this.simplifiedPoints = [];
      this.renderedPoints = [];
    }
  }

  /**
   * 添加多個軌跡點
   */
  addPoints(points: TrajectoryPoint[]): void {
    points.forEach((p) => this.addPoint(p));
  }

  /**
   * 獲取優化後的軌跡點（用於渲染）
   */
  getOptimizedPoints(zoomLevel: number = 15): TrajectoryPoint[] {
    const startTime = performance.now();

    // 根據縮放級別動態調整容差
    let tolerance = this.config.simplificationTolerance;
    if (this.config.enableDynamicDensity) {
      // 縮放級別越小，容差越大（點越少）
      tolerance = tolerance * Math.pow(2, 20 - zoomLevel);
    }

    // 簡化軌跡
    this.simplifiedPoints = DouglasPeuckerSimplifier.simplify(this.allPoints, tolerance);

    // 限制每幀渲染的點數
    if (this.simplifiedPoints.length > this.config.maxPointsPerFrame) {
      const step = Math.ceil(this.simplifiedPoints.length / this.config.maxPointsPerFrame);
      this.renderedPoints = this.simplifiedPoints.filter((_, i) => i % step === 0);
    } else {
      this.renderedPoints = this.simplifiedPoints;
    }

    this.frameTime = performance.now() - startTime;
    this.lastRenderTime = performance.now();

    return [...this.renderedPoints];
  }

  /**
   * 獲取所有原始軌跡點
   */
  getAllPoints(): TrajectoryPoint[] {
    return [...this.allPoints];
  }

  /**
   * 獲取簡化後的軌跡點
   */
  getSimplifiedPoints(): TrajectoryPoint[] {
    return [...this.simplifiedPoints];
  }

  /**
   * 清空軌跡
   */
  clear(): void {
    this.allPoints = [];
    this.simplifiedPoints = [];
    this.renderedPoints = [];
  }

  /**
   * 獲取性能統計
   */
  getPerformanceStats() {
    return {
      totalPoints: this.allPoints.length,
      simplifiedPoints: this.simplifiedPoints.length,
      renderedPoints: this.renderedPoints.length,
      frameTime: this.frameTime,
      compressionRatio: this.allPoints.length > 0 
        ? (this.renderedPoints.length / this.allPoints.length * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * 設定配置
   */
  setConfig(config: Partial<RenderOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * 增量軌跡渲染管理器
 */
export class IncrementalTrajectoryRenderer {
  private optimizer: TrajectoryRenderOptimizer;
  private lastRenderedCount: number = 0;
  private updateInterval: number = 100; // 毫秒
  private lastUpdateTime: number = 0;

  constructor(config?: RenderOptimizationConfig) {
    this.optimizer = new TrajectoryRenderOptimizer(config);
  }

  /**
   * 添加軌跡點
   */
  addPoint(point: TrajectoryPoint): void {
    this.optimizer.addPoint(point);
  }

  /**
   * 獲取增量更新的軌跡點
   */
  getIncrementalUpdate(zoomLevel: number = 15): {
    newPoints: TrajectoryPoint[];
    totalPoints: number;
    hasUpdate: boolean;
  } {
    const now = performance.now();

    // 檢查是否需要更新
    if (now - this.lastUpdateTime < this.updateInterval) {
      return {
        newPoints: [],
        totalPoints: this.lastRenderedCount,
        hasUpdate: false,
      };
    }

    const optimizedPoints = this.optimizer.getOptimizedPoints(zoomLevel);
    const newPoints = optimizedPoints.slice(this.lastRenderedCount);
    this.lastRenderedCount = optimizedPoints.length;
    this.lastUpdateTime = now;

    return {
      newPoints,
      totalPoints: optimizedPoints.length,
      hasUpdate: newPoints.length > 0,
    };
  }

  /**
   * 強制完整更新
   */
  forceFullUpdate(zoomLevel: number = 15): TrajectoryPoint[] {
    const points = this.optimizer.getOptimizedPoints(zoomLevel);
    this.lastRenderedCount = points.length;
    this.lastUpdateTime = performance.now();
    return points;
  }

  /**
   * 清空軌跡
   */
  clear(): void {
    this.optimizer.clear();
    this.lastRenderedCount = 0;
  }

  /**
   * 獲取性能統計
   */
  getPerformanceStats() {
    return this.optimizer.getPerformanceStats();
  }
}
