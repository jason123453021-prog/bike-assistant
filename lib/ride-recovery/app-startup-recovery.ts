import { RideSession, initializeRideSession, recoverRideSessionFromBackup } from './ride-session-recovery';

/**
 * App 啟動時的自動恢復機制
 * 檢測未完成的騎乘會話並自動恢復
 */

export interface RecoveryResult {
  hasUnfinishedRide: boolean;
  session: RideSession | null;
  recoverySource: 'main' | 'backup' | null;
  message: string;
}

/**
 * App 啟動時執行恢復檢查
 * 應在 App 根層級的 useEffect 中調用
 */
export async function checkAndRecoverRideSession(): Promise<RecoveryResult> {
  try {
    // 首先嘗試從主存儲恢復
    let session = await initializeRideSession();
    
    if (session && session.isActive) {
      return {
        hasUnfinishedRide: true,
        session,
        recoverySource: 'main',
        message: `檢測到未完成的騎乘 (${formatDuration(session.stats.totalTime)})，已自動恢復。`,
      };
    }

    // 如果主存儲無有效會話，嘗試從備份恢復
    session = await recoverRideSessionFromBackup();
    
    if (session && session.isActive) {
      return {
        hasUnfinishedRide: true,
        session,
        recoverySource: 'backup',
        message: `從備份恢復騎乘會話 (${formatDuration(session.stats.totalTime)})。`,
      };
    }

    // 無未完成的騎乘
    return {
      hasUnfinishedRide: false,
      session: null,
      recoverySource: null,
      message: '無未完成的騎乘記錄。',
    };
  } catch (error) {
    console.error('Error during ride session recovery check:', error);
    return {
      hasUnfinishedRide: false,
      session: null,
      recoverySource: null,
      message: '恢復檢查失敗，請稍後重試。',
    };
  }
}

/**
 * 生成地圖軌跡線段數據（用於在地圖上繪製恢復的軌跡）
 */
export function generateMapTraceData(session: RideSession) {
  return {
    coordinates: session.trackPoints.map(point => ({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      timestamp: point.timestamp,
    })),
    stats: {
      totalPoints: session.trackPoints.length,
      totalDistance: session.stats.totalDistance,
      totalElevationGain: session.stats.totalElevationGain,
      totalElevationLoss: session.stats.totalElevationLoss,
      maxAltitude: session.stats.maxAltitude,
      minAltitude: session.stats.minAltitude,
    },
    bounds: calculateBounds(session.trackPoints),
  };
}

/**
 * 計算軌跡的地理邊界（用於地圖自動縮放）
 */
function calculateBounds(trackPoints: any[]) {
  if (trackPoints.length === 0) {
    return null;
  }

  let minLat = Infinity,
    maxLat = -Infinity;
  let minLon = Infinity,
    maxLon = -Infinity;

  trackPoints.forEach(point => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
  });

  return {
    northeast: { latitude: maxLat, longitude: maxLon },
    southwest: { latitude: minLat, longitude: minLon },
  };
}

/**
 * 格式化時間顯示
 */
function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}小時 ${minutes}分 ${seconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分 ${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 生成恢復提示信息
 */
export function generateRecoveryNotification(session: RideSession): {
  title: string;
  body: string;
  actions: Array<{ label: string; action: string }>;
} {
  const duration = formatDuration(session.stats.totalTime);
  const distance = (session.stats.totalDistance / 1000).toFixed(2);

  return {
    title: '騎乘會話已恢復',
    body: `已恢復 ${duration} 的騎乘記錄，距離 ${distance} km。您可以選擇繼續騎乘或查看詳情。`,
    actions: [
      { label: '繼續騎乘', action: 'continue' },
      { label: '查看詳情', action: 'view_details' },
      { label: '結束騎乘', action: 'end_ride' },
    ],
  };
}

/**
 * 驗證恢復的會話數據完整性
 */
export function validateRecoveredSession(session: RideSession): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!session.id) {
    issues.push('會話 ID 缺失');
  }

  if (!session.trackPoints || session.trackPoints.length === 0) {
    issues.push('軌跡點數據缺失');
  }

  if (session.stats.totalDistance < 0) {
    issues.push('總距離數據異常');
  }

  if (session.stats.totalTime < 0) {
    issues.push('總時間數據異常');
  }

  if (
    session.stats.maxAltitude === -Infinity ||
    session.stats.minAltitude === Infinity
  ) {
    issues.push('海拔數據異常');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * 生成恢復統計摘要
 */
export function generateRecoverySummary(session: RideSession): {
  duration: string;
  distance: string;
  elevation: string;
  avgSpeed: string;
  maxSpeed: string;
  calories: string;
} {
  return {
    duration: formatDuration(session.stats.totalTime),
    distance: `${(session.stats.totalDistance / 1000).toFixed(2)} km`,
    elevation: `${Math.round(session.stats.totalElevationGain)} m`,
    avgSpeed: `${session.stats.averageSpeed.toFixed(1)} km/h`,
    maxSpeed: `${session.stats.maxSpeed.toFixed(1)} km/h`,
    calories: `${Math.round(session.stats.caloriesBurned)} kcal`,
  };
}
