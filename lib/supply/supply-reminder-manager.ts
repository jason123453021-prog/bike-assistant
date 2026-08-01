/**
 * 補給提醒系統全面重構
 * 管理卡路里、水分和自訂補給品的提醒機制
 */

export interface SupplyThreshold {
  id: string;
  name: string;
  type: 'calories' | 'water' | 'custom';
  threshold: number; // 卡路里（kcal）或水分（ml）或自訂單位
  unit: string;
  enabled: boolean;
  continuous: boolean; // 是否持續提醒
  voiceEnabled: boolean; // 是否啟用語音提醒
  vibrationEnabled: boolean; // 是否啟用震動
  soundEnabled: boolean; // 是否啟用聲音
  pauseOnDownhill: boolean; // 下坡時暫停提醒
  customMessage?: string; // 自訂提醒訊息
  icon?: string; // 圖示
}

export interface SupplyState {
  caloriesSinceRefill: number;
  waterSinceRefill: number; // ml
  customSupplyCount: Record<string, number>; // 自訂補給品計數
  lastRefillTime: number | null;
  pendingReminders: string[]; // 待發送的提醒 ID
  isDownhill: boolean; // 是否在下坡
}

export interface SupplyReminder {
  id: string;
  thresholdId: string;
  name: string;
  message: string;
  timestamp: number;
  dismissed: boolean;
}

/**
 * 補給提醒管理器
 */
export class SupplyReminderManager {
  private thresholds: Map<string, SupplyThreshold>;
  private state: SupplyState;
  private reminders: SupplyReminder[] = [];
  private onReminderCallback: ((reminder: SupplyReminder) => void) | null = null;
  private onRefillCallback: ((thresholdId: string) => void) | null = null;

  constructor() {
    this.thresholds = new Map();
    this.state = {
      caloriesSinceRefill: 0,
      waterSinceRefill: 0,
      customSupplyCount: {},
      lastRefillTime: null,
      pendingReminders: [],
      isDownhill: false,
    };

    // 添加預設閾值
    this.addThreshold({
      id: 'calories-default',
      name: '卡路里',
      type: 'calories',
      threshold: 500, // 500 kcal
      unit: 'kcal',
      enabled: true,
      continuous: true,
      voiceEnabled: true,
      vibrationEnabled: true,
      soundEnabled: true,
      pauseOnDownhill: true,
    });

    this.addThreshold({
      id: 'water-default',
      name: '水分',
      type: 'water',
      threshold: 500, // 500 ml
      unit: 'ml',
      enabled: true,
      continuous: true,
      voiceEnabled: true,
      vibrationEnabled: true,
      soundEnabled: true,
      pauseOnDownhill: true,
    });
  }

  /**
   * 添加補給閾值
   */
  addThreshold(threshold: SupplyThreshold): void {
    this.thresholds.set(threshold.id, threshold);
    if (threshold.type === 'custom') {
      this.state.customSupplyCount[threshold.id] = 0;
    }
  }

  /**
   * 移除補給閾值
   */
  removeThreshold(thresholdId: string): void {
    this.thresholds.delete(thresholdId);
    if (this.state.customSupplyCount[thresholdId] !== undefined) {
      delete this.state.customSupplyCount[thresholdId];
    }
  }

  /**
   * 更新補給閾值
   */
  updateThreshold(thresholdId: string, updates: Partial<SupplyThreshold>): void {
    const threshold = this.thresholds.get(thresholdId);
    if (threshold) {
      this.thresholds.set(thresholdId, { ...threshold, ...updates });
    }
  }

  /**
   * 獲取所有補給閾值
   */
  getThresholds(): SupplyThreshold[] {
    return Array.from(this.thresholds.values());
  }

  /**
   * 獲取啟用的補給閾值
   */
  getEnabledThresholds(): SupplyThreshold[] {
    return Array.from(this.thresholds.values()).filter(t => t.enabled);
  }

  /**
   * 更新卡路里消耗
   */
  updateCalories(calories: number): void {
    this.state.caloriesSinceRefill += calories;
    this.checkThresholds();
  }

  /**
   * 更新水分消耗
   */
  updateWater(water: number): void {
    this.state.waterSinceRefill += water;
    this.checkThresholds();
  }

  /**
   * 更新自訂補給品計數
   */
  updateCustomSupply(thresholdId: string, amount: number = 1): void {
    if (!this.state.customSupplyCount[thresholdId]) {
      this.state.customSupplyCount[thresholdId] = 0;
    }
    this.state.customSupplyCount[thresholdId] += amount;
    this.checkThresholds();
  }

  /**
   * 設置下坡狀態
   */
  setDownhillState(isDownhill: boolean): void {
    this.state.isDownhill = isDownhill;
  }

  /**
   * 檢查是否應觸發提醒
   */
  private checkThresholds(): void {
    const enabledThresholds = this.getEnabledThresholds();

    for (const threshold of enabledThresholds) {
      let shouldRemind = false;

      if (threshold.type === 'calories') {
        shouldRemind = this.state.caloriesSinceRefill >= threshold.threshold;
      } else if (threshold.type === 'water') {
        shouldRemind = this.state.waterSinceRefill >= threshold.threshold;
      } else if (threshold.type === 'custom') {
        const count = this.state.customSupplyCount[threshold.id] || 0;
        shouldRemind = count >= threshold.threshold;
      }

      // 檢查是否應暫停提醒（下坡時）
      if (shouldRemind && threshold.pauseOnDownhill && this.state.isDownhill) {
        shouldRemind = false;
      }

      // 檢查是否已經在待發送列表中
      const alreadyPending = this.state.pendingReminders.includes(threshold.id);

      if (shouldRemind && !alreadyPending) {
        this.state.pendingReminders.push(threshold.id);
        this.triggerReminder(threshold);
      }
    }
  }

