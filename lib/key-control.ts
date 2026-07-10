import { AppState, AppStateStatus, Platform } from 'react-native';

/**
 * 按鍵控制管理器
 * 
 * 功能：
 * - 支持語音鍵（或音量鍵）關閉補給提示
 * - 支持多個提示畫面用音量鍵依次關閉
 * - 在前台、背景、鎖定螢幕都有效
 */

export type KeyEventListener = (keyCode: number) => void;

class KeyControlManager {
  private listeners: KeyEventListener[] = [];
  private isEnabled = true;
  private appState: AppStateStatus = 'active';

  constructor() {
    // 監聽應用狀態變化
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * 處理應用狀態變化
   */
  private handleAppStateChange = (state: AppStateStatus) => {
    this.appState = state;
  };

  /**
   * 添加按鍵事件監聽器
   */
  addListener(listener: KeyEventListener) {
    this.listeners.push(listener);
  }

  /**
   * 移除按鍵事件監聽器
   */
  removeListener(listener: KeyEventListener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * 啟用按鍵控制
   */
  enable() {
    this.isEnabled = true;
  }

  /**
   * 禁用按鍵控制
   */
  disable() {
    this.isEnabled = false;
  }

  /**
   * 處理按鍵事件
   * 
   * 按鍵代碼：
   * - 24: 音量增加鍵（KEYCODE_VOLUME_UP）
   * - 25: 音量減少鍵（KEYCODE_VOLUME_DOWN）
   * - 79: 菜單鍵（KEYCODE_MENU）
   * - 4: 返回鍵（KEYCODE_BACK）
   */
  handleKeyEvent(keyCode: number) {
    if (!this.isEnabled) {
      return;
    }

    // 音量鍵或菜單鍵觸發
    if (keyCode === 24 || keyCode === 25 || keyCode === 79) {
      this.listeners.forEach((listener) => {
        try {
          listener(keyCode);
        } catch (error) {
          console.error('Key event listener error:', error);
        }
      });
    }
  }

  /**
   * 獲取當前應用狀態
   */
  getAppState(): AppStateStatus {
    return this.appState;
  }

  /**
   * 清理資源
   */
  cleanup() {
    this.listeners = [];
  }
}

// 導出單例
export const keyControlManager = new KeyControlManager();

/**
 * 補給提示控制器
 * 
 * 用於管理補給提示的顯示和隱藏
 */
export interface SupplyNotification {
  id: string;
  type: 'calorie' | 'water' | 'custom'; // 補給類型
  message: string;
  priority: number; // 優先級（1-10，越高越重要）
  timestamp: number;
}

class SupplyNotificationController {
  private notifications: SupplyNotification[] = [];
  private currentIndex = 0;
  private onNotificationChange: ((notification: SupplyNotification | null) => void) | null = null;

  constructor() {
    // 監聽按鍵事件
    keyControlManager.addListener(this.handleKeyEvent.bind(this));
  }

  /**
   * 添加補給提示
   */
  addNotification(notification: SupplyNotification) {
    this.notifications.push(notification);
    // 按優先級排序
    this.notifications.sort((a, b) => b.priority - a.priority);
    this.currentIndex = 0;
    this.updateCurrentNotification();
  }

  /**
   * 移除補給提示
   */
  removeNotification(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    if (this.currentIndex >= this.notifications.length) {
      this.currentIndex = Math.max(0, this.notifications.length - 1);
    }
    this.updateCurrentNotification();
  }

  /**
   * 清空所有補給提示
   */
  clearAll() {
    this.notifications = [];
    this.currentIndex = 0;
    this.updateCurrentNotification();
  }

  /**
   * 獲取當前補給提示
   */
  getCurrentNotification(): SupplyNotification | null {
    if (this.notifications.length === 0) {
      return null;
    }
    return this.notifications[this.currentIndex] || null;
  }

  /**
   * 獲取所有補給提示
   */
  getAllNotifications(): SupplyNotification[] {
    return [...this.notifications];
  }

  /**
   * 設置通知變化回調
   */
  setOnNotificationChange(callback: (notification: SupplyNotification | null) => void) {
    this.onNotificationChange = callback;
  }

  /**
   * 處理按鍵事件
   */
  private handleKeyEvent(keyCode: number) {
    if (this.notifications.length === 0) {
      return;
    }

    // 音量增加鍵：下一個提示
    if (keyCode === 24) {
      this.currentIndex = (this.currentIndex + 1) % this.notifications.length;
      this.updateCurrentNotification();
    }
    // 音量減少鍵：關閉當前提示
    else if (keyCode === 25) {
      const current = this.notifications[this.currentIndex];
      if (current) {
        this.removeNotification(current.id);
      }
    }
  }

  /**
   * 更新當前通知
   */
  private updateCurrentNotification() {
    if (this.onNotificationChange) {
      this.onNotificationChange(this.getCurrentNotification());
    }
  }

  /**
   * 清理資源
   */
  cleanup() {
    keyControlManager.removeListener(this.handleKeyEvent.bind(this));
  }
}

export const supplyNotificationController = new SupplyNotificationController();
