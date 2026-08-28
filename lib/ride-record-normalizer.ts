import { calculateNormalizedPowerFromHistory } from "./tss-calc";
import type {
  LocationPoint,
  RideActivityType,
  RideCalculationProfile,
  RideLap,
  RideRecord,
  SportType,
  SupplyConfirmation,
} from "./ride-context";
import {
  calculateCalories,
  calculateCaloriesMET,
  calculatePower,
  DEFAULT_ROAD_BIKE_MASS_KG,
} from "./power-calc";
import {
  acceptLiveElevationDelta,
  clampVirtualPowerForRider,
  createLiveElevationFilterState,
} from "./live-elevation-filter";
import { hasReliableRideMovement } from "./live-ride-readings";
import { MAX_CONTIGUOUS_GPS_STATISTICS_INTERVAL_SEC } from "./activity-statistics";
import { analyzeTraining } from "./tss-calc";

const EARTH_RADIUS_M = 6_371_000;
const MIN_SUSTAINED_GRADE_DISTANCE_M = 40;
const MAX_SUSTAINED_GRADE_PCT = 25;
const MAX_ROUTE_SPEED_KMH = 110;
const ROUTE_POWER_GRADE_WINDOW_M = 90;
const ROUTE_POWER_GRADE_MIN_DISTANCE_M = 30;
const ROUTE_POWER_ALTITUDE_SMOOTHING_WINDOW = 11;
const TERRAIN_RECONCILIATION_RELATIVE_DRIFT = 0.15;
const MIN_RECONSTRUCTED_MOVING_TIME_SEC = 15;

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return (
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
  );
}

function normalizeLocationPoint(
  value: unknown,
  fallbackTimestamp: number,
): LocationPoint | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Partial<LocationPoint>;
  const latitude = finiteNumber(point.latitude, Number.NaN);
  const longitude = finiteNumber(point.longitude, Number.NaN);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !validCoordinate(latitude, longitude)
  )
    return null;

  const altitude = finiteNumber(point.altitude, Number.NaN);
  const speed = finiteNumber(point.speed, Number.NaN);
  const timestamp = finiteNumber(point.timestamp, fallbackTimestamp);
  return {
    latitude,
    longitude,
    altitude: Number.isFinite(altitude) ? altitude : null,
    speed: Number.isFinite(speed) && speed >= 0 ? speed : null,
    timestamp: timestamp > 0 ? timestamp : fallbackTimestamp,
    power: Number.isFinite(finiteNumber(point.power, Number.NaN))
      ? Math.max(0, finiteNumber(point.power))
      : undefined,
    heartRate: Number.isFinite(finiteNumber(point.heartRate, Number.NaN))
      ? Math.max(0, finiteNumber(point.heartRate))
      : undefined,
    cadence: Number.isFinite(finiteNumber(point.cadence, Number.NaN))
      ? Math.max(0, finiteNumber(point.cadence))
      : undefined,
    slope: Number.isFinite(finiteNumber(point.slope, Number.NaN))
      ? finiteNumber(point.slope)
      : undefined,
    segmentStart: point.segmentStart === true || undefined,
  };
}

