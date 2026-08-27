import type { PoiBounds } from "./poi-layer";

function getCenter(bounds: PoiBounds) {
  return {
    latitude: (bounds.northEast.lat + bounds.southWest.lat) / 2,
    longitude: (bounds.northEast.lon + bounds.southWest.lon) / 2,
  };
}

function getSpan(bounds: PoiBounds) {
  return {
    latitude: Math.abs(bounds.northEast.lat - bounds.southWest.lat),
    longitude: Math.abs(bounds.northEast.lon - bounds.southWest.lon),
  };
}

/**
 * POI 在首次載入時立刻查詢；之後僅在使用者已移動至少約半個可視範圍
 * 或縮放明顯改變時刷新，避免 GPS 每次相機置中都發送重複公開資料請求。
 */
export function shouldRefreshPoiForBounds(
  previous: PoiBounds | null,
  next: PoiBounds,
): boolean {
  if (!previous) return true;

  const previousCenter = getCenter(previous);
  const nextCenter = getCenter(next);
  const previousSpan = getSpan(previous);
  const nextSpan = getSpan(next);
  const latitudeThreshold = Math.max(
    0.006,
    Math.min(previousSpan.latitude, nextSpan.latitude) * 0.45,
  );
  const longitudeThreshold = Math.max(
    0.006,
    Math.min(previousSpan.longitude, nextSpan.longitude) * 0.45,
  );
  const zoomChanged =
    Math.abs(previousSpan.latitude - nextSpan.latitude) /
      Math.max(previousSpan.latitude, 0.0001) >
      0.3 ||
    Math.abs(previousSpan.longitude - nextSpan.longitude) /
      Math.max(previousSpan.longitude, 0.0001) >
      0.3;

  return (
    zoomChanged ||
    Math.abs(previousCenter.latitude - nextCenter.latitude) >=
      latitudeThreshold ||
    Math.abs(previousCenter.longitude - nextCenter.longitude) >=
      longitudeThreshold
  );
}
