export interface ActivityMapCoordinate {
  latitude: number;
  longitude: number;
}

/**
 * 活動詳情地圖只需展示整體路線，不需要在每次縮放或拖曳時重繪所有 GPS 點。
 * 均勻抽樣會保留起訖點，將 WebView 傳輸與 Leaflet polyline 負載限制在安全範圍。
 */
export function sampleActivityMapPolyline<T extends ActivityMapCoordinate>(
  coordinates: T[],
  maximumPoints = 220,
): T[] {
  if (coordinates.length <= maximumPoints || maximumPoints < 3) return coordinates;

  const interiorPointCount = coordinates.length - 2;
  const interiorCapacity = maximumPoints - 2;
  const step = Math.ceil(interiorPointCount / interiorCapacity);
  const sampled = [coordinates[0]];
  for (let index = step; index < coordinates.length - 1; index += step) {
    sampled.push(coordinates[index]);
  }
  const lastPoint = coordinates[coordinates.length - 1];
  if (sampled[sampled.length - 1] !== lastPoint) sampled.push(lastPoint);
  return sampled;
}