function distanceBetween(a: LocationPoint, b: LocationPoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(deltaLongitude / 2) ** 2;
  return (
    2 *
    EARTH_RADIUS_M *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export interface TerrainMetrics {
  totalAscent: number;
  totalDescent: number;
  maxElevation?: number;
  minElevation?: number;
  averageGrade?: number;
  maxGrade?: number;
}

/** 從已保存軌跡重建距離；跳過明確資料段斷點及短時間不合理跳點。 */
export function calculateRouteDistance(route: LocationPoint[]): number {
  let distanceM = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    if (current.segmentStart) continue;
    const segmentDistance = distanceBetween(previous, current);
    const elapsedMs = current.timestamp - previous.timestamp;
    if (!Number.isFinite(segmentDistance) || segmentDistance < 0.5) continue;
    if (
      !Number.isFinite(elapsedMs) ||
      elapsedMs <= 0 ||
      elapsedMs > MAX_CONTIGUOUS_GPS_STATISTICS_INTERVAL_SEC * 1_000
    )
      continue;
    const impliedSpeedKmh = (segmentDistance / (elapsedMs / 1_000)) * 3.6;
    const reportedSpeedKmh =
      current.speed !== null && Number.isFinite(current.speed)
        ? current.speed * 3.6
        : 0;
    if (
      impliedSpeedKmh > MAX_ROUTE_SPEED_KMH &&
      reportedSpeedKmh > MAX_ROUTE_SPEED_KMH
    )
      continue;
    distanceM += segmentDistance;
  }
  return distanceM;
}

/**
 * 依連續 GPS 點重建騎乘移動時間。資料點間斷、靜止漂移與短距離低速樣本不列入；
 * 呼叫端只會在軌跡時間具有足夠覆蓋時採用，避免稀疏舊路線覆寫原始時間。
 */
export function calculateRouteMovingTime(route: LocationPoint[]): number {
  let movingSeconds = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    if (current.segmentStart) continue;
    const elapsedSec = (current.timestamp - previous.timestamp) / 1000;
    const distanceM = distanceBetween(previous, current);
    if (
      !Number.isFinite(elapsedSec) ||
      elapsedSec <= 0 ||
      elapsedSec > MAX_CONTIGUOUS_GPS_STATISTICS_INTERVAL_SEC ||
      !Number.isFinite(distanceM)
    )
      continue;
    const derivedSpeedKmh = (distanceM / elapsedSec) * 3.6;
    const speedKmh =
      current.speed !== null && Number.isFinite(current.speed)
        ? Math.max(0, current.speed * 3.6)
        : derivedSpeedKmh;
    if (derivedSpeedKmh > MAX_ROUTE_SPEED_KMH && speedKmh > MAX_ROUTE_SPEED_KMH)
      continue;
    if (hasReliableRideMovement({ speedKmh, distanceM, accuracyM: 0 })) {
      movingSeconds += elapsedSec;
    }
  }
  return Math.round(movingSeconds);
}

/** 原始 GPS 時間戳覆蓋活動的程度；用來避免稀疏片段覆寫完整裝置紀錄。 */
function calculateRouteTimestampSpanSec(route: LocationPoint[]): number {
  if (route.length < 2) return 0;
  const firstTimestamp = route[0]?.timestamp;
  const lastTimestamp = route.at(-1)?.timestamp;
  if (!Number.isFinite(firstTimestamp) || !Number.isFinite(lastTimestamp))
    return 0;
  return Math.max(0, (Number(lastTimestamp) - Number(firstTimestamp)) / 1_000);
}

/** 依已保存的速度或相鄰 GPS 位移重建最高可靠速度，跳過漂移與不合理尖峰。 */
export function calculateRouteMaxSpeed(
  route: LocationPoint[],
): number | undefined {
  let maxSpeedKmh = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    if (current.segmentStart) continue;
    const elapsedSec = (current.timestamp - previous.timestamp) / 1_000;
    const distanceM = distanceBetween(previous, current);
    if (
      !Number.isFinite(elapsedSec) ||
      elapsedSec <= 0 ||
      elapsedSec > MAX_CONTIGUOUS_GPS_STATISTICS_INTERVAL_SEC ||
      !Number.isFinite(distanceM)
    )
      continue;
    const derivedSpeedKmh = (distanceM / elapsedSec) * 3.6;
    const speedKmh =
      current.speed !== null &&
      Number.isFinite(current.speed) &&
      current.speed > 0
        ? current.speed * 3.6
        : derivedSpeedKmh;
    if (derivedSpeedKmh > MAX_ROUTE_SPEED_KMH && speedKmh > MAX_ROUTE_SPEED_KMH)
      continue;
    if (
      speedKmh > 0 &&
      speedKmh <= 120 &&
      hasReliableRideMovement({ speedKmh, distanceM, accuracyM: 0 })
    ) {
      maxSpeedKmh = Math.max(maxSpeedKmh, speedKmh);
    }
  }
  return maxSpeedKmh > 0 ? maxSpeedKmh : undefined;
}

