import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

export interface RideStats {
  totalDistance: number;
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
        return session;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to initialize ride session:', error);
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
    console.error('Failed to save ride session snapshot:', error);
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

  // 計算距離增量
  if (previousPoint) {
    const distance = calculateDistance(
      previousPoint.latitude,
      previousPoint.longitude,
      point.latitude,
      point.longitude
    );
    session.stats.totalDistance += distance;
  }

  // 更新高度數據
  if (point.altitude !== undefined) {
    session.stats.maxAltitude = Math.max(session.stats.maxAltitude, point.altitude);
    session.stats.minAltitude = Math.min(session.stats.minAltitude, point.altitude);

    // 計算爬升/下降
    if (previousPoint && previousPoint.altitude !== undefined) {
      const elevationDiff = point.altitude - previousPoint.altitude;
      if (elevationDiff > 0) {
        session.stats.totalElevationGain += elevationDiff;
      } else {
        session.stats.totalElevationLoss += Math.abs(elevationDiff);
      }
    }
  }

  // 更新速度數據
  if (point.speed !== undefined) {
    session.stats.maxSpeed = Math.max(session.stats.maxSpeed, point.speed);
  }

  // 更新時間
  session.stats.totalTime = point.timestamp - session.startTime;

  // 計算平均速度
  if (session.stats.totalTime > 0) {
    session.stats.averageSpeed = session.stats.totalDistance / (session.stats.totalTime / 3600000);
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
    console.error('Failed to complete ride session:', error);
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
    console.error('Failed to recover ride session from backup:', error);
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
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 地球半徑（公里）
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
 * 獲取騎乘歷史記錄
 */
export async function getRideHistory(): Promise<RideSession[]> {
  try {
    const historyJson = await AsyncStorage.getItem(RIDE_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error('Failed to get ride history:', error);
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
    console.error('Failed to clear ride data:', error);
  }
}
