import { calculateNormalizedPowerFromHistory } from "./tss-calc";
import type { LocationPoint, RideActivityType, RideCalculationProfile, RideRecord, SportType, SupplyConfirmation } from "./ride-context";

const EARTH_RADIUS_M = 6_371_000;

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function normalizeLocationPoint(value: unknown, fallbackTimestamp: number): LocationPoint | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Partial<LocationPoint>;
  const latitude = finiteNumber(point.latitude, Number.NaN);
  const longitude = finiteNumber(point.longitude, Number.NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !validCoordinate(latitude, longitude)) return null;

  const altitude = finiteNumber(point.altitude, Number.NaN);
  const speed = finiteNumber(point.speed, Number.NaN);
  const timestamp = finiteNumber(point.timestamp, fallbackTimestamp);
  return {
    latitude,
    longitude,
    altitude: Number.isFinite(altitude) ? altitude : null,
    speed: Number.isFinite(speed) && speed >= 0 ? speed : null,
    timestamp: timestamp > 0 ? timestamp : fallbackTimestamp,
    power: Number.isFinite(finiteNumber(point.power, Number.NaN)) ? Math.max(0, finiteNumber(point.power)) : undefined,
    heartRate: Number.isFinite(finiteNumber(point.heartRate, Number.NaN)) ? Math.max(0, finiteNumber(point.heartRate)) : undefined,
    cadence: Number.isFinite(finiteNumber(point.cadence, Number.NaN)) ? Math.max(0, finiteNumber(point.cadence)) : undefined,
    slope: Number.isFinite(finiteNumber(point.slope, Number.NaN)) ? finiteNumber(point.slope) : undefined,
  };
}

function distanceBetween(a: LocationPoint, b: LocationPoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export interface TerrainMetrics {
  totalAscent: number;
  totalDescent: number;
  maxElevation?: number;
  minElevation?: number;
  averageGrade?: number;
  maxGrade?: number;
}

/** 從已儲存的軌跡安全重建地形資料；沒有可靠高度樣本時不偽造數值。 */
export function calculateTerrainMetrics(route: LocationPoint[]): TerrainMetrics {
  const elevations = route.flatMap((point) => (typeof point.altitude === "number" && Number.isFinite(point.altitude) ? [point.altitude] : []));
  if (elevations.length === 0) return { totalAscent: 0, totalDescent: 0 };

  let totalAscent = 0;
  let totalDescent = 0;
  let horizontalDistance = 0;
  let maxGrade = 0;

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    if (previous.altitude === null || current.altitude === null) continue;
    const segmentDistance = distanceBetween(previous, current);
    // 跳過重複 GPS 點，避免除以零及無意義坡度。
    if (!Number.isFinite(segmentDistance) || segmentDistance < 1) continue;
    const altitudeDifference = current.altitude - previous.altitude;
    horizontalDistance += segmentDistance;
    if (altitudeDifference > 0) totalAscent += altitudeDifference;
    if (altitudeDifference < 0) totalDescent += Math.abs(altitudeDifference);
    if (altitudeDifference > 0) maxGrade = Math.max(maxGrade, (altitudeDifference / segmentDistance) * 100);
  }

  return {
    totalAscent,
    totalDescent,
    maxElevation: Math.max(...elevations),
    minElevation: Math.min(...elevations),
    averageGrade: horizontalDistance > 0 ? (totalAscent / horizontalDistance) * 100 : undefined,
    maxGrade: horizontalDistance > 0 ? maxGrade : undefined,
  };
}

function normalizePowerZones(value: unknown): number[] {
  if (!Array.isArray(value)) return [0, 0, 0, 0, 0];
  return Array.from({ length: 5 }, (_, index) => Math.round(nonNegative(value[index])));
}

function normalizedOptional(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeCalculationProfile(value: unknown): RideCalculationProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const profile = value as Partial<RideCalculationProfile>;
  const riderWeightKg = normalizedOptional(profile.riderWeightKg);
  const bikeWeightKg = normalizedOptional(profile.bikeWeightKg);
  const ftpW = normalizedOptional(profile.ftpW);
  if (!riderWeightKg || !bikeWeightKg || !ftpW || riderWeightKg <= 0 || bikeWeightKg <= 0 || ftpW <= 0) return undefined;

  const environmentValue = profile.environment;
  const environment = environmentValue && typeof environmentValue === "object"
    ? (() => {
      const source = environmentValue.source === "live-weather" ? "live-weather" : "offline-fallback";
      return {
        sampleCount: Math.round(nonNegative(environmentValue.sampleCount)),
        averageTemperatureC: normalizedOptional(environmentValue.averageTemperatureC),
        averageHumidityPct: normalizedOptional(environmentValue.averageHumidityPct),
        averageWindSpeedKmh: normalizedOptional(environmentValue.averageWindSpeedKmh),
        averageHeadwindMs: normalizedOptional(environmentValue.averageHeadwindMs),
        averagePrecipitationProb: normalizedOptional(environmentValue.averagePrecipitationProb),
        weatherCode: normalizedOptional(environmentValue.weatherCode),
        source,
      } as RideCalculationProfile["environment"];
    })()
    : undefined;

  return { riderWeightKg, bikeWeightKg, ftpW, environment };
}

