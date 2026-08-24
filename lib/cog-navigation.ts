export interface CogPoint {
  lat: number;
  lon: number;
  timestamp: number;
  accuracyM?: number | null;
}

export interface RouteCogPoint {
  lat: number;
  lon: number;
}

export const COG_WINDOW_MS = 3_000;
export const COG_MIN_DISTANCE_M = 5;
export const ON_TRACK_DISTANCE_M = 20;
export const ROUTE_HEADING_LOOKAHEAD_M = 40;
export const TURN_ANGLE_DEG = 35;
export const TURN_WAKE_DISTANCE_M = 100;
export const TURN_SPEAK_DISTANCE_M = 50;

export function distanceMeters(a: RouteCogPoint, b: RouteCogPoint): number {
  const radiusM = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const latA = (a.lat * Math.PI) / 180;
  const latB = (b.lat * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return radiusM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function bearingDegrees(a: RouteCogPoint, b: RouteCogPoint): number {
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const latA = (a.lat * Math.PI) / 180;
  const latB = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(latB);
  const x = Math.cos(latA) * Math.sin(latB) - Math.sin(latA) * Math.cos(latB) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function signedBearingDeltaDeg(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** 最近三秒可信位置的 COG；沒有足夠位移時維持 null，而不回退至硬體羅盤。 */
export function calculateCourseOverGround(samples: CogPoint[], windowMs = COG_WINDOW_MS): number | null {
  if (samples.length < 2) return null;
  const last = samples.at(-1);
  if (!last) return null;
  const minTimestamp = last.timestamp - windowMs;
  const first = samples.find((sample) => sample.timestamp >= minTimestamp) ?? samples[0];
  if (!Number.isFinite(first.timestamp) || !Number.isFinite(last.timestamp) || last.timestamp <= first.timestamp) return null;
  if (distanceMeters(first, last) < COG_MIN_DISTANCE_M) return null;
  return bearingDegrees(first, last);
}

export function smoothCogHeading(previousHeading: number, candidateHeading: number, alpha = 0.28): number {
  const delta = signedBearingDeltaDeg(previousHeading, candidateHeading);
  return (previousHeading + delta * alpha + 360) % 360;
}

export function findNearestRoutePoint(position: RouteCogPoint, route: RouteCogPoint[]): { index: number; distanceM: number } | null {
  if (route.length === 0) return null;
  let bestIndex = 0;
  let bestDistanceM = Number.POSITIVE_INFINITY;
  route.forEach((point, index) => {
    const nextDistanceM = distanceMeters(position, point);
    if (nextDistanceM < bestDistanceM) {
      bestDistanceM = nextDistanceM;
      bestIndex = index;
    }
  });
  return { index: bestIndex, distanceM: bestDistanceM };
}

export function routeLookaheadHeading(route: RouteCogPoint[], nearestIndex: number, lookaheadM = ROUTE_HEADING_LOOKAHEAD_M): number | null {
  const start = route[nearestIndex];
  if (!start) return null;
  let traveledM = 0;
  for (let index = nearestIndex + 1; index < route.length; index += 1) {
    traveledM += distanceMeters(route[index - 1], route[index]);
    if (traveledM >= lookaheadM) return bearingDegrees(start, route[index]);
  }
  const end = route.at(-1);
  return end && end !== start ? bearingDegrees(start, end) : null;
}

export interface RouteTurn {
  index: number;
  direction: "left" | "right";
  angleDeg: number;
  distanceM: number;
}

/** 以相鄰 GPX 線段的有號方位差判定左右轉；正值代表順時針（右轉）。 */
export function findNextRouteTurn(route: RouteCogPoint[], nearestIndex: number, maximumDistanceM = 250): RouteTurn | null {
  let distanceM = 0;
  for (let index = Math.max(1, nearestIndex + 1); index < route.length - 1; index += 1) {
    distanceM += distanceMeters(route[index - 1], route[index]);
    if (distanceM > maximumDistanceM) return null;
    const incoming = bearingDegrees(route[index - 1], route[index]);
    const outgoing = bearingDegrees(route[index], route[index + 1]);
    const angleDeg = signedBearingDeltaDeg(incoming, outgoing);
    if (Math.abs(angleDeg) >= TURN_ANGLE_DEG) {
      return { index, direction: angleDeg > 0 ? "right" : "left", angleDeg, distanceM };
    }
  }
  return null;
}

export function resolveNavigationCog(input: {
  position: RouteCogPoint;
  route: RouteCogPoint[];
  fallbackCog: number | null;
  onTrackDistanceM?: number;
  lookaheadM?: number;
}): { heading: number | null; onTrack: boolean; nearestIndex: number | null } {
  const nearest = findNearestRoutePoint(input.position, input.route);
  if (!nearest) return { heading: input.fallbackCog, onTrack: false, nearestIndex: null };
  const onTrack = nearest.distanceM <= (input.onTrackDistanceM ?? ON_TRACK_DISTANCE_M);
  const heading = onTrack
    ? routeLookaheadHeading(input.route, nearest.index, input.lookaheadM ?? ROUTE_HEADING_LOOKAHEAD_M) ?? input.fallbackCog
    : input.fallbackCog;
  return { heading, onTrack, nearestIndex: nearest.index };
}

export function shouldWakeForUpcomingTurn(turn: RouteTurn | null): boolean {
  return turn !== null && turn.distanceM <= TURN_WAKE_DISTANCE_M;
}
