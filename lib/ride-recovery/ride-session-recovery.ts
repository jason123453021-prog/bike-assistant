import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportRecoverableIssue } from '../release-safe-log';
import { acceptLiveElevationDelta, createLiveElevationFilterState } from '../live-elevation-filter';
import { hasReliableRideMovement } from '../live-ride-readings';

/**
 * 騎乘會話恢復系統
 * 實時保存騎乘數據，確保崩潰時無縫恢復
 */

export interface RideTrackPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  accuracy?: number;
  heading?: number;
  /** 背景定位長時間中斷後的下一段安全軌跡起點。 */
  segmentStart?: boolean;
  /** 暫停中仍接受的原始 GPS 點，只供匯出與恢復，不能累加騎乘統計。 */
  recordedDuringPause?: boolean;
}

export interface RideStats {
  /** 全程距離，單位固定為公尺；與 RideState／RideRecord 一致。 */
  totalDistance: number;
  /** 統計已依公尺距離與濾波海拔重建的版本。 */
  trackingStatsVersion?: 2;
  /** 下一筆高度樣本的濾波參考高度。 */
  elevationAnchorM?: number | null;
  totalTime: number;
  totalElevationGain: number;
  totalElevationLoss: number;
  maxAltitude: number;
  minAltitude: number;
  caloriesBurned: number;
  waterLoss: number;
  averageSpeed: number;
  maxSpeed: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
}

export interface RideSession {
  id: string;
  startTime: number;
  lastUpdateTime: number;
  isActive: boolean;
  trackPoints: RideTrackPoint[];
  stats: RideStats;
  gpxRouteId?: string;
  navigationTarget?: {
    latitude: number;
    longitude: number;
    name: string;
  };
}

const RIDE_SESSION_KEY = 'RIDE_SESSION_CURRENT';
const RIDE_HISTORY_KEY = 'RIDE_SESSION_HISTORY';
const RIDE_BACKUP_KEY = 'RIDE_SESSION_BACKUP';

/**
 * 初始化或恢復騎乘會話
 */
export async function initializeRideSession(): Promise<RideSession | null> {
  try {
    const sessionJson = await AsyncStorage.getItem(RIDE_SESSION_KEY);
    if (sessionJson) {
      const session = JSON.parse(sessionJson);
      // 驗證會話數據完整性
      if (validateRideSession(session)) {
        // 舊版會把 Haversine 的公里結果直接恢復為公尺，並逐點加總 GPS 高度雜訊。
        // 每次讀取時依原始軌跡重建可導出的統計，讓既有未完成活動安全遷移到 SI 單位。
        if (session.stats.trackingStatsVersion !== 2) rebuildTrackDerivedStats(session);
        return session;
      }
    }
    return null;
  } catch (error) {
    reportRecoverableIssue('Failed to initialize ride session', error);
    return null;
  }
}

/**
 * 創建新的騎乘會話
 */
export function createNewRideSession(gpxRouteId?: string, navigationTarget?: any): RideSession {
  return {
    id: `ride_${Date.now()}`,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
    isActive: true,
    trackPoints: [],
    stats: {
      totalDistance: 0,
      trackingStatsVersion: 2,
      elevationAnchorM: null,
      totalTime: 0,
      totalElevationGain: 0,
      totalElevationLoss: 0,
      maxAltitude: -Infinity,
      minAltitude: Infinity,
      caloriesBurned: 0,
      waterLoss: 0,
      averageSpeed: 0,
      maxSpeed: 0,
    },
    gpxRouteId,
    navigationTarget,
  };
}

/**
 * 實時保存騎乘數據（每次 GPS 更新時調用）
 */
export async function saveRideSessionSnapshot(session: RideSession): Promise<void> {
  try {
    // 主存儲
    await AsyncStorage.setItem(RIDE_SESSION_KEY, JSON.stringify(session));
    
    // 備份存儲（防止數據丟失）
    await AsyncStorage.setItem(RIDE_BACKUP_KEY, JSON.stringify({
      timestamp: Date.now(),
      session,
    }));
  } catch (error) {
    reportRecoverableIssue('Failed to save ride session snapshot', error);
  }
}

