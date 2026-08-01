/**
 * 地圖導航管理模組
 * 處理 GPX 軌跡、路徑規劃、方向箭頭等地圖相關功能
 */

export interface GPXRoute {
  id: string;
  name: string;
  coordinates: Array<{
    lat: number;
    lon: number;
    ele: number;
    timestamp?: number;
  }>;
  totalDistance: number; // km
  totalAscent: number; // m
  totalDescent: number; // m
  createdAt: number;
}

export interface NavigationPoint {
  lat: number;
  lon: number;
  instruction: string;
  distance: number; // km to next turn
  bearing: number; // degrees 0-360
}

export interface RouteArrow {
  lat: number;
  lon: number;
  bearing: number; // 方向角度
  index: number; // 在路線中的索引
}

/**
 * 解析 GPX 文件內容
 */
export function parseGPXContent(gpxContent: string): GPXRoute | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      console.error('[MapNav] GPX parsing error');
      return null;
    }

    // 提取軌跡點
    const trkpts = xmlDoc.getElementsByTagName('trkpt');
    const coordinates: GPXRoute['coordinates'] = [];

    for (let i = 0; i < trkpts.length; i++) {
      const trkpt = trkpts[i];
      const lat = parseFloat(trkpt.getAttribute('lat') || '0');
      const lon = parseFloat(trkpt.getAttribute('lon') || '0');
      
      const eleElement = trkpt.getElementsByTagName('ele')[0];
      const ele = eleElement ? parseFloat(eleElement.textContent || '0') : 0;
      
      const timeElement = trkpt.getElementsByTagName('time')[0];
      const timestamp = timeElement ? new Date(timeElement.textContent || '').getTime() : undefined;

      coordinates.push({ lat, lon, ele, timestamp });
    }

    if (coordinates.length === 0) {
      console.error('[MapNav] No coordinates found in GPX');
      return null;
    }

    // 計算路線統計
    const stats = calculateRouteStats(coordinates);

    // 提取路線名稱
    const nameElement = xmlDoc.getElementsByTagName('name')[0];
    const name = nameElement ? nameElement.textContent || 'Imported Route' : 'Imported Route';

    return {
      id: `gpx-${Date.now()}`,
      name,
      coordinates,
      totalDistance: stats.totalDistance,
      totalAscent: stats.totalAscent,
      totalDescent: stats.totalDescent,
      createdAt: Date.now(),
    };
  } catch (error) {
    console.error('[MapNav] Error parsing GPX:', error);
    return null;
  }
}

/**
 * 計算路線統計信息
 */
export function calculateRouteStats(coordinates: GPXRoute['coordinates']): {
  totalDistance: number;
  totalAscent: number;
  totalDescent: number;
} {
  let totalDistance = 0;
  let totalAscent = 0;
  let totalDescent = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];

    // 計算水平距離（Haversine 公式）
    const distance = calculateHaversineDistance(
      prev.lat,
      prev.lon,
      curr.lat,
      curr.lon
    );
    totalDistance += distance;

    // 計算爬升/下降
    const elevationDiff = curr.ele - prev.ele;
    if (elevationDiff > 0) {
      totalAscent += elevationDiff;
    } else {
      totalDescent += Math.abs(elevationDiff);
    }
  }

  return {
    totalDistance: totalDistance / 1000, // 轉換為 km
    totalAscent,
    totalDescent,
  };
}

/**
 * Haversine 公式：計算兩點間的距離（米）
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // 地球半徑（米）
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 角度轉弧度
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * 計算方向角（bearing）
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * 生成方向箭頭點
 * 使用抽樣演算法根據縮放級別調整箭頭密度
 */
