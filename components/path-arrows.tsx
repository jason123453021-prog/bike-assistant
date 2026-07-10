import { Feature, LineString, Point } from 'geojson';
import * as turf from '@turf/turf';

/**
 * 路徑箭頭指引功能
 * 
 * 功能：
 * - Douglas-Peucker 演算法軌跡壓縮
 * - 計算箭頭位置（每 100 公尺間隔）
 * - 白色箭頭渲染
 * - 動態調整箭頭密度（基於地圖縮放級別）
 */

export interface ArrowMarker {
  coordinate: [number, number]; // [longitude, latitude]
  bearing: number; // 方向角（0-360 度）
  distance: number; // 距離起點的距離（公尺）
}

/**
 * Douglas-Peucker 演算法軌跡壓縮
 * @param line 線段特徵
 * @param epsilon 簡化精度（推薦 0.00005）
 * @returns 簡化後的線段特徵
 */
export function simplifyTrack(
  line: Feature<LineString>,
  epsilon: number = 0.00005
): Feature<LineString> {
  try {
    return turf.simplify(line, { tolerance: epsilon, highQuality: false });
  } catch (error) {
    console.warn('Simplify error:', error);
    return line;
  }
}

/**
 * 計算箭頭位置
 * @param line 線段特徵
 * @param interval 箭頭間隔（公尺，推薦 100）
 * @param zoomLevel 地圖縮放級別（用於動態調整密度）
 * @returns 箭頭標記數組
 */
export function calculateArrowMarkers(
  line: Feature<LineString>,
  interval: number = 100,
  zoomLevel: number = 15
): ArrowMarker[] {
  if (!line || line.geometry.type !== 'LineString' || line.geometry.coordinates.length < 2) {
    return [];
  }

  const coordinates = line.geometry.coordinates as [number, number][];
  const arrows: ArrowMarker[] = [];

  // 根據縮放級別動態調整間隔
  // 縮放級別越低（越遠），間隔越大；越高（越近），間隔越小
  const adjustedInterval = interval * Math.pow(2, Math.max(0, 15 - zoomLevel) / 2);

  let currentDistance = 0;
  let nextArrowDistance = adjustedInterval;

  // 遍歷所有座標點
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = turf.point(coordinates[i]);
    const end = turf.point(coordinates[i + 1]);

    // 計算當前段的距離
    const segmentDistance = turf.distance(start, end, { units: 'meters' });

    // 檢查是否需要在此段添加箭頭
    while (currentDistance + segmentDistance >= nextArrowDistance) {
      const remainingDistance = nextArrowDistance - currentDistance;
      const ratio = remainingDistance / segmentDistance;

      // 線性插值計算箭頭位置
      const arrowCoord: [number, number] = [
        coordinates[i][0] + (coordinates[i + 1][0] - coordinates[i][0]) * ratio,
        coordinates[i][1] + (coordinates[i + 1][1] - coordinates[i][1]) * ratio,
      ];

      // 計算方向角（基於當前段方向）
      const bearing = turf.bearing(start, end);

      arrows.push({
        coordinate: arrowCoord,
        bearing: bearing,
        distance: nextArrowDistance,
      });

      nextArrowDistance += adjustedInterval;
    }

    currentDistance += segmentDistance;
  }

  return arrows;
}

/**
 * 根據方向角生成箭頭符號
 * @param bearing 方向角（0-360 度）
 * @returns 箭頭符號（> 或 >>）
 */
export function getBearingArrow(bearing: number): string {
  // 正規化方向角到 0-360
  const normalizedBearing = ((bearing % 360) + 360) % 360;

  // 根據方向角返回不同的箭頭符號
  if (normalizedBearing < 45 || normalizedBearing >= 315) {
    return '↑'; // 向上
  } else if (normalizedBearing < 135) {
    return '→'; // 向右
  } else if (normalizedBearing < 225) {
    return '↓'; // 向下
  } else {
    return '←'; // 向左
  }
}

/**
 * 限制軌跡點數
 * @param line 線段特徵
 * @param maxPoints 最大點數（推薦 500）
 * @returns 限制後的線段特徵
 */
export function limitTrackPoints(
  line: Feature<LineString>,
  maxPoints: number = 500
): Feature<LineString> {
  if (!line || line.geometry.type !== 'LineString') {
    return line;
  }

  const coordinates = line.geometry.coordinates as [number, number][];

  if (coordinates.length <= maxPoints) {
    return line;
  }

  // 均勻採樣
  const step = Math.ceil(coordinates.length / maxPoints);
  const sampledCoordinates = coordinates.filter((_, i) => i % step === 0);

  // 確保包含最後一個點
  if (sampledCoordinates[sampledCoordinates.length - 1] !== coordinates[coordinates.length - 1]) {
    sampledCoordinates.push(coordinates[coordinates.length - 1]);
  }

  return turf.lineString(sampledCoordinates);
}

/**
 * 計算軌跡的總距離
 * @param line 線段特徵
 * @returns 距離（公尺）
 */
export function calculateLineDistance(line: Feature<LineString>): number {
  if (!line || line.geometry.type !== 'LineString') {
    return 0;
  }

  try {
    return turf.length(line, { units: 'meters' });
  } catch (error) {
    console.warn('Calculate distance error:', error);
    return 0;
  }
}

/**
 * 獲取軌跡上特定距離的點
 * @param line 線段特徵
 * @param distance 距離（公尺）
 * @returns 座標 [longitude, latitude]
 */
export function getPointAtDistance(
  line: Feature<LineString>,
  distance: number
): [number, number] | null {
  if (!line || line.geometry.type !== 'LineString') {
    return null;
  }

  try {
    const point = turf.along(line, distance / 1000, { units: 'kilometers' });
    return point.geometry.coordinates as [number, number];
  } catch (error) {
    console.warn('Get point at distance error:', error);
    return null;
  }
}