function normalizeSupplyConfirmations(value: unknown): SupplyConfirmation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const confirmations = value.flatMap((candidate): SupplyConfirmation[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<SupplyConfirmation>;
    if (item.type !== "energy" && item.type !== "water") return [];
    const timestamp = normalizedOptional(item.timestamp);
    const elapsedSec = normalizedOptional(item.elapsedSec);
    if (timestamp === undefined || timestamp <= 0 || elapsedSec === undefined || elapsedSec < 0) return [];
    const source = item.source === "smart" || item.source === "smart-offline-fallback" || item.source === "custom"
      ? item.source
      : undefined;
    return [{
      type: item.type,
      timestamp,
      elapsedSec,
      recommendedEnergyKcal: normalizedOptional(item.recommendedEnergyKcal),
      recommendedCarbohydrateG: normalizedOptional(item.recommendedCarbohydrateG),
      recommendedWaterMl: normalizedOptional(item.recommendedWaterMl),
      source,
      reason: typeof item.reason === "string" && item.reason.trim() ? item.reason.trim().slice(0, 160) : undefined,
    }];
  });
  return confirmations.sort((a, b) => a.timestamp - b.timestamp).slice(-100);
}

function normalizeActivityType(value: unknown): RideActivityType {
  return value === "road" || value === "gravel" || value === "mountain" || value === "commute" || value === "indoor" || value === "other"
    ? value
    : "road";
}

function normalizeSportType(value: unknown): SportType {
  return value === "running" || value === "hiking" || value === "trail_running" || value === "cycling"
    ? value
    : "cycling";
}

function normalizeRpe(value: unknown): number | undefined {
  const rpe = normalizedOptional(value);
  return rpe !== undefined && rpe >= 1 && rpe <= 10 ? Math.round(rpe) : undefined;
}

/**
 * 將歷史、匯入與新建騎乘資料轉為同一個安全模型。
 * 僅接受具有數值距離與軌跡陣列的記錄；缺失的衍生數據會由本機軌跡補齊。
 */
