export interface TrackQualityPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number | null;
  speed?: number | null;
}

export interface AcceptedTrackPoint extends TrackQualityPoint {
  /** 與前一段定位間隔過長時，不在地圖上以直線連接兩點。 */
  segmentStart?: boolean;
}

export interface TrackPointDecision {
  accepted: boolean;
  segmentStart: boolean;
  reason?: "invalid-coordinate" | "poor-accuracy" | "stale-timestamp" | "duplicate" | "impossible-speed" | "resume-gap";
}

/** 與騎乘統計共用的 GPS 精度上限；30 m 內的連續樣本均保留。 */
export const MAX_TRACK_ACCURACY_M = 30;
export const MAX_TRACK_SPEED_KMH = 110;
export const TRACK_RESUME_GAP_MS = 75_000;
export const TRACK_RESUME_BREAK_DISTANCE_M = 80;

export function trackPointDistanceM(a: Pick<TrackQualityPoint, "latitude" | "longitude">, b: Pick<TrackQualityPoint, "latitude" | "longitude">): number {
  const radiusM = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return radiusM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function evaluateTrackPoint(previous: TrackQualityPoint | null, candidate: TrackQualityPoint): TrackPointDecision {
  if (
    !Number.isFinite(candidate.latitude)
    || !Number.isFinite(candidate.longitude)
    || !Number.isFinite(candidate.timestamp)
    || Math.abs(candidate.latitude) > 90
    || Math.abs(candidate.longitude) > 180
  ) {
    return { accepted: false, segmentStart: false, reason: "invalid-coordinate" };
  }

  if (candidate.accuracy !== null && candidate.accuracy !== undefined && candidate.accuracy > MAX_TRACK_ACCURACY_M) {
    return { accepted: false, segmentStart: false, reason: "poor-accuracy" };
  }

  if (!previous) return { accepted: true, segmentStart: false };
  if (candidate.timestamp <= previous.timestamp) {
    return { accepted: false, segmentStart: false, reason: "stale-timestamp" };
  }

  const distanceM = trackPointDistanceM(previous, candidate);
  if (distanceM < 1) return { accepted: false, segmentStart: false, reason: "duplicate" };

  const elapsedMs = candidate.timestamp - previous.timestamp;
  const impliedSpeedKmh = distanceM / (elapsedMs / 1000) * 3.6;
  if (elapsedMs < TRACK_RESUME_GAP_MS && impliedSpeedKmh > MAX_TRACK_SPEED_KMH) {
    return { accepted: false, segmentStart: false, reason: "impossible-speed" };
  }

  const segmentStart = elapsedMs >= TRACK_RESUME_GAP_MS && distanceM >= TRACK_RESUME_BREAK_DISTANCE_M;
  return { accepted: true, segmentStart, reason: segmentStart ? "resume-gap" : undefined };
}

/**
 * 背景任務可能一次交付多筆位置。本函式依時間排序、依序檢核，並以最後接受點作為下一點的判斷基準。
 */
export function filterTrackPointBatch<T extends TrackQualityPoint & { segmentStart?: boolean }>(points: T[], previous: TrackQualityPoint | null): Array<T & { segmentStart?: boolean }> {
  const accepted: Array<T & { segmentStart?: boolean }> = [];
  let anchor = previous;

  for (const point of [...points].sort((a, b) => a.timestamp - b.timestamp)) {
    const decision = evaluateTrackPoint(anchor, point);
    if (!decision.accepted) continue;
    const nextPoint = decision.segmentStart || point.segmentStart ? { ...point, segmentStart: true } : point;
    accepted.push(nextPoint);
    anchor = nextPoint;
  }

  return accepted;
}