/** 從已儲存的軌跡安全重建地形資料；沒有可靠高度樣本時不偽造數值。 */
export function calculateTerrainMetrics(
  route: LocationPoint[],
): TerrainMetrics {
  const elevations = route.flatMap((point) =>
    typeof point.altitude === "number" && Number.isFinite(point.altitude)
      ? [point.altitude]
      : [],
  );
  if (elevations.length === 0) return { totalAscent: 0, totalDescent: 0 };

  let totalAscent = 0;
  let totalDescent = 0;
  let horizontalDistance = 0;
  let maxGrade = 0;
  let gradeWindowDistanceM = 0;
  let gradeWindowNetElevationM = 0;
  let elevationState = createLiveElevationFilterState();

  for (let index = 0; index < route.length; index += 1) {
    const current = route[index];
    const previous = index > 0 ? route[index - 1] : undefined;
    if (current.altitude === null) continue;
    if (current.segmentStart) {
      elevationState = createLiveElevationFilterState();
      gradeWindowDistanceM = 0;
      gradeWindowNetElevationM = 0;
    }
    const segmentDistance =
      previous && !current.segmentStart
        ? distanceBetween(previous, current)
        : 0;
    const elapsedMs = previous ? current.timestamp - previous.timestamp : 0;
    const isPlausibleSegment =
      !previous ||
      current.segmentStart ||
      segmentDistance <= 200 ||
      elapsedMs >= 75_000;
    const acceptedDistance =
      previous && !current.segmentStart && isPlausibleSegment
        ? segmentDistance
        : 0;
    const elevation = acceptLiveElevationDelta(
      elevationState,
      current.altitude,
      acceptedDistance,
    );
    if (acceptedDistance > 0) horizontalDistance += acceptedDistance;
    totalAscent += elevation.ascentM;
    totalDescent += elevation.descentM;
    if (acceptedDistance > 0) {
      gradeWindowDistanceM += acceptedDistance;
      gradeWindowNetElevationM += elevation.ascentM - elevation.descentM;
    }
    if (gradeWindowDistanceM >= MIN_SUSTAINED_GRADE_DISTANCE_M) {
      const sustainedGrade =
        (gradeWindowNetElevationM / gradeWindowDistanceM) * 100;
      if (sustainedGrade > 0) {
        maxGrade = Math.max(
          maxGrade,
          Math.min(MAX_SUSTAINED_GRADE_PCT, sustainedGrade),
        );
      }
      gradeWindowDistanceM = 0;
      gradeWindowNetElevationM = 0;
    }
  }

  return {
    totalAscent,
    totalDescent,
    maxElevation: Math.max(...elevations),
    minElevation: Math.min(...elevations),
    averageGrade:
      horizontalDistance > 0
        ? (totalAscent / horizontalDistance) * 100
        : undefined,
    maxGrade: horizontalDistance > 0 && maxGrade > 0 ? maxGrade : undefined,
  };
}

/**
 * 只在具有完整個人設定與連續 GPS 資料時，為舊活動補建本機虛擬功率。
 * 平均值包含滑行的 0 W；資料不足時回傳空陣列，交由畫面顯示「資料不足」。
 */
function deriveEstimatedPowerHistory(
  route: LocationPoint[],
  profile: RideCalculationProfile | undefined,
): number[] {
  if (!profile || route.length < 2) return [];
  const samples: number[] = [];
  let previousSpeedMs: number | undefined;
  let cumulativeDistanceM = 0;
  const recentAltitudesM: number[] = [];
  const gradeSamples: Array<{ distanceM: number; altitudeM: number }> = [];
  const headwindMs = profile.environment?.averageHeadwindMs ?? 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    if (current.segmentStart) {
      previousSpeedMs = undefined;
      continue;
    }
    const elapsedSec = (current.timestamp - previous.timestamp) / 1000;
    const distanceM = distanceBetween(previous, current);
    if (
      !Number.isFinite(elapsedSec) ||
      elapsedSec <= 0 ||
      elapsedSec > MAX_CONTIGUOUS_GPS_STATISTICS_INTERVAL_SEC ||
      !Number.isFinite(distanceM)
    )
      continue;
    const derivedSpeedKmh = (distanceM / elapsedSec) * 3.6;
    const reportedSpeedMs =
      current.speed !== null && Number.isFinite(current.speed)
        ? Math.max(0, current.speed)
        : 0;
    if (
      derivedSpeedKmh > MAX_ROUTE_SPEED_KMH &&
      reportedSpeedMs * 3.6 > MAX_ROUTE_SPEED_KMH
    )
      continue;
    const speedMs =
      reportedSpeedMs > 0 && derivedSpeedKmh > MAX_ROUTE_SPEED_KMH
        ? reportedSpeedMs
        : Math.max(0, distanceM / elapsedSec);
    cumulativeDistanceM += distanceM;

    let gradePct = 0;
    if (current.altitude !== null && Number.isFinite(current.altitude)) {
      recentAltitudesM.push(current.altitude);
      if (recentAltitudesM.length > ROUTE_POWER_ALTITUDE_SMOOTHING_WINDOW)
        recentAltitudesM.shift();
      const smoothedAltitudeM =
        recentAltitudesM.reduce((total, value) => total + value, 0) /
        recentAltitudesM.length;
      gradeSamples.push({
        distanceM: cumulativeDistanceM,
        altitudeM: smoothedAltitudeM,
      });
      while (
        gradeSamples.length > 1 &&
        cumulativeDistanceM - gradeSamples[0].distanceM >
          ROUTE_POWER_GRADE_WINDOW_M
      )
        gradeSamples.shift();
      const gradeAnchor = gradeSamples[0];
      const gradeDistanceM = cumulativeDistanceM - gradeAnchor.distanceM;
      if (gradeDistanceM >= ROUTE_POWER_GRADE_MIN_DISTANCE_M) {
        gradePct = Math.max(
          -MAX_SUSTAINED_GRADE_PCT,
          Math.min(
            MAX_SUSTAINED_GRADE_PCT,
            ((smoothedAltitudeM - gradeAnchor.altitudeM) / gradeDistanceM) *
              100,
          ),
        );
      }
    }
    const power = clampVirtualPowerForRider(
      calculatePower({
        speedMs,
        prevSpeedMs: previousSpeedMs,
        intervalSec: elapsedSec,
        gradePct,
        windSpeedMs: headwindMs,
        riderMassKg: profile.riderWeightKg,
        bikeMassKg: profile.bikeWeightKg,
      }),
      profile.ftpW,
    );
    samples.push(power);
    previousSpeedMs = speedMs;
  }
  return samples;
}