  /**
   * 觸發提醒
   */
  private triggerReminder(threshold: SupplyThreshold): void {
    const reminder: SupplyReminder = {
      id: `reminder-${threshold.id}-${Date.now()}`,
      thresholdId: threshold.id,
      name: threshold.name,
      message: threshold.customMessage || `請補給 ${threshold.name}`,
      timestamp: Date.now(),
      dismissed: false,
    };

    this.reminders.push(reminder);

    // 調用回調函數
    if (this.onReminderCallback) {
      this.onReminderCallback(reminder);
    }

    console.log('[SupplyReminder] Triggered:', {
      name: threshold.name,
      type: threshold.type,
      voiceEnabled: threshold.voiceEnabled,
      vibrationEnabled: threshold.vibrationEnabled,
      soundEnabled: threshold.soundEnabled,
    });
  }

  /**
   * 確認補給（重置計數）
   */
  confirmRefill(thresholdId?: string): void {
    if (thresholdId) {
      // 重置特定補給品
      const threshold = this.thresholds.get(thresholdId);
      if (threshold) {
        if (threshold.type === 'calories') {
          this.state.caloriesSinceRefill = 0;
        } else if (threshold.type === 'water') {
          this.state.waterSinceRefill = 0;
        } else if (threshold.type === 'custom') {
          this.state.customSupplyCount[thresholdId] = 0;
        }

        // 從待發送列表中移除
        this.state.pendingReminders = this.state.pendingReminders.filter(id => id !== thresholdId);

        // 調用回調函數
        if (this.onRefillCallback) {
          this.onRefillCallback(thresholdId);
        }

        console.log('[SupplyReminder] Refill confirmed:', threshold.name);
      }
    } else {
      // 重置所有計數
      this.state.caloriesSinceRefill = 0;
      this.state.waterSinceRefill = 0;
      this.state.customSupplyCount = {};
      this.state.pendingReminders = [];

      console.log('[SupplyReminder] All refills confirmed');
    }

    this.state.lastRefillTime = Date.now();
  }

  /**
   * 關閉提醒
   */
  dismissReminder(reminderId: string): void {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (reminder) {
      reminder.dismissed = true;
    }
  }

  /**
   * 獲取待發送的提醒
   */
  getPendingReminders(): SupplyReminder[] {
    return this.reminders.filter(r => !r.dismissed && !this.state.pendingReminders.includes(r.thresholdId));
  }

  /**
   * 獲取所有提醒
   */
  getAllReminders(): SupplyReminder[] {
    return [...this.reminders];
  }

  /**
   * 清除已關閉的提醒
   */
  clearDismissedReminders(): void {
    this.reminders = this.reminders.filter(r => !r.dismissed);
  }

  /**
   * 獲取當前狀態
   */
  getState(): SupplyState {
    return { ...this.state };
  }

  /**
   * 設置提醒回調
   */
  setOnReminderCallback(callback: (reminder: SupplyReminder) => void): void {
    this.onReminderCallback = callback;
  }

  /**
   * 設置補給回調
   */
  setOnRefillCallback(callback: (thresholdId: string) => void): void {
    this.onRefillCallback = callback;
  }

  /**
   * 重置管理器
   */
  reset(): void {
    this.state = {
      caloriesSinceRefill: 0,
      waterSinceRefill: 0,
      customSupplyCount: {},
      lastRefillTime: null,
      pendingReminders: [],
      isDownhill: false,
    };
    this.reminders = [];
  }

  /**
   * 獲取進度百分比
   */
  getProgressPercentage(thresholdId: string): number {
    const threshold = this.thresholds.get(thresholdId);
    if (!threshold) return 0;

    let current = 0;
    if (threshold.type === 'calories') {
      current = this.state.caloriesSinceRefill;
    } else if (threshold.type === 'water') {
      current = this.state.waterSinceRefill;
    } else if (threshold.type === 'custom') {
      current = this.state.customSupplyCount[thresholdId] || 0;
    }

    return Math.min(100, (current / threshold.threshold) * 100);
  }

  /**
   * 獲取剩餘量
   */
  getRemainingAmount(thresholdId: string): number {
    const threshold = this.thresholds.get(thresholdId);
    if (!threshold) return 0;

    let current = 0;
    if (threshold.type === 'calories') {
      current = this.state.caloriesSinceRefill;
    } else if (threshold.type === 'water') {
      current = this.state.waterSinceRefill;
    } else if (threshold.type === 'custom') {
      current = this.state.customSupplyCount[thresholdId] || 0;
    }

    return Math.max(0, threshold.threshold - current);
  }
}

/**
 * 全局補給提醒管理器實例
 */
let globalSupplyReminderManager: SupplyReminderManager | null = null;

/**
 * 獲取全局補給提醒管理器
 */
export function getSupplyReminderManager(): SupplyReminderManager {
  if (!globalSupplyReminderManager) {
    globalSupplyReminderManager = new SupplyReminderManager();
  }
  return globalSupplyReminderManager;
}
