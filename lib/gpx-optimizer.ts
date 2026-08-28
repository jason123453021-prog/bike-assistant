/**
 * GPX 最佳化和壓縮工具
 * 功能：
 * - 軌跡點採樣和簡化（Douglas-Peucker 算法）
 * - 軌跡點壓縮（移除冗餘點）
 * - 軌跡平滑（移動平均）
 * - 軌跡分段（按距離或時間）
 */

export interface GpxPoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  timestamp?: number;
  speed?: number;
  heartRate?: number;
  cadence?: number;
  power?: number;
}

export interface GpxSegment {
  points: GpxPoint[];
  distance: number; // 米
  duration: number; // 秒
  elevation: number; // 米
}

export class GpxOptimizer {
  /**
   * Douglas-Peucker 算法 - 簡化軌跡
   * @param points 軌跡點
   * @param epsilon 簡化容差（米）
   */
  static simplifyTrack(points: GpxPoint[], epsilon: number = 10): GpxPoint[] {
    if (points.length <= 2) {
      return points;
    }

    const dmax = this.findMaxDistance(points);
    if (dmax > epsilon) {
      const index = this.findMaxDistanceIndex(points);
      const results1 = this.simplifyTrack(points.slice(0, index + 1), epsilon);
      const results2 = this.simplifyTrack(points.slice(index), epsilon);
      return results1.slice(0, -1).concat(results2);
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  /**
   * 移除冗餘點（相同座標或非常接近的點）
   */
  static removeRedundantPoints(points: GpxPoint[], minDistance: number = 1): GpxPoint[] {
    if (points.length <= 1) {
      return points;
    }

    const result: GpxPoint[] = [points[0]];

    for (let i = 1; i < points.length; i++) {
      const distance = this.haversineDistance(result[result.length - 1], points[i]);
      if (distance >= minDistance) {
        result.push(points[i]);
      }
    }

    return result;
  }

  /**
   * 軌跡平滑（移動平均）
   */
  static smoothTrack(points: GpxPoint[], windowSize: number = 5): GpxPoint[] {
    if (points.length <= windowSize) {
      return points;
    }

    const result: GpxPoint[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < points.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(points.length, i + halfWindow + 1);
      const window = points.slice(start, end);

      const smoothedPoint: GpxPoint = {
        latitude: window.reduce((sum, p) => sum + p.latitude, 0) / window.length,
        longitude: window.reduce((sum, p) => sum + p.longitude, 0) / window.length,
        elevation: window.some((p) => p.elevation !== undefined)
          ? (window.reduce((sum, p) => sum + (p.elevation ?? 0), 0) / window.length)
          : undefined,
        timestamp: points[i].timestamp,
        speed: points[i].speed,
        heartRate: points[i].heartRate,
        cadence: points[i].cadence,
        power: points[i].power,
      };

      result.push(smoothedPoint);
    }

    return result;
  }

  /**
   * 按距離分段
   */
  static segmentByDistance(points: GpxPoint[], segmentDistance: number = 1000): GpxSegment[] {
    const segments: GpxSegment[] = [];
    let currentSegment: GpxPoint[] = [points[0]];
    let currentDistance = 0;

    for (let i = 1; i < points.length; i++) {
      const distance = this.haversineDistance(points[i - 1], points[i]);
      currentDistance += distance;

      if (currentDistance >= segmentDistance) {
        segments.push(this.createSegment(currentSegment));
        currentSegment = [points[i]];
        currentDistance = 0;
      } else {
        currentSegment.push(points[i]);
      }
    }

    if (currentSegment.length > 1) {
      segments.push(this.createSegment(currentSegment));
    }

    return segments;
  }

  /**
   * 按時間分段
   */
  static segmentByTime(points: GpxPoint[], segmentDuration: number = 300): GpxSegment[] {
    const segments: GpxSegment[] = [];
    let currentSegment: GpxPoint[] = [points[0]];
    let segmentStartTime = points[0].timestamp ?? 0;

    for (let i = 1; i < points.length; i++) {
      const currentTime = points[i].timestamp ?? 0;
      const duration = currentTime - segmentStartTime;

      if (duration >= segmentDuration) {
        segments.push(this.createSegment(currentSegment));
        currentSegment = [points[i]];
      } else {
        currentSegment.push(points[i]);
      }
    }

    if (currentSegment.length > 1) {
      segments.push(this.createSegment(currentSegment));
    }

    return segments;
  }

  /**
   * 壓縮軌跡（簡化 + 移除冗餘 + 平滑）
   */
  static compressTrack(
    points: GpxPoint[],
    options: {
      simplifyEpsilon?: number; // 簡化容差（米），預設 10
      minDistance?: number; // 最小距離（米），預設 1
      smoothWindow?: number; // 平滑窗口大小，預設 5
      maxPoints?: number; // 最多保留點數，預設 500
    } = {}
  ): GpxPoint[] {
    const {
      simplifyEpsilon = 10,
      minDistance = 1,
      smoothWindow = 5,
      maxPoints = 500,
    } = options;

    let result = points;

    // 1. 移除冗餘點
    result = this.removeRedundantPoints(result, minDistance);

    // 2. 簡化軌跡
    result = this.simplifyTrack(result, simplifyEpsilon);

    // 3. 平滑軌跡
    if (result.length > smoothWindow) {
      result = this.smoothTrack(result, smoothWindow);
    }

    // 4. 如果仍然超過最大點數，進一步簡化
    if (result.length > maxPoints) {
      const compressionRatio = result.length / maxPoints;
      result = this.simplifyTrack(result, simplifyEpsilon * compressionRatio);
    }

    return result;
  }

  /**
   * 計算軌跡統計信息
   */
  static calculateStats(points: GpxPoint[]): {
    totalDistance: number; // 米
    totalDuration: number; // 秒
    totalElevation: number; // 米
    maxElevation: number; // 米
    minElevation: number; // 米
    avgSpeed: number; // m/s
    maxSpeed: number; // m/s
  } {
    let totalDistance = 0;
    let totalElevation = 0;
    let maxElevation = -Infinity;
    let minElevation = Infinity;
    let maxSpeed = 0;

    for (let i = 1; i < points.length; i++) {
      const distance = this.haversineDistance(points[i - 1], points[i]);
      totalDistance += distance;

      if (points[i].elevation !== undefined && points[i - 1].elevation !== undefined) {
        const elevation = points[i].elevation!;
        const prevElevation = points[i - 1].elevation!;
        const diff = elevation - prevElevation;
        if (diff > 0) {
          totalElevation += diff;
        }
        maxElevation = Math.max(maxElevation, elevation);
        minElevation = Math.min(minElevation, elevation);
      }

      if (points[i].speed !== undefined) {
        maxSpeed = Math.max(maxSpeed, points[i].speed!);
      }
    }

    const totalDuration = (points[points.length - 1].timestamp || 0) - (points[0].timestamp || 0);
    const avgSpeed = totalDuration > 0 ? totalDistance / totalDuration : 0;

    return {
      totalDistance,
      totalDuration,
      totalElevation,
      maxElevation: maxElevation === -Infinity ? 0 : maxElevation,
      minElevation: minElevation === Infinity ? 0 : minElevation,
      avgSpeed,
      maxSpeed,
    };
  }

  /**
   * 私有方法：計算最大距離
   */
  private static findMaxDistance(points: GpxPoint[]): number {
    let dmax = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const d = this.pointToLineDistance(points[i], points[0], points[points.length - 1]);
      dmax = Math.max(dmax, d);
    }
    return dmax;
  }

  /**
   * 私有方法：找到最大距離的索引
   */
  private static findMaxDistanceIndex(points: GpxPoint[]): number {
    let dmax = 0;
    let index = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const d = this.pointToLineDistance(points[i], points[0], points[points.length - 1]);
      if (d > dmax) {
        dmax = d;
        index = i;
      }
    }
    return index;
  }

