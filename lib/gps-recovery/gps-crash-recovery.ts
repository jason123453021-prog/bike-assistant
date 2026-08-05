/**
 * GPS 崩潰恢復機制
 * 
 * 功能：
 * 1. 實時保存 GPS 軌跡點、統計數據到 AsyncStorage
 * 2. App 啟動時自動檢測並恢復未完成的騎乘會話
 * 3. 無縫恢復所有數據與地圖軌跡
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GPSTrackPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp: number;
  speed?: number;
}

export interface RideSessionData {
  sessionId: string;
  startTime: number;
  lastUpdateTime: number;
  trackPoints: GPSTrackPoint[];
  stats: {
    totalDistance: number;
    totalTime: number;
    totalAscent: number;
    totalDescent: number;
    totalCalories: number;
    averageSpeed: number;
    maxSpeed: number;
    maxAltitude: number;
    minAltitude: number;
  };
  status: 'active' | 'paused' | 'completed';
}

const STORAGE_KEY = 'RIDE_SESSION_DATA';
const SESSION_ID_KEY = 'CURRENT_SESSION_ID';

/**
 * 初始化新的騎乘會話
 */
export async function initializeRideSession(): Promise<string> {
  const sessionId = `ride_${Date.now()}`;
  
  const sessionData: RideSessionData = {
    sessionId,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
    trackPoints: [],
    stats: {
      totalDistance: 0,
      totalTime: 0,
      totalAscent: 0,
      totalDescent: 0,
      totalCalories: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      maxAltitude: 0,
      minAltitude: 0,
    },
    status: 'active',
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    await AsyncStorage.setItem(SESSION_ID_KEY, sessionId);
    return sessionId;
  } catch (error) {
    console.error('[GPS Recovery] Failed to initialize session:', error);
    throw error;
  }
}

/**
 * 添加 GPS 軌跡點並實時保存
 */
export async function addTrackPoint(point: GPSTrackPoint): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) {
      console.warn('[GPS Recovery] No active session found');
      return;
    }

    const session: RideSessionData = JSON.parse(data);
    session.trackPoints.push(point);
    session.lastUpdateTime = Date.now();

    // 更新統計數據
    updateSessionStats(session, point);

    // 實時保存到 AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('[GPS Recovery] Failed to add track point:', error);
  }
}

/**
 * 更新會話統計數據
 */
function updateSessionStats(session: RideSessionData, newPoint: GPSTrackPoint): void {
  const stats = session.stats;

  // 更新海拔極值
  if (newPoint.altitude !== undefined) {
    if (stats.maxAltitude === 0 || newPoint.altitude > stats.maxAltitude) {
      stats.maxAltitude = newPoint.altitude;
    }
    if (stats.minAltitude === 0 || newPoint.altitude < stats.minAltitude) {
      stats.minAltitude = newPoint.altitude;
    }
  }

  // 更新速度極值
  if (newPoint.speed !== undefined) {
    if (newPoint.speed > stats.maxSpeed) {
      stats.maxSpeed = newPoint.speed;
    }
  }

  // 更新總時間
  stats.totalTime = Date.now() - session.startTime;

  // 計算距離（簡化版，實際應使用 Haversine 公式）
  if (session.trackPoints.length > 0) {
    const lastPoint = session.trackPoints[session.trackPoints.length - 1];
    const distance = calculateDistance(lastPoint, newPoint);
    stats.totalDistance += distance;
  }

  // 計算爬升/下降
  if (session.trackPoints.length > 0 && newPoint.altitude !== undefined) {
    const lastPoint = session.trackPoints[session.trackPoints.length - 1];
    if (lastPoint.altitude !== undefined) {
      const altitudeDiff = newPoint.altitude - lastPoint.altitude;
      if (altitudeDiff > 0) {
        stats.totalAscent += altitudeDiff;
      } else {
        stats.totalDescent += Math.abs(altitudeDiff);
      }
    }
  }

  // 計算平均速度
  if (stats.totalTime > 0) {
    stats.averageSpeed = (stats.totalDistance / stats.totalTime) * 3600; // 轉換為 km/h
  }
}

/**
 * Haversine 公式計算兩點間距離（單位：km）
 */
function calculateDistance(point1: GPSTrackPoint, point2: GPSTrackPoint): number {
  const R = 6371; // 地球半徑（km）
  const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.latitude * Math.PI) / 180) *
      Math.cos((point2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 檢測未完成的騎乘會話
 */
export async function detectUnfinishedSession(): Promise<RideSessionData | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) {
      return null;
    }

    const session: RideSessionData = JSON.parse(data);

    // 檢查會話是否未完成
    if (session.status === 'active' || session.status === 'paused') {
      // 驗證數據完整性
      if (session.trackPoints.length > 0 && session.stats.totalDistance > 0) {
        return session;
      }
    }

    return null;
  } catch (error) {
    console.error('[GPS Recovery] Failed to detect unfinished session:', error);
    return null;
  }
}

/**
 * 恢復未完成的騎乘會話
 */
export async function recoverRideSession(): Promise<RideSessionData | null> {
  const session = await detectUnfinishedSession();
  if (!session) {
    return null;
  }

  // 驗證數據完整性
  if (session.trackPoints.length === 0) {
    console.warn('[GPS Recovery] Session has no track points, clearing...');
    await clearRideSession();
    return null;
  }

  console.log(`[GPS Recovery] Recovered session: ${session.sessionId}, ${session.trackPoints.length} points, ${session.stats.totalDistance.toFixed(2)} km`);
  return session;
}

/**
 * 完成騎乘會話
 */
export async function completeRideSession(): Promise<RideSessionData | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) {
      return null;
    }

    const session: RideSessionData = JSON.parse(data);
    session.status = 'completed';
    session.lastUpdateTime = Date.now();

    // 保存完成狀態
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch (error) {
    console.error('[GPS Recovery] Failed to complete session:', error);
    return null;
  }
}

/**
 * 清除騎乘會話數據
 */
export async function clearRideSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(SESSION_ID_KEY);
  } catch (error) {
    console.error('[GPS Recovery] Failed to clear session:', error);
  }
}

/**
 * 獲取當前會話數據
 */
export async function getCurrentSession(): Promise<RideSessionData | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) {
      return null;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('[GPS Recovery] Failed to get current session:', error);
    return null;
  }
}
