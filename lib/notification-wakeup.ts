import { NativeModules, Platform } from 'react-native';

const { NotificationWakeupModule } = NativeModules;

/**
 * 通知彈窗喚醒管理模塊
 * 功能：屏幕關閉時喚醒屏幕、管理彈窗佇列、攔截音量鍵
 */

interface NotificationWakeupOptions {
  notificationId: string;
  duration?: number; // 毫秒，0 表示無限期
  onVolumeKeyDown?: () => void;
  onVolumeKeyUp?: () => void;
}

interface NotificationQueue {
  queueSize: number;
  notifications: string[];
}

class NotificationWakeupManager {
  private static instance: NotificationWakeupManager;
  private notificationQueue: Map<string, NotificationWakeupOptions> = new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): NotificationWakeupManager {
    if (!NotificationWakeupManager.instance) {
      NotificationWakeupManager.instance = new NotificationWakeupManager();
    }
    return NotificationWakeupManager.instance;
  }

  /**
   * 初始化模塊
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (Platform.OS === 'android' && NotificationWakeupModule) {
      try {
        await NotificationWakeupModule.setCurrentActivity();
        this.isInitialized = true;
        console.log('[NotificationWakeup] Module initialized');
      } catch (error) {
        console.error('[NotificationWakeup] Initialization failed:', error);
      }
    }
  }

  /**
   * 喚醒屏幕並顯示彈窗
   * @param options 彈窗選項
   */
  async wakeupScreenAndShowNotification(options: NotificationWakeupOptions): Promise<boolean> {
    if (!this.isInitialized || !NotificationWakeupModule) {
      console.warn('[NotificationWakeup] Module not initialized');
      return false;
    }

    try {
      const { notificationId, duration = 0 } = options;
      
      // 添加到本地佇列
      this.notificationQueue.set(notificationId, options);

      // 調用原生模塊
      const result = await NotificationWakeupModule.wakeupScreenAndShowNotification(
        notificationId,
        duration
      );

      console.log('[NotificationWakeup] Screen wakeup result:', result);
      return result.success;
    } catch (error) {
      console.error('[NotificationWakeup] Wakeup failed:', error);
      return false;
    }
  }

  /**
   * 關閉最早的彈窗（FIFO - First In First Out）
   * 用於音量鍵按下時的響應
   */
  async dismissOldestNotification(): Promise<string | null> {
    if (!this.isInitialized || !NotificationWakeupModule) {
      console.warn('[NotificationWakeup] Module not initialized');
      return null;
    }

    try {
      const result = await NotificationWakeupModule.dismissOldestNotification();

      if (result.success) {
        this.notificationQueue.delete(result.dismissedId);
        console.log('[NotificationWakeup] Dismissed notification:', result.dismissedId);
        return result.dismissedId;
      }

      return null;
    } catch (error) {
      console.error('[NotificationWakeup] Dismiss failed:', error);
      return null;
    }
  }

  /**
   * 獲取當前佇列中的彈窗數量
   */
  async getQueueSize(): Promise<NotificationQueue> {
    if (!this.isInitialized || !NotificationWakeupModule) {
      return { queueSize: 0, notifications: [] };
    }

    try {
      const result = await NotificationWakeupModule.getNotificationQueueSize();
      return result;
    } catch (error) {
      console.error('[NotificationWakeup] Get queue size failed:', error);
      return { queueSize: 0, notifications: [] };
    }
  }

  /**
   * 清空所有彈窗
   */
  async clearAllNotifications(): Promise<boolean> {
    if (!this.isInitialized || !NotificationWakeupModule) {
      return false;
    }

    try {
      const result = await NotificationWakeupModule.clearAllNotifications();
      if (result.success) {
        this.notificationQueue.clear();
        console.log('[NotificationWakeup] All notifications cleared');
      }
      return result.success;
    } catch (error) {
      console.error('[NotificationWakeup] Clear failed:', error);
      return false;
    }
  }

  /**
   * 獲取本地佇列中的彈窗選項
   */
  getNotificationOptions(notificationId: string): NotificationWakeupOptions | undefined {
    return this.notificationQueue.get(notificationId);
  }

  /**
   * 獲取所有本地佇列中的彈窗
   */
  getAllNotifications(): NotificationWakeupOptions[] {
    return Array.from(this.notificationQueue.values());
  }
}

export const notificationWakeupManager = NotificationWakeupManager.getInstance();

/**
 * 使用 Hook：在彈窗組件中使用
 * 
 * @example
 * const { wakeupScreen, dismissNotification } = useNotificationWakeup();
 * 
 * useEffect(() => {
 *   wakeupScreen({
 *     notificationId: 'water-reminder-1',
 *     duration: 0, // 無限期
 *     onVolumeKeyDown: () => dismissNotification(),
 *   });
 * }, []);
 */
export function useNotificationWakeup() {
  return {
    wakeupScreen: (options: NotificationWakeupOptions) =>
      notificationWakeupManager.wakeupScreenAndShowNotification(options),
    dismissNotification: () =>
      notificationWakeupManager.dismissOldestNotification(),
    getQueueSize: () =>
      notificationWakeupManager.getQueueSize(),
    clearAll: () =>
      notificationWakeupManager.clearAllNotifications(),
  };
}
