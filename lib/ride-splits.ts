import type { LocationPoint, RideRecord } from "./ride-context";

const EARTH_RADIUS_M = 6_371_000;

export interface RideSplit {
  index: number;
  distanceM: number;
  movingTimeSeconds: number;
  averageSpeedKmh?: number;
  ascentM: number;
  descentM: number;
  averagePowerW?: number;
}

function distanceBetween(a: LocationPoint, b: LocationPoint): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(b.latitude - a.latitude);
  const deltaLongitude = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function finitePositive(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * 以本機 GPS 軌跡重建固定距離分段；保留最後不足一公里的收尾段。
 * 路徑在儲存時可能已抽樣，因此以正式總距離校正軌跡距離，避免詳情頁
 * 顯示的分段總和與騎乘紀錄總距離不一致。
 */
export function buildRideSplits(record: RideRecord, splitDistanceM = 1_000): RideSplit[] {
  if (!Number.isFinite(splitDistanceM) || splitDistanceM < 100 || record.route.length < 2 || record.distance <= 0) return [];

  const rawSegments = record.route.slice(1).map((current, index) => {
    const previous = record.route[index];
    const distanceM = distanceBetween(previous, current);
    return {
      previous,
      current,
      distanceM: Number.isFinite(distanceM) && distanceM > 0 ? distanceM : 0,
    };
  }).filter((segment) => segment.distanceM > 0);
  const rawDistanceM = rawSegments.reduce((sum, segment) => sum + segment.distanceM, 0);
  if (rawDistanceM <= 0) return [];

  const distanceScale = record.distance / rawDistanceM;
  const movingTime = Math.max(0, record.movingTime ?? record.duration - record.totalPausedSec);
  const timestampDuration = rawSegments.reduce((sum, segment) => {
    const delta = (segment.current.timestamp - segment.previous.timestamp) / 1_000;
    return sum + (Number.isFinite(delta) && delta > 0 ? delta : 0);
  }, 0);
  const timeScale = timestampDuration > 0 ? movingTime / timestampDuration : 0;

  const splits: Array<RideSplit & { powerSum: number; powerDistance: number }> = [];
  let current = {
    index: 1,
    distanceM: 0,
    movingTimeSeconds: 0,
    ascentM: 0,
    descentM: 0,
    powerSum: 0,
    powerDistance: 0,
  };

  const pushCurrent = () => {
    if (current.distanceM <= 0) return;
    const averageSpeedKmh = current.movingTimeSeconds > 0
      ? (current.distanceM / 1_000) / (current.movingTimeSeconds / 3_600)
      : undefined;
    splits.push({
      index: current.index,
      distanceM: current.distanceM,
      movingTimeSeconds: current.movingTimeSeconds,
      averageSpeedKmh,
      ascentM: current.ascentM,
      descentM: current.descentM,
      averagePowerW: current.powerDistance > 0 ? current.powerSum / current.powerDistance : undefined,
      powerSum: 0,
      powerDistance: 0,
    });
    current = {
      index: current.index + 1,
      distanceM: 0,
      movingTimeSeconds: 0,
      ascentM: 0,
      descentM: 0,
      powerSum: 0,
      powerDistance: 0,
    };
  };

  rawSegments.forEach((segment) => {
    let remainingDistance = segment.distanceM * distanceScale;
    const altitudeDelta = finitePositive(segment.current.altitude !== null && segment.previous.altitude !== null
      ? segment.current.altitude - segment.previous.altitude
      : undefined) ?? 0;
    const descentDelta = finitePositive(segment.current.altitude !== null && segment.previous.altitude !== null
      ? segment.previous.altitude - segment.current.altitude
      : undefined) ?? 0;
    const rawDeltaTime = Math.max(0, (segment.current.timestamp - segment.previous.timestamp) / 1_000);
    const segmentTime = timestampDuration > 0
      ? rawDeltaTime * timeScale
      : (remainingDistance / record.distance) * movingTime;
    const power = [segment.previous.power, segment.current.power]
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
    const segmentPower = power.length ? power.reduce((sum, value) => sum + value, 0) / power.length : undefined;

    while (remainingDistance > 0.001) {
      const capacity = splitDistanceM - current.distanceM;
      const portionDistance = Math.min(remainingDistance, capacity);
      const portion = portionDistance / (segment.distanceM * distanceScale);
      current.distanceM += portionDistance;
      current.movingTimeSeconds += segmentTime * portion;
      current.ascentM += altitudeDelta * portion;
      current.descentM += descentDelta * portion;
      if (segmentPower !== undefined) {
        current.powerSum += segmentPower * portionDistance;
        current.powerDistance += portionDistance;
      }
      remainingDistance -= portionDistance;
      if (current.distanceM >= splitDistanceM - 0.001) pushCurrent();
    }
  });

  pushCurrent();
  return splits.map(({ powerSum: _powerSum, powerDistance: _powerDistance, ...split }) => ({
    ...split,
    distanceM: Math.round(split.distanceM),
    movingTimeSeconds: Math.round(split.movingTimeSeconds),
    ascentM: Math.round(split.ascentM * 10) / 10,
    descentM: Math.round(split.descentM * 10) / 10,
    averageSpeedKmh: split.averageSpeedKmh === undefined ? undefined : Math.round(split.averageSpeedKmh * 10) / 10,
    averagePowerW: split.averagePowerW === undefined ? undefined : Math.round(split.averagePowerW),
  }));
}
