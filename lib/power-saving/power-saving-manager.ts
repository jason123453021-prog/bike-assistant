/**
 * 智慧省電模式管理模組
 * 自動調暗螢幕、多重即時喚醒機制
 */

// 注意：expo-brightness 在某些環境下可能不可用
// 使用 try-catch 進行防禦性導入
let Brightness: any = null;
try {
  Brightness = require('expo-brightness');
} catch (e) {
  console.warn('expo-brightness 不可用，省電模式功能將被禁用');
}

export interface PowerSavingConfig {
  enabled: boolean;
  idleTimeSeconds: number; // 進入省電模式的時間（秒）
  minBrightness: number; // 最低亮度（0-1）
  normalBrightness: number; // 正常亮度（0-1）
  autoResetIdleTime: boolean; // 喚醒後是否重新計時
}

export interface PowerSavingState {
  isActive: boolean;
  idleStartTime: number | null;
  lastInteractionTime: number;
  currentBrightness: number;
  originalBrightness: number;
}

/**
 * 智慧省電模式管理器
 */
export class PowerSavingManager {
  private config: PowerSavingConfig;
  private state: PowerSavingState;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private onActivateCallback: (() => void) | null = null;
  private onDeactivateCallback: (() => void) | null = null;

  constructor(config: Partial<PowerSavingConfig> = {}) {
    this.config = {
      enabled: false,
      idleTimeSeconds: 30,
      minBrightness: 0.1,
      normalBrightness: 1.0,
      autoResetIdleTime: true,
      ...config,
    };

    this.state = {
      isActive: false,
      idleStartTime: null,
      lastInteractionTime: Date.now(),
      currentBrightness: 1.0,
      originalBrightness: 1.0,
    };
  }

  /**
   * 啟用省電模式
   */
  async enable(): Promise<void> {
    this.config.enabled = true;
    this.startIdleMonitoring();
    console.log('[PowerSaving] Mode enabled');
  }

  /**
   * 禁用省電模式
   */
  async disable(): Promise<void> {
    this.config.enabled = false;
    this.stopIdleMonitoring();
    await this.restoreBrightness();
    console.log('[PowerSaving] Mode disabled');
  }

  /**
   * 設置空閒時間
   */
  setIdleTime(seconds: number): void {
    this.config.idleTimeSeconds = Math.max(10, seconds);
  }

  /**
   * 記錄用戶交互
   */
  async recordInteraction(): Promise<void> {
    this.state.lastInteractionTime = Date.now();

    // 如果已進入省電模式，則喚醒
    if (this.state.isActive) {
      await this.deactivate();
    }

    // 重置空閒計時
    if (this.config.autoResetIdleTime) {
      this.state.idleStartTime = null;
    }
  }

  /**
   * 觸發轉彎提醒時喚醒
   */
  async wakeUpForTurnReminder(): Promise<void> {
    if (this.state.isActive) {
      await this.deactivate();
    }
    this.state.lastInteractionTime = Date.now();
  }

  /**
   * 觸發補給提醒時喚醒
   */
  async wakeUpForSupplyReminder(): Promise<void> {
    if (this.state.isActive) {
      await this.deactivate();
    }
    this.state.lastInteractionTime = Date.now();
  }

  /**
   * 啟動空閒監控
   */
  private startIdleMonitoring(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
    }