export function normalizeRideRecord(value: unknown, fallbackId?: string): RideRecord | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<RideRecord>;
  if (!Array.isArray(source.route) || typeof source.distance !== "number" || !Number.isFinite(source.distance) || source.distance < 0) return null;

  const date = finiteNumber(source.date, Date.now());
  const route = source.route.flatMap((point, index) => {
    const normalized = normalizeLocationPoint(point, date + index * 1000);
    return normalized ? [normalized] : [];
  });
  const duration = nonNegative(source.duration);
  const totalPausedSec = Math.min(duration, nonNegative(source.totalPausedSec));
  const movingTime = Math.max(0, duration - totalPausedSec);
  const terrain = calculateTerrainMetrics(route);
  const storedAscent = nonNegative(source.totalAscent);
  const storedDescent = nonNegative(source.totalDescent);
  const hasTerrainAltitude = terrain.maxElevation !== undefined;
  const storedMaxElevation = normalizedOptional(source.maxElevation);
  const storedMinElevation = normalizedOptional(source.minElevation);
  const storedAverageGrade = normalizedOptional(source.averageGrade);
  const storedMaxGrade = normalizedOptional(source.maxGrade);
  const powerHistory = Array.isArray(source.powerHistory)
    ? source.powerHistory.filter((power): power is number => typeof power === "number" && Number.isFinite(power) && power >= 0)
    : [];
  const derivedAveragePower = powerHistory.length
    ? powerHistory.reduce((sum, power) => sum + power, 0) / powerHistory.length
    : 0;
  const averagePower = nonNegative(source.avgPower, derivedAveragePower || 0) || derivedAveragePower;
  const maxPower = Math.max(nonNegative(source.maxPower), ...powerHistory, 0);
  const derivedNormalizedPower = calculateNormalizedPowerFromHistory(powerHistory, movingTime);
  const recordId = typeof source.id === "string" && source.id.trim() ? source.id.trim() : fallbackId ?? `legacy-${date}`;
  const name = typeof source.name === "string" && source.name.trim() ? source.name.trim() : "匯入騎乘紀錄";

  return {
    id: recordId,
    date,
    name,
    duration,
    distance: nonNegative(source.distance),
    avgSpeed: movingTime > 0 ? (nonNegative(source.distance) / 1000) / (movingTime / 3600) : nonNegative(source.avgSpeed),
    maxSpeed: nonNegative(source.maxSpeed),
    totalAscent: storedAscent > 0 || terrain.totalAscent === 0 ? storedAscent : terrain.totalAscent,
    totalDescent: storedDescent > 0 || terrain.totalDescent === 0 ? storedDescent : terrain.totalDescent,
    maxElevation: hasTerrainAltitude && (storedMaxElevation === undefined || (storedMaxElevation === 0 && terrain.maxElevation !== 0)) ? terrain.maxElevation : storedMaxElevation,
    minElevation: hasTerrainAltitude && (storedMinElevation === undefined || (storedMinElevation === 0 && terrain.minElevation !== 0)) ? terrain.minElevation : storedMinElevation,
    averageGrade: terrain.averageGrade !== undefined && (!storedAverageGrade || storedAverageGrade < 0) ? terrain.averageGrade : storedAverageGrade,
    maxGrade: terrain.maxGrade !== undefined && (!storedMaxGrade || storedMaxGrade < 0) ? terrain.maxGrade : storedMaxGrade,
    movingTime,
    calories: nonNegative(source.calories),
    avgPower: Math.round(averagePower),
    maxPower: Math.round(maxPower),
    normalizedPower: derivedNormalizedPower ?? normalizedOptional(source.normalizedPower),
    intensityFactor: normalizedOptional(source.intensityFactor),
    tss: normalizedOptional(source.tss),
    powerZones: normalizePowerZones(source.powerZones),
    powerHistory,
    route,
    totalSweatMl: nonNegative(source.totalSweatMl),
    refillCount: Math.round(nonNegative(source.refillCount)),
    totalPausedSec,
    avgHeartRate: normalizedOptional(source.avgHeartRate),
    maxHeartRate: normalizedOptional(source.maxHeartRate),
    avgCadence: normalizedOptional(source.avgCadence),
    maxCadence: normalizedOptional(source.maxCadence),
    gradeDistribution: Array.isArray(source.gradeDistribution) ? source.gradeDistribution.map((v) => nonNegative(v)) : [0, 0, 0, 0, 0, 0],
    gradeAscentDistribution: Array.isArray(source.gradeAscentDistribution) ? source.gradeAscentDistribution.map((v) => nonNegative(v)) : [0, 0, 0, 0, 0, 0],
    personalBests: Array.isArray(source.personalBests) ? source.personalBests : undefined,
    calculationProfile: normalizeCalculationProfile(source.calculationProfile),
    supplyConfirmations: normalizeSupplyConfirmations(source.supplyConfirmations),
    description: typeof source.description === "string" ? source.description : undefined,
    activityType: normalizeActivityType(source.activityType),
    sportType: normalizeSportType(source.sportType),
    equipment: typeof source.equipment === "string" && source.equipment.trim() ? source.equipment.trim().slice(0, 80) : undefined,
    perceivedExertion: normalizeRpe(source.perceivedExertion),
    perceivedExertionSource: source.perceivedExertionSource === "manual" || source.perceivedExertionSource === "app-estimate" ? source.perceivedExertionSource : undefined,
    mediaItems: Array.isArray(source.mediaItems) ? source.mediaItems.filter((uri): uri is string => typeof uri === "string") : undefined,
    coverPhotoUri: typeof source.coverPhotoUri === "string" && source.coverPhotoUri.trim() ? source.coverPhotoUri.trim() : undefined,
    segmentAchievements: Array.isArray(source.segmentAchievements) ? source.segmentAchievements : undefined,
  };
}

/** 保留每個 ID 的第一筆有效資料、日期新到舊排序，避免歷史列表重複及無效紀錄污染統計。 */
export function normalizeRideRecords(value: unknown): RideRecord[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const normalized: RideRecord[] = [];
  value.forEach((candidate, index) => {
    const record = normalizeRideRecord(candidate, `legacy-${index}`);
    if (!record || seenIds.has(record.id)) return;
    seenIds.add(record.id);
    normalized.push(record);
  });
  return normalized.sort((a, b) => b.date - a.date);
}