function normalizePowerZones(value: unknown): number[] {
  if (!Array.isArray(value)) return [0, 0, 0, 0, 0];
  return Array.from({ length: 5 }, (_, index) =>
    Math.round(nonNegative(value[index])),
  );
}

function normalizedOptional(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeCalculationProfile(
  value: unknown,
): RideCalculationProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const profile = value as Partial<RideCalculationProfile>;
  const riderWeightKg = normalizedOptional(profile.riderWeightKg);
  const bikeWeightKg =
    normalizedOptional(profile.bikeWeightKg) ?? DEFAULT_ROAD_BIKE_MASS_KG;
  const ftpW = normalizedOptional(profile.ftpW);
  if (
    !riderWeightKg ||
    !bikeWeightKg ||
    !ftpW ||
    riderWeightKg <= 0 ||
    bikeWeightKg <= 0 ||
    ftpW <= 0
  )
    return undefined;

  const environmentValue = profile.environment;
  const environment =
    environmentValue && typeof environmentValue === "object"
      ? (() => {
          const source =
            environmentValue.source === "live-weather"
              ? "live-weather"
              : "offline-fallback";
          return {
            sampleCount: Math.round(nonNegative(environmentValue.sampleCount)),
            averageTemperatureC: normalizedOptional(
              environmentValue.averageTemperatureC,
            ),
            averageHumidityPct: normalizedOptional(
              environmentValue.averageHumidityPct,
            ),
            averageWindSpeedKmh: normalizedOptional(
              environmentValue.averageWindSpeedKmh,
            ),
            averageHeadwindMs: normalizedOptional(
              environmentValue.averageHeadwindMs,
            ),
            averagePrecipitationProb: normalizedOptional(
              environmentValue.averagePrecipitationProb,
            ),
            weatherCode: normalizedOptional(environmentValue.weatherCode),
            source,
          } as RideCalculationProfile["environment"];
        })()
      : undefined;

  return { riderWeightKg, bikeWeightKg, ftpW, environment };
}

function normalizeSupplyConfirmations(
  value: unknown,
): SupplyConfirmation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const confirmations = value.flatMap((candidate): SupplyConfirmation[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<SupplyConfirmation>;
    if (item.type !== "energy" && item.type !== "water") return [];
    const timestamp = normalizedOptional(item.timestamp);
    const elapsedSec = normalizedOptional(item.elapsedSec);
    if (
      timestamp === undefined ||
      timestamp <= 0 ||
      elapsedSec === undefined ||
      elapsedSec < 0
    )
      return [];
    const source =
      item.source === "smart" ||
      item.source === "smart-offline-fallback" ||
      item.source === "custom"
        ? item.source
        : undefined;
    return [
      {
        type: item.type,
        timestamp,
        elapsedSec,
        recommendedEnergyKcal: normalizedOptional(item.recommendedEnergyKcal),
        recommendedCarbohydrateG: normalizedOptional(
          item.recommendedCarbohydrateG,
        ),
        recommendedWaterMl: normalizedOptional(item.recommendedWaterMl),
        source,
        reason:
          typeof item.reason === "string" && item.reason.trim()
            ? item.reason.trim().slice(0, 160)
            : undefined,
      },
    ];
  });
  return confirmations.sort((a, b) => a.timestamp - b.timestamp).slice(-100);
}

