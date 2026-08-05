/**
 * GPX 軌跡方向箭頭管理
 * 
 * 功能：
 * 1. 沿著 GPX 軌跡點以適當間隔疊加方向箭頭
 * 2. 根據地圖縮放級別動態調整箭頭密度
 * 3. 確保地圖滑動順暢不卡頓
 */

export interface GPXPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp?: number;
}

export interface ArrowMarker {
  id: string;
  latitude: number;
  longitude: number;
  heading: number; // 0-360 度
  size: number; // 箭頭大小
}

export interface ArrowConfig {
  baseInterval: number; // 基礎間隔（米）
  minZoom: number; // 最小縮放級別
  maxZoom: number; // 最大縮放級別
  arrowSize: number; // 箭頭大小（像素）
}

const DEFAULT_CONFIG: ArrowConfig = {
  baseInterval: 100, // 100 米
  minZoom: 10,
  maxZoom: 20,
  arrowSize: 24,
};

/**
 * 計算兩點間距離（單位：米）
 */
function calculateDistance(point1: GPXPoint, point2: GPXPoint): number {
  const R = 6371000; // 地球半徑（米）
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
 * 計算方向（0-360 度）
 */
function calculateHeading(from: GPXPoint, to: GPXPoint): number {
  const dLat = to.latitude - from.latitude;
  const dLon = to.longitude - from.longitude;

  let heading = Math.atan2(dLon, dLat) * (180 / Math.PI);

  if (heading < 0) {
    heading += 360;
  }

  return heading;
}

/**
 * 根據縮放級別計算箭頭間隔
 */
function calculateArrowInterval(zoom: number, config: ArrowConfig): number {
  // 縮放級別越小，箭頭間隔越大
  const zoomFactor = Math.pow(2, config.maxZoom - zoom);
  return config.baseInterval * zoomFactor;
}

/**
 * 生成方向箭頭標記
 */
export function generateArrowMarkers(
  gpxPoints: GPXPoint[],
  zoom: number,
  config: Partial<ArrowConfig> = {}
): ArrowMarker[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (gpxPoints.length < 2) {
    return [];
  }

  const arrows: ArrowMarker[] = [];
  const interval = calculateArrowInterval(zoom, finalConfig);

  let accumulatedDistance = 0;
  let lastArrowIndex = 0;

  for (let i = 1; i < gpxPoints.length; i++) {
    const distance = calculateDistance(gpxPoints[i - 1], gpxPoints[i]);
    accumulatedDistance += distance;

    // 當累積距離達到間隔時，添加箭頭
    if (accumulatedDistance >= interval) {
      const heading = calculateHeading(gpxPoints[i - 1], gpxPoints[i]);

      arrows.push({
        id: `arrow_${i}`,
        latitude: gpxPoints[i].latitude,
        longitude: gpxPoints[i].longitude,
        heading,
        size: finalConfig.arrowSize,
      });

      accumulatedDistance = 0;
      lastArrowIndex = i;
    }
  }

  // 確保最後一個點也有箭頭
  if (lastArrowIndex < gpxPoints.length - 1) {
    const lastPoint = gpxPoints[gpxPoints.length - 1];
    const prevPoint = gpxPoints[gpxPoints.length - 2];
    const heading = calculateHeading(prevPoint, lastPoint);

    arrows.push({
      id: `arrow_${gpxPoints.length - 1}`,
      latitude: lastPoint.latitude,
      longitude: lastPoint.longitude,
      heading,
      size: finalConfig.arrowSize,
    });
  }

  return arrows;
}

/**
 * 優化箭頭標記（移除重複或過近的箭頭）
 */
export function optimizeArrowMarkers(
  arrows: ArrowMarker[],
  minDistance: number = 50 // 最小距離（米）
): ArrowMarker[] {
  if (arrows.length <= 1) {
    return arrows;
  }

  const optimized: ArrowMarker[] = [arrows[0]];

  for (let i = 1; i < arrows.length; i++) {
    const lastArrow = optimized[optimized.length - 1];
    const distance = calculateDistance(
      { latitude: lastArrow.latitude, longitude: lastArrow.longitude },
      { latitude: arrows[i].latitude, longitude: arrows[i].longitude }
    );

    // 只添加距離足夠遠的箭頭
    if (distance >= minDistance) {
      optimized.push(arrows[i]);
    }
  }

  return optimized;
}

/**
 * 根據視圖邊界過濾箭頭（只顯示可見區域的箭頭）
 */
export function filterArrowsByBounds(
  arrows: ArrowMarker[],
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  }
): ArrowMarker[] {
  return arrows.filter(
    (arrow) =>
      arrow.latitude >= bounds.minLat &&
      arrow.latitude <= bounds.maxLat &&
      arrow.longitude >= bounds.minLon &&
      arrow.longitude <= bounds.maxLon
  );
}

/**
 * 計算箭頭旋轉角度（用於 SVG 或圖像旋轉）
 */
export function getArrowRotation(heading: number): number {
  // 轉換為 CSS 旋轉角度（0° 指向上方）
  return heading;
}

/**
 * 生成箭頭 SVG 路徑
 */
export function generateArrowSVG(size: number = 24): string {
  const halfSize = size / 2;
  const tipSize = size * 0.3;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.5"/>
        </filter>
      </defs>
      <polygon points="${halfSize},${tipSize} ${halfSize + tipSize},${size} ${halfSize - tipSize},${size}" 
               fill="#4CAF50" stroke="#2E7D32" stroke-width="1" filter="url(#shadow)"/>
    </svg>
  `;
}

/**
 * 批量更新箭頭（用於地圖縮放或平移時）
 */
export function updateArrowsOnMapChange(
  gpxPoints: GPXPoint[],
  zoom: number,
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  },
  config: Partial<ArrowConfig> = {}
): ArrowMarker[] {
  // 生成箭頭
  let arrows = generateArrowMarkers(gpxPoints, zoom, config);

  // 優化箭頭
  arrows = optimizeArrowMarkers(arrows);

  // 過濾可見區域
  arrows = filterArrowsByBounds(arrows, bounds);

  return arrows;
}
