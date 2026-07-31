/**
 * 崩潰恢復管理器
 * 在應用啟動時檢測未完成的騎乘會話，並自動恢復所有數據
 */

import {
  getCurrentSession,
  saveCurrentSession,
  clearCurrentSession,
  RideSessionData,
} from '@/lib/storage/mmkv-storage';

export interface RecoveryState {
  hasUnfinishedSession: boolean;
  session: RideSessionData | null;
  recoveryTimestamp: number;
}

/**
 * 檢查是否存在未完成的騎乘會話
 */
export function checkForUnfinishedSession(): RecoveryState {
  const session = getCurrentSession();
  
  if (!session) {
    return {
      hasUnfinishedSession: false,
      session: null,
      recoveryTimestamp: Date.now(),
    };
  }
  
  // 檢查會話是否被標記為活躍但未正常結束
  if (session.isActive && !session.endTime) {
    console.log('[CrashRecovery] Found unfinished session:', {
      id: session.id,
      startTime: new Date(session.startTime).toISOString(),
      coordinatesCount: session.coordinates.length,
      totalDistance: session.totalDistance,
      totalElapsed: session.totalElapsed,
    });
    
    return {
      hasUnfinishedSession: true,
      session,
      recoveryTimestamp: Date.now(),
    };
  }
  
  return {
    hasUnfinishedSession: false,
    session: null,
    recoveryTimestamp: Date.now(),
  };
}

/**
 * 恢復未完成的會話
 * 將會話標記為恢復狀態，但保持活躍以允許用戶繼續騎乘
 */
export function recoverSession(session: RideSessionData): RideSessionData {
  const recoveredSession: RideSessionData = {
    ...session,
    isActive: true, // 保持活躍狀態
    // 添加恢復標記
    notes: (session.notes || '') + `\n[恢復於 ${new Date().toISOString()}]`,
  };
  
  // 保存恢復的會話
  saveCurrentSession(recoveredSession);
  
  console.log('[CrashRecovery] Session recovered successfully');
  
  return recoveredSession;
}

/**
 * 驗證恢復的會話數據完整性
 */
export function validateSessionData(session: RideSessionData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // 檢查必需字段
  if (!session.id) errors.push('Missing session ID');
  if (!session.startTime) errors.push('Missing start time');
  if (!Array.isArray(session.coordinates)) errors.push('Invalid coordinates array');
  if (typeof session.totalDistance !== 'number') errors.push('Invalid total distance');
  if (typeof session.totalElapsed !== 'number') errors.push('Invalid total elapsed');
  if (typeof session.totalAscent !== 'number') errors.push('Invalid total ascent');
  
  // 檢查座標數據
  if (session.coordinates.length > 0) {
    const invalidCoords = session.coordinates.filter(
      coord => !Number.isFinite(coord.lat) || !Number.isFinite(coord.lon) || !Number.isFinite(coord.ele)
    );
    if (invalidCoords.length > 0) {
      errors.push(`Found ${invalidCoords.length} invalid coordinates`);
    }
  }
  
  // 檢查統計數據的合理性
  if (session.totalDistance < 0) errors.push('Negative total distance');
  if (session.totalElapsed < 0) errors.push('Negative total elapsed time');
  if (session.totalAscent < 0) errors.push('Negative total ascent');
  if (session.totalCalories < 0) errors.push('Negative total calories');
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 修復損壞的會話數據
 */
export function repairSessionData(session: RideSessionData): RideSessionData {
  const repaired = { ...session };
  
  // 移除無效的座標
  repaired.coordinates = session.coordinates.filter(
    coord => Number.isFinite(coord.lat) && Number.isFinite(coord.lon) && Number.isFinite(coord.ele)
  );
  
  // 修復負數值
  if (repaired.totalDistance < 0) repaired.totalDistance = 0;
  if (repaired.totalElapsed < 0) repaired.totalElapsed = 0;
  if (repaired.totalAscent < 0) repaired.totalAscent = 0;
  if (repaired.totalCalories < 0) repaired.totalCalories = 0;
  if (repaired.totalPausedTime < 0) repaired.totalPausedTime = 0;
  
  // 確保必需字段存在
  if (!repaired.id) repaired.id = `recovered-${Date.now()}`;
  if (!repaired.startTime) repaired.startTime = Date.now();
  
  console.log('[CrashRecovery] Session data repaired');
  
  return repaired;
}

/**
 * 清除崩潰恢復狀態
 * 在用戶確認恢復或選擇丟棄數據時調用
 */
export function clearRecoveryState(): void {
  clearCurrentSession();
  console.log('[CrashRecovery] Recovery state cleared');
}

/**
 * 獲取恢復統計信息
 */
export function getRecoveryStats(session: RideSessionData): {
  coordinatesCount: number;
  totalDistance: number;
  totalTime: string;
  totalAscent: number;
  totalCalories: number;
  lastUpdateTime: string;
} {
  const lastCoord = session.coordinates[session.coordinates.length - 1];
  
  return {
    coordinatesCount: session.coordinates.length,
    totalDistance: session.totalDistance,
    totalTime: formatDuration(session.totalElapsed),
    totalAscent: session.totalAscent,
    totalCalories: Math.round(session.totalCalories),
    lastUpdateTime: lastCoord ? new Date(lastCoord.timestamp).toISOString() : 'N/A',
  };
}

/**
 * 格式化時間持續時間
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * 初始化崩潰恢復系統
 * 應在應用啟動時調用
 */
export async function initializeCrashRecovery(): Promise<RecoveryState> {
  try {
    console.log('[CrashRecovery] Initializing crash recovery system');
    
    const recoveryState = checkForUnfinishedSession();
    
    if (recoveryState.hasUnfinishedSession && recoveryState.session) {
      // 驗證會話數據
      const validation = validateSessionData(recoveryState.session);
      
      if (!validation.isValid) {
        console.warn('[CrashRecovery] Session data validation failed:', validation.errors);
        
        // 嘗試修復數據
        const repairedSession = repairSessionData(recoveryState.session);
        const repairedValidation = validateSessionData(repairedSession);
        
        if (repairedValidation.isValid) {
          console.log('[CrashRecovery] Session data repaired successfully');
          recoveryState.session = repairedSession;
        } else {
          console.error('[CrashRecovery] Failed to repair session data:', repairedValidation.errors);
          // 無法修復，清除會話
          clearRecoveryState();
          return {
            hasUnfinishedSession: false,
            session: null,
            recoveryTimestamp: Date.now(),
          };
        }
      }
      
      // 記錄恢復統計
      const stats = getRecoveryStats(recoveryState.session);
      console.log('[CrashRecovery] Recovery stats:', stats);
    }
    
    return recoveryState;
  } catch (error) {
    console.error('[CrashRecovery] Error during initialization:', error);
    return {
      hasUnfinishedSession: false,
      session: null,
      recoveryTimestamp: Date.now(),
    };
  }
}
