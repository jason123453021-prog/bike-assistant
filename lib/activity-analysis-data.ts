import type { LocationPoint } from "./ride-context";

export interface ElevationSample {
  distanceKm: number;
  elevationM: number;
  timestamp: number;
  grade?: number;
}

function distanceMeters(a: LocationPoint, b: LocationPoint): number {
  const radius = 6_371_000;
  const latitudeDelta = ((b.latitude - a.latitude) * Math.PI) / 180;
  const longitudeDelta = ((b.longitude - a.longitude) * Math.PI) / 180;
  const latitudeA = (a.latitude * Math.PI) / 180;
  const latitudeB = (b.latitude * Math.PI) / 180;
  const term = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(term), Math.sqrt(1 - term));
}

/** 從保存的 GPS 點建立距離對海拔的本機資料，不對缺失海拔猜測補值。 */
export function buildElevationSamples(points: LocationPoint[]): ElevationSample[] {
  if (points.length < 2) return [];
  let cumulativeMeters = 0;
  const samples: ElevationSample[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (index > 0) cumulativeMeters += distanceMeters(points[index - 1], point);
    if (point.altitude === null || !Number.isFinite(point.altitude)) continue;
    const previous = samples[samples.length - 1];
    const distanceDeltaM = previous ? (cumulativeMeters / 1000 - previous.distanceKm) * 1000 : 0;
    const grade = previous && distanceDeltaM >= 5
      ? ((point.altitude - previous.elevationM) / distanceDeltaM) * 100
      : undefined;
    samples.push({ distanceKm: cumulativeMeters / 1000, elevationM: point.altitude, timestamp: point.timestamp, grade });
  }
  return samples.length >= 2 ? samples : [];
}

export function downsampleElevationSamples(samples: ElevationSample[], maxPoints = 140): ElevationSample[] {
  if (samples.length <= maxPoints) return samples;
  const step = Math.ceil(samples.length / maxPoints);
  const reduced = samples.filter((_, index) => index % step === 0);
  const last = samples[samples.length - 1];
  if (reduced[reduced.length - 1] !== last) reduced.push(last);
  return reduced;
}
