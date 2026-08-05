/**
 * 前台服務與背景進程保護
 * 
 * 功能：
 * 1. 啟用高優先級前台服務
 * 2. 系統通知欄顯示實時騎乘狀態
 * 3. 防止系統殺掉進程
 * 
 * 注意：原生實現需要 Android 原生代碼支援
 * 此處提供 JavaScript 層面的管理邏輯
 */

import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface ForegroundServiceConfig {
  taskName: string;
  notificationTitle: string;
  notificationBody: string;
  notificationChannelId: string;
  priority: 'min' | 'low' | 'default' | 'high' | 'max';
}

const DEFAULT_CONFIG: ForegroundServiceConfig = {
  taskName: 'BIKE_ASSISTANT_FOREGROUND_TASK',
  notificationTitle: '單車助手',
  notificationBody: '正在記錄騎乘數據...',
  notificationChannelId: 'bike_assistant_foreground',
  priority: 'high',
};

let isServiceRunning = false;
let notificationId: string | undefined = undefined;

/**
 * 初始化通知頻道（Android 8.0+）
 */
export async function initializeNotificationChannel(
  channelId: string = DEFAULT_CONFIG.notificationChannelId
): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: '騎乘通知',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0],
      lightColor: '#FF231F7C',
      sound: null,
      enableVibrate: false,
      enableLights: false,
      bypassDnd: true,
    });
  } catch (error) {
    console.error('[ForegroundService] Failed to initialize notification channel:', error);
  }
}

/**
 * 啟動前台服務
 */
export async function startForegroundService(
  config: Partial<ForegroundServiceConfig> = {}
): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (isServiceRunning) {
    console.warn('[ForegroundService] Service is already running');
    return;
  }

  try {
    // 初始化通知頻道
    await initializeNotificationChannel(finalConfig.notificationChannelId);

    // 發送前台通知
    notificationId = (await Notifications.scheduleNotificationAsync({
      content: {
        title: finalConfig.notificationTitle,
        body: finalConfig.notificationBody,
        sound: null,
        badge: 1,
        priority: finalConfig.priority,
        sticky: true,
        autoDismiss: false,
        data: {
          serviceType: 'foreground',
        },
      },
      trigger: null, // 立即發送
    })) as string;

    isServiceRunning = true;
    console.log('[ForegroundService] Started successfully');
  } catch (error) {
    console.error('[ForegroundService] Failed to start:', error);
    throw error;
  }
}

/**
 * 停止前台服務
 */
export async function stopForegroundService(): Promise<void> {
  if (!isServiceRunning) {
    console.warn('[ForegroundService] Service is not running');
    return;
  }

  try {
    // 移除通知
    if (notificationId) {
      await Notifications.dismissNotificationAsync(notificationId);
      notificationId = undefined;
    }

    isServiceRunning = false;
    console.log('[ForegroundService] Stopped successfully');
  } catch (error) {
    console.error('[ForegroundService] Failed to stop:', error);
  }
}

/**
 * 更新前台通知內容
 */
export async function updateForegroundNotification(
  title: string,
  body: string
): Promise<void> {
  if (!isServiceRunning || !notificationId) {
    console.warn('[ForegroundService] Service is not running');
    return;
  }

  try {
    // Expo Notifications 不支援直接更新，需要重新發送
    if (notificationId) {
      await Notifications.dismissNotificationAsync(notificationId);
    }

    notificationId = (await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: null,
        badge: 1,
        priority: 'high',
        sticky: true,
        autoDismiss: false,
        data: {
          serviceType: 'foreground',
        },
      },
      trigger: null,
    })) as string;
  } catch (error) {
    console.error('[ForegroundService] Failed to update notification:', error);
  }
}

/**
 * 檢查前台服務是否運行
 */
export function isForegroundServiceRunning(): boolean {
  return isServiceRunning;
}

/**
 * 註冊背景任務（用於後台 GPS 定位）
 */
export async function registerBackgroundLocationTask(
  taskName: string,
  taskHandler: TaskManager.TaskManagerTaskExecutor
): Promise<void> {
  try {
    // 檢查任務是否已註冊
    const isRegistered = await TaskManager.isTaskRegisteredAsync(taskName);
    if (isRegistered) {
      console.log(`[ForegroundService] Task ${taskName} is already registered`);
      return;
    }

    // 註冊新任務
    TaskManager.defineTask(taskName, taskHandler);
    console.log(`[ForegroundService] Task ${taskName} registered successfully`);
  } catch (error) {
    console.error(`[ForegroundService] Failed to register task ${taskName}:`, error);
    throw error;
  }
}

/**
 * 取消註冊背景任務
 */
export async function unregisterBackgroundLocationTask(taskName: string): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(taskName);
    if (!isRegistered) {
      console.log(`[ForegroundService] Task ${taskName} is not registered`);
      return;
    }

    await TaskManager.unregisterTaskAsync(taskName);
    console.log(`[ForegroundService] Task ${taskName} unregistered successfully`);
  } catch (error) {
    console.error(`[ForegroundService] Failed to unregister task ${taskName}:`, error);
  }
}

/**
 * 獲取前台服務狀態
 */
export function getForegroundServiceStatus(): {
  isRunning: boolean;
  notificationId: string | undefined;
} {
  return {
    isRunning: isServiceRunning,
    notificationId,
  };
}