  /**
   * 私有方法：點到直線的距離
   */
  private static pointToLineDistance(
    point: GpxPoint,
    lineStart: GpxPoint,
    lineEnd: GpxPoint
  ): number {
    const x = point.latitude;
    const y = point.longitude;
    const x1 = lineStart.latitude;
    const y1 = lineStart.longitude;
    const x2 = lineEnd.latitude;
    const y2 = lineEnd.longitude;

    const numerator = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1);
    const denominator = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * 私有方法：Haversine 距離
   */
  private static haversineDistance(point1: GpxPoint, point2: GpxPoint): number {
    const R = 6371000; // 地球半徑（米）
    const lat1 = (point1.latitude * Math.PI) / 180;
    const lat2 = (point2.latitude * Math.PI) / 180;
    const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLng = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 私有方法：創建分段
   */
  private static createSegment(points: GpxPoint[]): GpxSegment {
    let distance = 0;
    let elevation = 0;

    for (let i = 1; i < points.length; i++) {
      distance += this.haversineDistance(points[i - 1], points[i]);

      if (points[i].elevation !== undefined && points[i - 1].elevation !== undefined) {
        const diff = points[i].elevation! - points[i - 1].elevation!;
        if (diff > 0) {
          elevation += diff;
        }
      }
    }

    const duration = (points[points.length - 1].timestamp || 0) - (points[0].timestamp || 0);

    return {
      points,
      distance,
      duration,
      elevation,
    };
  }
}