/**
 * 添加 GPS 軌跡點並更新統計
 */
export function addTrackPoint(
  session: RideSession,
  point: RideTrackPoint,
  previousPoint?: RideTrackPoint
): RideSession {
  // 添加軌跡點
  session.trackPoints.push(point);
  session.lastUpdateTime = point.timestamp;

  // 計算距離增量（固定使用公尺，與 RideState／RideRecord 相同）。
  let distanceM = 0;
  if (previousPoint && !point.segmentStart) {
    distanceM = calculateDistanceMeters(
      previousPoint.latitude,
      previousPoint.longitude,
      point.latitude,
      point.longitude
    );
    const canAccumulateStatistics = !point.recordedDuringPause && !previousPoint.recordedDuringPause;
    if (canAccumulateStatistics) session.stats.totalDistance += distanceM;
    const intervalMs = point.timestamp - previousPoint.timestamp;
    if (canAccumulateStatistics && intervalMs > 0 && intervalMs <= 30_000) {
      const intervalSec = intervalMs / 1_000;
      const derivedSpeedKmh = intervalSec > 0 ? (distanceM / intervalSec) * 3.6 : 0;
      const speedKmh = Number.isFinite(point.speed) ? Math.max(0, Number(point.speed) * 3.6) : derivedSpeedKmh;
      // 原始點永遠保留；session 統計只以與前景／背景共用的可信移動區間累積。
      if (hasReliableRideMovement({ speedKmh, distanceM, accuracyM: point.accuracy })) {
        session.stats.totalTime += intervalMs;
      }
    }
  }

  // 更新高度數據
  if (point.altitude !== undefined && !point.recordedDuringPause) {
    session.stats.maxAltitude = Math.max(session.stats.maxAltitude, point.altitude);
    session.stats.minAltitude = Math.min(session.stats.minAltitude, point.altitude);

    // 復原資料與即時活動共用 10 m 死區／12 m 最小位移，避免手機 GPS 高度抖動被反覆加成爬升。
    const elevationState = { anchorAltitudeM: session.stats.elevationAnchorM ?? null };
    if (point.segmentStart) elevationState.anchorAltitudeM = null;
    const elevation = acceptLiveElevationDelta(elevationState, point.altitude, point.segmentStart ? 0 : distanceM);
    session.stats.elevationAnchorM = elevationState.anchorAltitudeM;
    session.stats.totalElevationGain += elevation.ascentM;
    session.stats.totalElevationLoss += elevation.descentM;
  }

  // 更新速度數據
  if (point.speed !== undefined && !point.recordedDuringPause) {
    session.stats.maxSpeed = Math.max(session.stats.maxSpeed, point.speed);
  }

  // 計算平均速度
  if (session.stats.totalTime > 0) {
    session.stats.averageSpeed = (session.stats.totalDistance / 1000) / (session.stats.totalTime / 3600000);
  }

  return session;
}

/**
 * 完成騎乘會話並保存到歷史
 */
export async function completeRideSession(session: RideSession): Promise<void> {
  try {
    session.isActive = false;

    // 保存到歷史記錄
    const historyJson = await AsyncStorage.getItem(RIDE_HISTORY_KEY);
    const history = historyJson ? JSON.parse(historyJson) : [];
    history.push(session);
    await AsyncStorage.setItem(RIDE_HISTORY_KEY, JSON.stringify(history));

    // 清除當前會話
    await AsyncStorage.removeItem(RIDE_SESSION_KEY);
    await AsyncStorage.removeItem(RIDE_BACKUP_KEY);
  } catch (error) {
    reportRecoverableIssue('Failed to complete ride session', error);
  }
}

/**
 * 從備份恢復騎乘會話
 */