function normalizeActivityType(value: unknown): RideActivityType {
  return value === "road" ||
    value === "gravel" ||
    value === "mountain" ||
    value === "commute" ||
    value === "indoor" ||
    value === "other"
    ? value
    : "road";
}

function normalizeSportType(value: unknown): SportType {
  return value === "running" ||
    value === "hiking" ||
    value === "trail_running" ||
    value === "cycling"
    ? value
    : "cycling";
}

function normalizePowerSource(value: unknown): RideRecord["powerSource"] {
  return value === "measured" || value === "estimated" ? value : "unavailable";
}

function normalizeCaloriesSource(value: unknown): RideRecord["caloriesSource"] {
  return value === "power-estimate" ||
    value === "met-estimate" ||
    value === "mixed-estimate"
    ? value
    : "unavailable";
}

/** 虛擬功率保留依 FTP 的上限；量測功率則僅拒絕不可能的資料損壞尖峰。 */
function normalizePowerValue(
  value: number,
  source: RideRecord["powerSource"],
  ftpW: number,
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (source === "estimated") return clampVirtualPowerForRider(value, ftpW);
  if (source === "measured") return Math.min(2_500, Math.round(value));
  // 舊版沒有來源欄位但保留了正值功率時，保留其作為未驗證歷史資料，並使用虛擬功率的保守上限。
  return Math.min(650, Math.round(value));
}

function normalizeRpe(value: unknown): number | undefined {
  const rpe = normalizedOptional(value);
  return rpe !== undefined && rpe >= 1 && rpe <= 10
    ? Math.round(rpe)
    : undefined;
}

function normalizeLaps(value: unknown): RideLap[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .flatMap((candidate, index): RideLap[] => {
      if (!candidate || typeof candidate !== "object") return [];
      const lap = candidate as Partial<RideLap>;
      const movingTimeSec = nonNegative(lap.movingTimeSec);
      const distanceM = nonNegative(lap.distanceM);
      if (movingTimeSec < 1 || distanceM < 1) return [];
      const startedAtElapsedSec = nonNegative(lap.startedAtElapsedSec);
      const endedAtElapsedSec = Math.max(
        startedAtElapsedSec + movingTimeSec,
        nonNegative(lap.endedAtElapsedSec),
      );
      return [
        {
          index: Math.max(1, Math.round(nonNegative(lap.index, index + 1))),
          startedAtElapsedSec,
          endedAtElapsedSec,
          movingTimeSec,
          distanceM,
          ascentM: nonNegative(lap.ascentM),
          descentM: nonNegative(lap.descentM),
          averageSpeedKmh: normalizedOptional(lap.averageSpeedKmh),
          maxSpeedKmh: normalizedOptional(lap.maxSpeedKmh),
          averagePowerW: normalizedOptional(lap.averagePowerW),
        },
      ];
    })
    .sort((a, b) => a.index - b.index)
    .slice(0, 100);
}

/**
 * 將歷史、匯入與新建騎乘資料轉為同一個安全模型。
 * 僅接受具有數值距離與軌跡陣列的記錄；缺失的衍生數據會由本機軌跡補齊。
 */
