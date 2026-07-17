/**
 * 里程標記計算模組
 * 根據 GPX 路線計算每一公里的標記點位置
 * 用於在地圖上標註遞增的公里數
 */

import { haversineDistance } from "./power-calc";
import type { GpxPoint, GpxRoute } from "./gpx-parser";

export interface KilometerMarker {
  /** 公里數（1, 2, 3, ...） */
  kilometer: number;
  /** 標記點的緯度 */
  lat: number;
  /** 標記點的經度 */
  lon: number;
  /** 標記點的海拔 */
  elevation: number;
  /** 標記點在路線中的累積距離（米） */
  cumulativeDistance: number;
}

/**
 * 計算 GPX 路線上的里程標記
 * 每一公里標註一個遞增的數字
 *
 * @param route GPX 路線
 * @returns 里程標記陣列
 */
export function calculateKilometerMarkers(route: GpxRoute): KilometerMarker[] {
  const markers: KilometerMarker[] = [];
  const points = route.points;

  if (points.length < 2) return markers;

  // 計算每個點的累積距離
  const cumulativeDistances: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );
    cumulativeDistances.push(cumulativeDistances[i - 1] + d);
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  const totalKilometers = Math.floor(totalDistance / 1000);

  // 為每一公里找到對應的點
  for (let km = 1; km <= totalKilometers; km++) {
    const targetDistance = km * 1000; // 目標距離（米）

    // 二分查找找到最接近的點
    let left = 0;
    let right = cumulativeDistances.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (cumulativeDistances[mid] < targetDistance) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // 線性插值計算精確的標記點位置
    const idx1 = left > 0 ? left - 1 : 0;
    const idx2 = left < points.length ? left : points.length - 1;

    const dist1 = cumulativeDistances[idx1];
    const dist2 = cumulativeDistances[idx2];
    const point1 = points[idx1];
    const point2 = points[idx2];

    let lat: number;
    let lon: number;
    let elevation: number;

    if (idx1 === idx2 || dist1 === dist2) {
      // 如果是同一點或距離相同，直接使用該點
      lat = point1.lat;
      lon = point1.lon;
      elevation = point1.ele;
    } else {
      // 線性插值計算標記點的精確位置
      const ratio = (targetDistance - dist1) / (dist2 - dist1);
      lat = point1.lat + (point2.lat - point1.lat) * ratio;
      lon = point1.lon + (point2.lon - point1.lon) * ratio;
      elevation = point1.ele + (point2.ele - point1.ele) * ratio;
    }

    markers.push({
      kilometer: km,
      lat,
      lon,
      elevation: Math.round(elevation),
      cumulativeDistance: targetDistance,
    });
  }

  return markers;
}

/**
 * 根據當前位置找到最近的里程標記
 *
 * @param markers 里程標記陣列
 * @param currentLat 當前緯度
 * @param currentLon 當前經度
 * @returns 最近的里程標記或 null
 */
export function findNearestMarker(
  markers: KilometerMarker[],
  currentLat: number,
  currentLon: number
): KilometerMarker | null {
  if (markers.length === 0) return null;

  let nearest = markers[0];
  let minDistance = haversineDistance(
    currentLat,
    currentLon,
    nearest.lat,
    nearest.lon
  );

  for (let i = 1; i < markers.length; i++) {
    const distance = haversineDistance(
      currentLat,
      currentLon,
      markers[i].lat,
      markers[i].lon
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = markers[i];
    }
  }

  return nearest;
}

/**
 * 找到在指定距離範圍內的里程標記
 *
 * @param markers 里程標記陣列
 * @param currentLat 當前緯度
 * @param currentLon 當前經度
 * @param radiusMeters 搜索半徑（米）
 * @returns 在範圍內的里程標記陣列
 */
export function findMarkersInRadius(
  markers: KilometerMarker[],
  currentLat: number,
  currentLon: number,
  radiusMeters: number = 100
): KilometerMarker[] {
  return markers.filter((marker) => {
    const distance = haversineDistance(
      currentLat,
      currentLon,
      marker.lat,
      marker.lon
    );
    return distance <= radiusMeters;
  });
}