export async function recoverRideSessionFromBackup(): Promise<RideSession | null> {
  try {
    const backupJson = await AsyncStorage.getItem(RIDE_BACKUP_KEY);
    if (backupJson) {
      const backup = JSON.parse(backupJson);
      return backup.session;
    }
    return null;
  } catch (error) {
    reportRecoverableIssue('Failed to recover ride session from backup', error);
    return null;
  }
}

/**
 * 驗證騎乘會話數據完整性
 */
function validateRideSession(session: any): boolean {
  return (
    session &&
    typeof session.id === 'string' &&
    typeof session.startTime === 'number' &&
    Array.isArray(session.trackPoints) &&
    session.stats &&
    typeof session.stats.totalDistance === 'number'
  );
}

/**
 * 計算兩點之間的距離（Haversine 公式）
 */
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000; // 地球半徑（公尺）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 重新建立僅由原始軌跡決定的統計，修復舊版公里／公尺混用與逐點高度雜訊累計。
 * 卡路里與汗液來自活動期間的模型積分，並不由軌跡推回，因此保持原值。
 */
function rebuildTrackDerivedStats(session: RideSession): void {
  if (!session.trackPoints.length) return;
  let distanceM = 0;
  let ascentM = 0;
  let descentM = 0;
  let maxAltitude = -Infinity;
  let minAltitude = Infinity;
  let maxSpeed = 0;
  let movingTimeMs = 0;
  let previous: RideTrackPoint | undefined;
  let elevationState = createLiveElevationFilterState();

  for (const point of session.trackPoints) {
    if (point.segmentStart) elevationState = createLiveElevationFilterState();
    const segmentDistanceM = previous && !point.segmentStart
      ? calculateDistanceMeters(previous.latitude, previous.longitude, point.latitude, point.longitude)
      : 0;
    const elapsedMs = previous ? point.timestamp - previous.timestamp : 0;
    const isPlausibleSegment = !previous
      || point.segmentStart
      || (segmentDistanceM <= 200 || elapsedMs >= 75_000);
    if (previous && !point.segmentStart && isPlausibleSegment) {
      distanceM += segmentDistanceM;
      if (elapsedMs > 0 && elapsedMs <= 30_000) movingTimeMs += elapsedMs;
    }

    if (typeof point.altitude === "number" && Number.isFinite(point.altitude)) {
      maxAltitude = Math.max(maxAltitude, point.altitude);
      minAltitude = Math.min(minAltitude, point.altitude);
      const elevation = acceptLiveElevationDelta(
        elevationState,
        point.altitude,
        previous && !point.segmentStart && isPlausibleSegment ? segmentDistanceM : 0,
      );
      ascentM += elevation.ascentM;
      descentM += elevation.descentM;
    }
    if (typeof point.speed === "number" && Number.isFinite(point.speed)) maxSpeed = Math.max(maxSpeed, point.speed);
    previous = point;
  }

  session.stats.totalDistance = distanceM;
  session.stats.trackingStatsVersion = 2;
  session.stats.elevationAnchorM = elevationState.anchorAltitudeM;
  session.stats.totalElevationGain = ascentM;
  session.stats.totalElevationLoss = descentM;
  session.stats.maxAltitude = maxAltitude;
  session.stats.minAltitude = minAltitude;
  session.stats.maxSpeed = maxSpeed;
  session.stats.totalTime = movingTimeMs;
  session.stats.averageSpeed = session.stats.totalTime > 0
    ? (distanceM / 1000) / (session.stats.totalTime / 3_600_000)
    : 0;
}

/**
 * 獲取騎乘歷史記錄
 */
export async function getRideHistory(): Promise<RideSession[]> {
  try {
    const historyJson = await AsyncStorage.getItem(RIDE_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    reportRecoverableIssue('Failed to get ride history', error);
    return [];
  }
}

/**
 * 清除所有騎乘數據
 */
export async function clearAllRideData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      RIDE_SESSION_KEY,
      RIDE_HISTORY_KEY,
      RIDE_BACKUP_KEY,
    ]);
  } catch (error) {
    reportRecoverableIssue('Failed to clear ride data', error);
  }
}
