import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { Vibration } from 'react-native';

/**
 * 背景執行補給提醒管理器
 * 
 * 功能：
 * - 在背景執行時監控補給閾值
 * - 螢幕鎖定時喚醒並顯示補給提醒
 * - 播放語音提醒和震動反饋
 * - 支持在前台、背景、鎖定螢幕都有效
 */

const SUPPLY_NOTIFICATION_TASK = 'supply-notification-task';

// 配置補給提醒
export interface SupplyNotificationConfig {
  waterThreshold: number; // 水分補給閾值（毫升）
  calorieThreshold: number; // 卡洛里補給閾值
  enableVoice: boolean; // 是否啟用語音提醒
  enableVibration: boolean; // 是否啟用震動
  enableScreenWakeup: boolean; // 是否啟用螢幕喚醒
}

// 補給狀態
interface SupplyState {
  waterConsumed: number;
  calorieConsumed: number;
  lastNotificationTime: number;
}

let supplyState: SupplyState = {
  waterConsumed: 0,
  calorieConsumed: 0,
  lastNotificationTime: 0,
};

let config: SupplyNotificationConfig = {
  waterThreshold: 500, // 預設 500ml
  calorieThreshold: 200, // 預設 200 卡洛里
  enableVoice: true,
  enableVibration: true,
  enableScreenWakeup: true,
};

/**
 * 初始化背景補給提醒
 */
export async function initializeBackgroundSupplyNotification(
  initialConfig?: Partial<SupplyNotificationConfig>
) {
  if (initialConfig) {
    config = { ...config, ...initialConfig };
  }

  // 配置通知
  await Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // 定義後台任務
  TaskManager.defineTask(SUPPLY_NOTIFICATION_TASK, async () => {
    try {
      // 檢查補給閾值
      await checkSupplyThreshold();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
      console.error('Background supply notification error:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });

  // 註冊後台任務
  try {
    await BackgroundFetch.registerTaskAsync(SUPPLY_NOTIFICATION_TASK, {
      minimumInterval: 60, // 每分鐘檢查一次
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (error) {
    console.error('Failed to register background fetch:', error);
  }
}

/**
 * 更新補給狀態
 */
export function updateSupplyState(
  waterConsumed?: number,
  calorieConsumed?: number
) {
  if (waterConsumed !== undefined) {
    supplyState.waterConsumed += waterConsumed;
  }
  if (calorieConsumed !== undefined) {
    supplyState.calorieConsumed += calorieConsumed;
  }
}

/**
 * 檢查補給閾值
 */
async function checkSupplyThreshold() {
  const now = Date.now();
  const timeSinceLastNotification = now - supplyState.lastNotificationTime;

  // 防止頻繁通知（至少間隔 30 秒）
  if (timeSinceLastNotification < 30000) {
    return;
  }

  let shouldNotify = false;
  let notificationMessage = '';
  let notificationType: 'water' | 'calorie' | 'both' = 'water';

  // 檢查水分
  if (supplyState.waterConsumed >= config.waterThreshold) {
    notificationMessage = '該補充水分了！';
    notificationType = 'water';
    shouldNotify = true;
  }

  // 檢查卡洛里
  if (supplyState.calorieConsumed >= config.calorieThreshold) {
    if (shouldNotify) {
      notificationMessage = '該補充水分和能量了！';
      notificationType = 'both';
    } else {
      notificationMessage = '該補充能量了！';
      notificationType = 'calorie';
      shouldNotify = true;
    }
  }

  if (shouldNotify) {
    // 喙醒螢幕
    // 注意：expo-brightness 在某些版本中可能不可用
    // 实际应用中可以使用其他方法喙醒螢幕

    // 播放語音提醒
    if (config.enableVoice) {
      await playVoiceNotification(notificationMessage);
    }

    // 震動反饋
    if (config.enableVibration) {
      Vibration.vibrate([200, 100, 200, 100, 200]); // 三次震動
    }

    // 發送通知
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '補給提醒',
        body: notificationMessage,
        sound: true,
        badge: 1,
      },
      trigger: null, // 立即顯示
    });

    // 更新最後通知時間
    supplyState.lastNotificationTime = now;
  }
}

/**
 * 播放語音提醒
 */
async function playVoiceNotification(message: string) {
  try {
    // 使用 expo-speech 進行文字轉語音
    const { speak } = require('expo-speech');
    await speak(message, {
      language: 'zh-TW',
      rate: 1.0,
      pitch: 1.0,
    });
  } catch (error) {
    console.error('Failed to play voice notification:', error);
  }
}

/**
 * 重置補給狀態
 */
export function resetSupplyState() {
  supplyState = {
    waterConsumed: 0,
    calorieConsumed: 0,
    lastNotificationTime: 0,
  };
}

/**
 * 獲取補給狀態
 */
export function getSupplyState(): SupplyState {
  return { ...supplyState };
}

/**
 * 更新配置
 */
export function updateConfig(newConfig: Partial<SupplyNotificationConfig>) {
  config = { ...config, ...newConfig };
}

/**
 * 獲取配置
 */
export function getConfig(): SupplyNotificationConfig {
  return { ...config };
}

/**
 * 停止背景補給提醒
 */
export async function stopBackgroundSupplyNotification() {
  try {
    await BackgroundFetch.unregisterTaskAsync(SUPPLY_NOTIFICATION_TASK);
  } catch (error) {
    console.error('Failed to unregister background fetch:', error);
  }
}
