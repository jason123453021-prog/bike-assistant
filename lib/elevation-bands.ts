import type { RideRecord } from "./ride-context";

const EARTH_RADIUS_M = 6_371_000;

export interface ElevationBand {
  label: string;
  minElevationM: number;
  maxElevationM: number;
  distanceM: number;
  movingTimeSeconds: number;
  ascentM: number;
}

function distanceBetween(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/** 僅由本機 GPS 點建立海拔帶；資料不足時安全回傳空陣列。 */
export function buildElevationBands(record: RideRecord, bandSizeM = 100): ElevationBand[] {
  if (!Number.isFinite(bandSizeM) || bandSizeM < 10 || record.route.length < 2 || record.distance <= 0) return [];
  const groups = new Map<number, { rawDistanceM: number; rawDurationS: number; ascentM: number }>();
  let rawDistanceTotal = 0;

  record.route.slice(1).forEach((current, index) => {
    const previous = record.route[index];
    const altitude = current.altitude ?? previous.altitude;
    if (altitude === null || altitude === undefined || !Number.isFinite(altitude)) return;
    const rawDistanceM = distanceBetween(previous.latitude, previous.longitude, current.latitude, current.longitude);
    if (!Number.isFinite(rawDistanceM) || rawDistanceM <= 0) return;
    rawDistanceTotal += rawDistanceM;
    const start = Math.floor(altitude / bandSizeM) * bandSizeM;
    const entry = groups.get(start) ?? { rawDistanceM: 0, rawDurationS: 0, ascentM: 0 };
    entry.rawDistanceM += rawDistanceM;
    entry.rawDurationS += Math.max(0, (current.timestamp - previous.timestamp) / 1_000);
    entry.ascentM += Math.max(0, (current.altitude ?? altitude) - (previous.altitude ?? altitude));
    groups.set(start, entry);
  });
  if (rawDistanceTotal <= 0) return [];

  const distanceScale = record.distance / rawDistanceTotal;
  const movingTime = Math.max(0, record.movingTime ?? record.duration - record.totalPausedSec);
  const rawDurationTotal = Array.from(groups.values()).reduce((sum, group) => sum + group.rawDurationS, 0);
  return Array.from(groups.entries()).sort(([a], [b]) => a - b).map(([minElevationM, group]) => {
    const maxElevationM = minElevationM + bandSizeM - 1;
    return {
      label: `${Math.round(minElevationM)}–${Math.round(maxElevationM)} m`,
      minElevationM,
      maxElevationM,
      distanceM: Math.round(group.rawDistanceM * distanceScale),
      movingTimeSeconds: Math.round(rawDurationTotal > 0 ? group.rawDurationS * (movingTime / rawDurationTotal) : 0),
      ascentM: Math.round(group.ascentM * 10) / 10,
    };
  });
}
