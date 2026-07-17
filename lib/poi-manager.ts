/**
 * POI 數據管理模組
 * 用於查詢、過濾和管理地圖上的興趣點
 */

import { POI, POIType, POIFilter } from './poi-types';

/**
 * 計算兩點之間的距離（Haversine 公式）
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 地球半徑（公里）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 查找路線上最近的 POI
 */
export function findNearestPOI(
  pois: POI[],
  latitude: number,
  longitude: number,
  maxDistance: number = 5 // 最大距離（公里）
): POI | null {
  let nearest: POI | null = null;
  let minDistance = maxDistance;

  for (const poi of pois) {
    const distance = calculateDistance(latitude, longitude, poi.latitude, poi.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = poi;
    }
  }

  return nearest;
}

/**
 * 查找指定範圍內的 POI
 */
export function findPOIsInRadius(
  pois: POI[],
  latitude: number,
  longitude: number,
  radius: number = 5 // 搜尋半徑（公里）
): POI[] {
  return pois.filter((poi) => {
    const distance = calculateDistance(latitude, longitude, poi.latitude, poi.longitude);
    return distance <= radius;
  });
}

/**
 * 根據過濾條件篩選 POI
 */
export function filterPOIs(pois: POI[], filter: POIFilter): POI[] {
  return pois.filter((poi) => {
    // 按類型篩選
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(poi.type)) {
        return false;
      }
    }

    // 按評分篩選
    if (filter.minRating && poi.rating && poi.rating < filter.minRating) {
      return false;
    }

    return true;
  });
}

/**
 * 按距離排序 POI
 */
export function sortPOIsByDistance(
  pois: POI[],
  latitude: number,
  longitude: number
): POI[] {
  return [...pois].sort((a, b) => {
    const distA = calculateDistance(latitude, longitude, a.latitude, a.longitude);
    const distB = calculateDistance(latitude, longitude, b.latitude, b.longitude);
    return distA - distB;
  });
}

/**
 * 按評分排序 POI
 */
export function sortPOIsByRating(pois: POI[]): POI[] {
  return [...pois].sort((a, b) => {
    const ratingA = a.rating || 0;
    const ratingB = b.rating || 0;
    return ratingB - ratingA;
  });
}

/**
 * 獲取路線沿途的 POI
 */
export function getPOIsAlongRoute(
  pois: POI[],
  routePoints: Array<{ lat: number; lon: number }>,
  searchRadius: number = 1 // 搜尋半徑（公里）
): POI[] {
  const nearbyPOIs = new Set<string>();

  for (const point of routePoints) {
    const nearby = findPOIsInRadius(pois, point.lat, point.lon, searchRadius);
    nearby.forEach((poi) => nearbyPOIs.add(poi.id));
  }

  return pois.filter((poi) => nearbyPOIs.has(poi.id));
}

/**
 * 按類型分組 POI
 */
export function groupPOIsByType(pois: POI[]): Record<POIType, POI[]> {
  const grouped: Record<POIType, POI[]> = {} as Record<POIType, POI[]>;

  for (const poi of pois) {
    if (!grouped[poi.type]) {
      grouped[poi.type] = [];
    }
    grouped[poi.type].push(poi);
  }

  return grouped;
}

/**
 * 生成 POI 統計信息
 */
export function getPOIStats(pois: POI[]) {
  const grouped = groupPOIsByType(pois);
  const stats: Record<string, number> = {};

  for (const [type, items] of Object.entries(grouped)) {
    stats[type] = items.length;
  }

  return {
    total: pois.length,
    byType: stats,
  };
}