export function generateRouteArrows(
  coordinates: GPXRoute['coordinates'],
  zoomLevel: number = 15
): RouteArrow[] {
  if (coordinates.length < 2) return [];

  // 根據縮放級別調整抽樣間隔
  let sampleInterval = 1;
  if (zoomLevel < 12) sampleInterval = 20; // 遠距離時每 20 個點一個箭頭
  else if (zoomLevel < 14) sampleInterval = 10; // 中距離時每 10 個點一個箭頭
  else if (zoomLevel < 16) sampleInterval = 5; // 近距離時每 5 個點一個箭頭
  // 否則每 2 個點一個箭頭

  const arrows: RouteArrow[] = [];

  for (let i = sampleInterval; i < coordinates.length; i += sampleInterval) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];

    const bearing = calculateBearing(prev.lat, prev.lon, curr.lat, curr.lon);

    arrows.push({
      lat: curr.lat,
      lon: curr.lon,
      bearing,
      index: i,
    });
  }

  return arrows;
}

/**
 * 檢測用戶是否偏離路線
 */
export function checkRouteDeviation(
  userLat: number,
  userLon: number,
  routeCoordinates: GPXRoute['coordinates'],
  deviationThreshold: number = 100 // 100 米
): {
  isDeviated: boolean;
  nearestPoint: GPXRoute['coordinates'][0] | null;
  distance: number;
} {
  let minDistance = Infinity;
  let nearestPoint: GPXRoute['coordinates'][0] | null = null;

  for (const coord of routeCoordinates) {
    const distance = calculateHaversineDistance(userLat, userLon, coord.lat, coord.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = coord;
    }
  }

  return {
    isDeviated: minDistance > deviationThreshold,
    nearestPoint,
    distance: minDistance,
  };
}

/**
 * 重新規劃路徑回到原路線
 * 返回從當前位置到最近路線點的路徑
 */
export function replanRouteToNearest(
  userLat: number,
  userLon: number,
  routeCoordinates: GPXRoute['coordinates']
): GPXRoute['coordinates'] {
  let minDistance = Infinity;
  let nearestIndex = 0;

  // 找到最近的路線點
  for (let i = 0; i < routeCoordinates.length; i++) {
    const coord = routeCoordinates[i];
    const distance = calculateHaversineDistance(userLat, userLon, coord.lat, coord.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = i;
    }
  }

  // 返回從最近點開始的剩餘路線
  return routeCoordinates.slice(nearestIndex);
}

/**
 * 計算剩餘距離
 */
export function calculateRemainingDistance(
  userLat: number,
  userLon: number,
  remainingCoordinates: GPXRoute['coordinates']
): number {
  if (remainingCoordinates.length === 0) return 0;

  let distance = 0;

  // 從當前位置到第一個路線點
  distance += calculateHaversineDistance(
    userLat,
    userLon,
    remainingCoordinates[0].lat,
    remainingCoordinates[0].lon
  );

  // 路線點之間的距離
  for (let i = 1; i < remainingCoordinates.length; i++) {
    const prev = remainingCoordinates[i - 1];
    const curr = remainingCoordinates[i];
    distance += calculateHaversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
  }

  return distance / 1000; // 轉換為 km
}

/**
 * 計算預估到達時間
 */
export function calculateETA(
  remainingDistance: number, // km
  currentSpeed: number // km/h
): number {
  if (currentSpeed === 0) return 0;
  return (remainingDistance / currentSpeed) * 3600; // 返回秒數
}

/**
 * 格式化時間
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * 檢測多重軌跡衝突
 */
export function detectMultipleRouteConflict(
  existingRoute: GPXRoute | null,
  newRoute: GPXRoute
): boolean {
  if (!existingRoute) return false;

  // 如果兩條路線都有座標，則存在衝突
  return existingRoute.coordinates.length > 0 && newRoute.coordinates.length > 0;
}

/**
 * 合併兩條路線（以不同顏色顯示）
 */
export function mergeRoutes(
  route1: GPXRoute,
  route2: GPXRoute
): Array<{ route: GPXRoute; color: string }> {
  return [
    { route: route1, color: '#3498db' }, // 藍色
    { route: route2, color: '#e74c3c' }, // 紅色
  ];
}