export function normalizeRideRecord(
  value: unknown,
  fallbackId?: string,
): RideRecord | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<RideRecord>;
  if (
    !Array.isArray(source.route) ||
    typeof source.distance !== "number" ||
    !Number.isFinite(source.distance) ||
    source.distance < 0
  )
    return null;

  const date = finiteNumber(source.date, Date.now());
  const route = source.route.flatMap((point, index) => {
    const normalized = normalizeLocationPoint(point, date + index * 1000);
    return normalized ? [normalized] : [];
  });
  const duration = nonNegative(source.duration);
  const declaredPausedSec = Math.min(
    duration,
    nonNegative(source.totalPausedSec),
  );
  const declaredMovingTime = Math.max(0, duration - declaredPausedSec);
  const terrain = calculateTerrainMetrics(route);
  const reconstructedDistanceM = calculateRouteDistance(route);
  const routeMovingTime = calculateRouteMovingTime(route);
  const routeTimestampSpanSec = calculateRouteTimestampSpanSec(route);
  const routeMaxSpeedKmh = calculateRouteMaxSpeed(route);
  // Raw Data First：若原始軌跡的時間戳已覆蓋活動大半，逐段可信 GPS 位移比受
  // 前景 timer／自動暫停影響的 declared moving time 更可靠；稀疏片段仍保留裝置值。
  const routeTimingIsComparable =
    routeMovingTime >= MIN_RECONSTRUCTED_MOVING_TIME_SEC &&
    duration > 0 &&
    routeTimestampSpanSec >= duration * 0.5 &&
    routeTimestampSpanSec <= duration * 1.2;
  const movingTime = routeTimingIsComparable
    ? routeMovingTime
    : declaredMovingTime;
  const totalPausedSec = routeTimingIsComparable
    ? Math.max(0, duration - movingTime)
    : Math.max(declaredPausedSec, Math.max(0, duration - movingTime));
  const autoPausedSec = Math.min(
    totalPausedSec,
    nonNegative(source.autoPausedSec),
  );
  const storedDistanceM = nonNegative(source.distance);
  const routeDistanceIsComparable =
    reconstructedDistanceM >= 50 &&
    (storedDistanceM < 1 ||
      (reconstructedDistanceM >= storedDistanceM * 0.7 &&
        reconstructedDistanceM <= storedDistanceM * 1.35));
  // 僅以完整連續 GPS 路線補回明顯被過濾掉的距離，不以稀疏路線縮短既有活動。
  // 20 m 或 0.5% 以上的可信差異會影響均速、功率與熱量，應由同一資料流重建。
  const distanceWasCorrupted =
    routeDistanceIsComparable &&
    (storedDistanceM <= 0 ||
      reconstructedDistanceM - storedDistanceM >
        Math.max(20, storedDistanceM * 0.005));
  const distanceM = distanceWasCorrupted
    ? reconstructedDistanceM
    : storedDistanceM;
  const storedAscent = nonNegative(source.totalAscent);
  const storedDescent = nonNegative(source.totalDescent);
  const hasTerrainAltitude = terrain.maxElevation !== undefined;
  const storedMaxElevation = normalizedOptional(source.maxElevation);
  const storedMinElevation = normalizedOptional(source.minElevation);
  const storedAverageGrade = normalizedOptional(source.averageGrade);
  const storedMaxGrade = normalizedOptional(source.maxGrade);
  const calculationProfile = normalizeCalculationProfile(
    source.calculationProfile,
  );
  const declaredPowerSource = normalizePowerSource(source.powerSource);
  const virtualFtpW = calculationProfile?.ftpW ?? 250;
  const powerHistory = Array.isArray(source.powerHistory)
    ? source.powerHistory.filter(
        (power): power is number =>
          typeof power === "number" && Number.isFinite(power) && power >= 0,
      )
    : [];
  const directPowerHistory = powerHistory.map((power) =>
    normalizePowerValue(power, declaredPowerSource, virtualFtpW),
  );
  const hasDirectPowerSamples = directPowerHistory.some((power) => power > 0);
  const hasDeclaredPowerValues =
    nonNegative(source.avgPower) > 0 || nonNegative(source.maxPower) > 0;
  const regeneratedEstimatedPowerHistory =
    declaredPowerSource === "estimated"
      ? deriveEstimatedPowerHistory(route, calculationProfile)
      : [];
  const reconstructedPowerHistory = regeneratedEstimatedPowerHistory.some(
    (power) => power > 0,
  )
    ? regeneratedEstimatedPowerHistory
    : hasDirectPowerSamples
      ? directPowerHistory
      : deriveEstimatedPowerHistory(route, calculationProfile);
  const effectivePowerSource: RideRecord["powerSource"] =
    hasDirectPowerSamples || hasDeclaredPowerValues
      ? declaredPowerSource
      : reconstructedPowerHistory.some((power) => power > 0)
        ? "estimated"
        : "unavailable";
  const normalizedPowerHistory = reconstructedPowerHistory.map((power) =>
    normalizePowerValue(power, effectivePowerSource, virtualFtpW),
  );
  const derivedAveragePower = normalizedPowerHistory.length
    ? normalizedPowerHistory.reduce((sum, power) => sum + power, 0) /
      normalizedPowerHistory.length
    : 0;
  const storedAveragePower = nonNegative(source.avgPower);
  const normalizedAveragePower = normalizePowerValue(
    effectivePowerSource === "estimated" && derivedAveragePower > 0
      ? derivedAveragePower
      : storedAveragePower > 0
        ? storedAveragePower
        : derivedAveragePower,
    effectivePowerSource,
    virtualFtpW,
  );
  const normalizedMaxPower = normalizePowerValue(
    Math.max(nonNegative(source.maxPower), ...normalizedPowerHistory, 0),
    effectivePowerSource,
    virtualFtpW,
  );
  const hasUsablePower = normalizedAveragePower > 0 || normalizedMaxPower > 0;
  const averagePower = hasUsablePower ? normalizedAveragePower : 0;
  const maxPower = hasUsablePower ? normalizedMaxPower : 0;
  const powerSource = hasUsablePower ? effectivePowerSource : "unavailable";
  const hasComparableEstimatedPowerCoverage =
    effectivePowerSource !== "estimated" ||
    (routeMovingTime >= 60 && routeMovingTime >= movingTime * 0.5);
  const declaredCaloriesSource = normalizeCaloriesSource(source.caloriesSource);
  const hasStoredPowerWorkEvidence =
    nonNegative(source.totalWorkKj) > 0 && nonNegative(source.avgPower) > 0;
  const totalWorkKj =
    hasUsablePower && source.totalWorkKj !== undefined
      ? nonNegative(source.totalWorkKj)
      : hasUsablePower &&
          hasComparableEstimatedPowerCoverage &&
          movingTime > 0 &&
          averagePower > 0
        ? (averagePower * movingTime) / 1000
        : undefined;
  const derivedNormalizedPower = hasUsablePower
    ? calculateNormalizedPowerFromHistory(normalizedPowerHistory, movingTime)
    : undefined;
  const derivedTraining =
    hasUsablePower && calculationProfile
      ? analyzeTraining(
          movingTime,
          averagePower,
          maxPower,
          calculationProfile.ftpW,
          normalizedPowerHistory,
        )
      : undefined;
  const recordId =
    typeof source.id === "string" && source.id.trim()
      ? source.id.trim()
      : (fallbackId ?? `legacy-${date}`);
  const name =
    typeof source.name === "string" && source.name.trim()
      ? source.name.trim()
      : "匯入騎乘紀錄";
  const terrainDisagreesWithStoredAscent =
    hasTerrainAltitude &&
    (terrain.totalAscent === 0
      ? storedAscent > 0
      : storedAscent === 0 ||
        storedAscent >
          terrain.totalAscent * (1 + TERRAIN_RECONCILIATION_RELATIVE_DRIFT) ||
        storedAscent <
          terrain.totalAscent * (1 - TERRAIN_RECONCILIATION_RELATIVE_DRIFT));
  const terrainDisagreesWithStoredDescent =
    hasTerrainAltitude &&
    (terrain.totalDescent === 0
      ? storedDescent > 0
      : storedDescent === 0 ||
        storedDescent >
          terrain.totalDescent * (1 + TERRAIN_RECONCILIATION_RELATIVE_DRIFT) ||
        storedDescent <
          terrain.totalDescent * (1 - TERRAIN_RECONCILIATION_RELATIVE_DRIFT));
  const totalAscent = terrainDisagreesWithStoredAscent
    ? terrain.totalAscent
    : storedAscent;
  const totalDescent = terrainDisagreesWithStoredDescent
    ? terrain.totalDescent
    : storedDescent;
  const averageSpeedKmh =
    movingTime > 0
      ? distanceM / 1000 / (movingTime / 3600)
      : nonNegative(source.avgSpeed);
  const storedCalories = nonNegative(source.calories);
  const fallbackCalories = calculateCaloriesMET(
    averageSpeedKmh,
    normalizeCalculationProfile(source.calculationProfile)?.riderWeightKg ?? 70,
    movingTime,
    terrain.averageGrade ?? 0,
  );
  // 僅修復「距離已證實錯誤、沒有功率資料、卻仍保留高熱量」的歷史紀錄；
  // 量測功率與正常新紀錄絕不被此相容性修復覆寫。
  const estimatedPowerCalories =
    hasUsablePower && hasComparableEstimatedPowerCoverage && movingTime > 0
      ? calculateCalories(averagePower, movingTime)
      : 0;
  const caloriesNeedsRepair =
    distanceWasCorrupted ||
    (declaredCaloriesSource === "power-estimate" &&
      (!hasUsablePower ||
        (effectivePowerSource === "estimated" &&
          !hasComparableEstimatedPowerCoverage &&
          !hasStoredPowerWorkEvidence)));
  const calories = caloriesNeedsRepair
    ? Math.round(
        estimatedPowerCalories > 0 ? estimatedPowerCalories : fallbackCalories,
      )
    : storedCalories;
  const caloriesSource = caloriesNeedsRepair
    ? estimatedPowerCalories > 0
      ? "power-estimate"
      : "met-estimate"
    : declaredCaloriesSource;

  const supplyConfirmations = normalizeSupplyConfirmations(
    source.supplyConfirmations,
  );
  const storedMaxSpeed = Math.min(120, nonNegative(source.maxSpeed));
  return {
    id: recordId,
    date,
    name,
    duration,
    distance: distanceM,
    avgSpeed: averageSpeedKmh,
    maxSpeed: storedMaxSpeed > 0 ? storedMaxSpeed : (routeMaxSpeedKmh ?? 0),
    totalAscent,
    totalDescent,
    maxElevation:
      hasTerrainAltitude &&
      (storedMaxElevation === undefined ||
        (storedMaxElevation === 0 && terrain.maxElevation !== 0))
        ? terrain.maxElevation
        : storedMaxElevation,
    minElevation:
      hasTerrainAltitude &&
      (storedMinElevation === undefined ||
        (storedMinElevation === 0 && terrain.minElevation !== 0))
        ? terrain.minElevation
        : storedMinElevation,
    averageGrade:
      terrain.averageGrade !== undefined &&
      (!storedAverageGrade || storedAverageGrade < 0)
        ? terrain.averageGrade
        : storedAverageGrade,
    maxGrade:
      terrain.maxGrade !== undefined &&
      (!storedMaxGrade ||
        storedMaxGrade < 0 ||
        storedMaxGrade > MAX_SUSTAINED_GRADE_PCT)
        ? terrain.maxGrade
        : storedMaxGrade,
    movingTime,
    calories,
    avgPower: Math.round(averagePower),
    maxPower: Math.round(maxPower),
    totalWorkKj,
    powerSource,
    caloriesSource,
    normalizedPower:
      derivedNormalizedPower ?? normalizedOptional(source.normalizedPower),
    intensityFactor:
      normalizedOptional(source.intensityFactor) ??
      derivedTraining?.intensityFactor,
    tss: normalizedOptional(source.tss) ?? derivedTraining?.tss,
    powerZones: normalizePowerZones(source.powerZones),
    powerHistory: normalizedPowerHistory,
    route,
    totalSweatMl: nonNegative(source.totalSweatMl),
    refillCount: Math.max(
      Math.round(nonNegative(source.refillCount)),
      supplyConfirmations?.filter(
        (confirmation) => confirmation.type === "water",
      ).length ?? 0,
    ),
    totalPausedSec,
    autoPausedSec,
    avgHeartRate: normalizedOptional(source.avgHeartRate),
    maxHeartRate: normalizedOptional(source.maxHeartRate),
    avgCadence: normalizedOptional(source.avgCadence),
    maxCadence: normalizedOptional(source.maxCadence),
    gradeDistribution: Array.isArray(source.gradeDistribution)
      ? source.gradeDistribution.map((v) => nonNegative(v))
      : [0, 0, 0, 0, 0, 0],
    gradeAscentDistribution: Array.isArray(source.gradeAscentDistribution)
      ? source.gradeAscentDistribution.map((v) => nonNegative(v))
      : [0, 0, 0, 0, 0, 0],
    personalBests: Array.isArray(source.personalBests)
      ? source.personalBests
      : undefined,
    calculationProfile,
    supplyConfirmations,
    description:
      typeof source.description === "string" ? source.description : undefined,
    activityType: normalizeActivityType(source.activityType),
    sportType: normalizeSportType(source.sportType),
    equipment:
      typeof source.equipment === "string" && source.equipment.trim()
        ? source.equipment.trim().slice(0, 80)
        : undefined,
    perceivedExertion: normalizeRpe(source.perceivedExertion),
    perceivedExertionSource:
      source.perceivedExertionSource === "manual" ||
      source.perceivedExertionSource === "app-estimate"
        ? source.perceivedExertionSource
        : undefined,
    mediaItems: Array.isArray(source.mediaItems)
      ? source.mediaItems.filter(
          (uri): uri is string => typeof uri === "string",
        )
      : undefined,
    coverPhotoUri:
      typeof source.coverPhotoUri === "string" && source.coverPhotoUri.trim()
        ? source.coverPhotoUri.trim()
        : undefined,
    segmentAchievements: Array.isArray(source.segmentAchievements)
      ? source.segmentAchievements
      : undefined,
    laps: normalizeLaps(source.laps),
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
