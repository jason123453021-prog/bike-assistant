import type { RidePhotoTimelineEntry } from "./ride-photo-timeline";
import type { LocationPoint } from "./ride-context";

export interface PhotoRouteMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  source: "exif" | "route-time";
}

const MAX_ROUTE_TIME_OFFSET_MS = 6 * 60 * 60 * 1_000;

function isCoordinatePair(latitude: number | undefined, longitude: number | undefined): latitude is number {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude as number) <= 90 && Math.abs(longitude as number) <= 180;
}

function nearestRoutePoint(route: LocationPoint[], timestamp: number): LocationPoint | undefined {
  let nearest: LocationPoint | undefined;
  let smallestOffset = Number.POSITIVE_INFINITY;
  for (const point of route) {
    const offset = Math.abs(point.timestamp - timestamp);
    if (offset < smallestOffset) {
      nearest = point;
      smallestOffset = offset;
    }
  }
  return smallestOffset <= MAX_ROUTE_TIME_OFFSET_MS ? nearest : undefined;
}

/** 優先採用照片 EXIF GPS，沒有地理標籤時才以拍攝時間配對最接近的本機軌跡點。 */
export function buildPhotoRouteMarkers(entries: RidePhotoTimelineEntry[], route: LocationPoint[]): PhotoRouteMarker[] {
  if (route.length === 0) return [];
  return entries.flatMap<PhotoRouteMarker>((entry, index) => {
    if (isCoordinatePair(entry.latitude, entry.longitude)) {
      return [{ id: entry.id, latitude: entry.latitude, longitude: entry.longitude!, label: `照片 ${index + 1}`, source: "exif" as const }];
    }
    if (!entry.capturedAt) return [];
    const matched = nearestRoutePoint(route, entry.capturedAt);
    if (!matched) return [];
    return [{ id: entry.id, latitude: matched.latitude, longitude: matched.longitude, label: `照片 ${index + 1}`, source: "route-time" as const }];
  });
}