    this.idleTimer = setInterval(async () => {
      if (!this.config.enabled) return;

      const idleTime = (Date.now() - this.state.lastInteractionTime) / 1000;

      if (idleTime >= this.config.idleTimeSeconds && !this.state.isActive) {
        await this.activate();
      }
    }, 1000); // 每秒檢查一次
  }

  /**
   * 停止空閒監控
   */
  private stopIdleMonitoring(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * 啟動省電模式（調暗螢幕）
   */
  private async activate(): Promise<void> {
    try {
      // 檢查 Brightness 模組是否可用
      if (!Brightness || !Brightness.getBrightnessAsync) {
        console.warn('[PowerSaving] Brightness module not available');
        return;
      }

      // 保存當前亮度
      const currentBrightness = await Brightness.getBrightnessAsync();
      this.state.originalBrightness = currentBrightness;

      // 調暗螢幕
      await Brightness.setBrightnessAsync(this.config.minBrightness);
      this.state.currentBrightness = this.config.minBrightness;

      this.state.isActive = true;
      this.state.idleStartTime = Date.now();

      if (this.onActivateCallback) {
        this.onActivateCallback();
      }

      console.log('[PowerSaving] Activated - brightness set to', this.config.minBrightness);
    } catch (error) {
      console.error('[PowerSaving] Error activating:', error);
    }
  }

  /**
   * 退出省電模式（恢復亮度）
   */
  private async deactivate(): Promise<void> {
    try {
      await this.restoreBrightness();
      this.state.isActive = false;
      this.state.idleStartTime = null;

      if (this.onDeactivateCallback) {
        this.onDeactivateCallback();
      }

      console.log('[PowerSaving] Deactivated - brightness restored');
    } catch (error) {
      console.error('[PowerSaving] Error deactivating:', error);
    }
  }

  /**
   * 恢復亮度
   */
  private async restoreBrightness(): Promise<void> {
    try {
      if (!Brightness || !Brightness.setBrightnessAsync) {
        console.warn('[PowerSaving] Brightness module not available');
        return;
      }
      await Brightness.setBrightnessAsync(this.state.originalBrightness);
      this.state.currentBrightness = this.state.originalBrightness;
    } catch (error) {
      console.error('[PowerSaving] Error restoring brightness:', error);
    }
  }

  /**
   * 手動進入省電模式
   */
  async manualActivate(): Promise<void> {
    await this.activate();
  }

  /**
   * 手動退出省電模式
   */
  async manualDeactivate(): Promise<void> {
    await this.deactivate();
  }

  /**
   * 獲取當前狀態
   */
  getState(): PowerSavingState {
    return { ...this.state };
  }

  /**
   * 獲取配置
   */
  getConfig(): PowerSavingConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<PowerSavingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 獲取空閒時間（秒）
   */
  getIdleTime(): number {
    return (Date.now() - this.state.lastInteractionTime) / 1000;
  }

  /**
   * 設置啟動回調
   */
  setOnActivateCallback(callback: () => void): void {
    this.onActivateCallback = callback;
  }

  /**
   * 設置停用回調
   */
  setOnDeactivateCallback(callback: () => void): void {
    this.onDeactivateCallback = callback;
  }

  /**
   * 重置管理器
   */
  async reset(): Promise<void> {
    this.stopIdleMonitoring();
    await this.restoreBrightness();
    this.state = {
      isActive: false,
      idleStartTime: null,
      lastInteractionTime: Date.now(),
      currentBrightness: 1.0,
      originalBrightness: 1.0,
    };
  }

  /**
   * 銷毀管理器
   */
  async destroy(): Promise<void> {
    await this.disable();
    await this.reset();
  }
}

/**
 * 全局省電模式管理器實例
 */
let globalPowerSavingManager: PowerSavingManager | null = null;

/**
 * 獲取全局省電模式管理器
 */
export function getPowerSavingManager(
  config?: Partial<PowerSavingConfig>
): PowerSavingManager {
  if (!globalPowerSavingManager) {
    globalPowerSavingManager = new PowerSavingManager(config);
  }
  return globalPowerSavingManager;
}

/**
 * 屏幕亮度調整工具函數
 */
export async function setScreenBrightness(brightness: number): Promise<void> {
  try {
    const normalizedBrightness = Math.max(0, Math.min(1, brightness));
    await Brightness.setBrightnessAsync(normalizedBrightness);
  } catch (error) {
    console.error('[Brightness] Error setting brightness:', error);
  }
}

/**
 * 獲取當前屏幕亮度
 */
export async function getScreenBrightness(): Promise<number> {
  try {
    return await Brightness.getBrightnessAsync();
  } catch (error) {
    console.error('[Brightness] Error getting brightness:', error);
    return 1.0;
  }
}

/**
 * 自動調整亮度（基於環境光線）
 */
export async function autoAdjustBrightness(
  minBrightness: number = 0.1,
  maxBrightness: number = 1.0
): Promise<void> {
  try {
    // 這裡可以集成環境光線傳感器數據
    // 目前簡化為固定值
    const brightness = (minBrightness + maxBrightness) / 2;
    await Brightness.setBrightnessAsync(brightness);
  } catch (error) {
    console.error('[Brightness] Error auto-adjusting:', error);
  }
}
