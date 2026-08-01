/**
 * 應用程式啟動初始化模組
 * 處理應用程式啟動時的所有初始化邏輯
 */

import { getRideSessionIntegration } from './integration/ride-session-integration';
import { getOfflineManager } from './offline/offline-manager';
import { getPowerSavingManager } from './power-saving/power-saving-manager';
import { getDashboardConfigManager } from './dashboard/dashboard-config-manager';

/**
 * 初始化應用程式
 */
export async function initializeApp(): Promise<void> {
  try {
    console.log('[AppInit] Starting application initialization...');

    // 1. 初始化離線存儲
    console.log('[AppInit] Initializing offline storage...');
    const offlineManager = getOfflineManager();
    await offlineManager.initialize();

    // 2. 初始化騎乘會話
    console.log('[AppInit] Initializing ride session...');
    const rideSession = getRideSessionIntegration();
    await rideSession.initialize();

    // 3. 初始化省電模式
    console.log('[AppInit] Initializing power saving mode...');
    const powerSavingManager = getPowerSavingManager();
    // 省電模式預設禁用，由用戶在設定中啟用

    // 4. 初始化儀表板配置
    console.log('[AppInit] Initializing dashboard config...');
    const dashboardConfig = getDashboardConfigManager();
    // 儀表板配置已在構造函數中初始化

    console.log('[AppInit] Application initialization completed successfully');
  } catch (error) {
    console.error('[AppInit] Initialization error:', error);
    // 不拋出錯誤，允許應用程式繼續運行
  }
}

/**
 * 清理應用程式資源
 */
export async function cleanupApp(): Promise<void> {
  try {
    console.log('[AppCleanup] Starting application cleanup...');

    const rideSession = getRideSessionIntegration();
    await rideSession.destroy();

    const powerSavingManager = getPowerSavingManager();
    await powerSavingManager.destroy();

    const offlineManager = getOfflineManager();
    offlineManager.destroy();

    console.log('[AppCleanup] Application cleanup completed');
  } catch (error) {
    console.error('[AppCleanup] Cleanup error:', error);
  }
}

/**
 * 檢查應用程式健康狀態
 */
export async function checkAppHealth(): Promise<{
  isHealthy: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // 檢查離線存儲
    const offlineManager = getOfflineManager();
    const stats = offlineManager.getStats();
    if (stats.totalRecords > 1000) {
      issues.push('Local storage has too many records');
    }

    // 檢查存儲空間
    const storageUsed = await offlineManager.getStorageUsage();
    const maxStorage = 500 * 1024 * 1024; // 500 MB
    if (storageUsed > maxStorage) {
      issues.push('Storage usage exceeds limit');
    }
  } catch (error) {
    console.error('[HealthCheck] Error checking app health:', error);
    issues.push('Failed to check app health');
  }

  return {
    isHealthy: issues.length === 0,
    issues,
  };
}
