/**
 * 智慧省電模式管理
 * 
 * 功能：
 * 1. 自動調暗螢幕
 * 2. 多重喚醒時機
 * 3. 無操作計時器
 */

export interface PowerSavingConfig {
  enabled: boolean;
  timeoutSeconds: number; // 進入省電模式時間
  minBrightness: number; // 最低亮度（0-1）
  normalBrightness: number; // 正常亮度（0-1）
}

export interface PowerSavingState {
  isActive: boolean;
  lastActivityTime: number;
  brightness: number;
  config: PowerSavingConfig;
}

const DEFAULT_CONFIG: PowerSavingConfig = {
  enabled: true,
  timeoutSeconds: 60, // 60 秒無操作進入省電
  minBrightness: 0.1,
  normalBrightness: 0.8,
};

/**
 * 創建默認的省電模式狀態
 */
export function createDefaultPowerSavingState(): PowerSavingState {
  return {
    isActive: false,
    lastActivityTime: Date.now(),
    brightness: DEFAULT_CONFIG.normalBrightness,
    config: { ...DEFAULT_CONFIG },
  };
}

/**
 * 更新配置
 */
export function updatePowerSavingConfig(
  state: PowerSavingState,
  config: Partial<PowerSavingConfig>
): PowerSavingState {
  return {
    ...state,
    config: { ...state.config, ...config },
  };
}

/**
 * 記錄用戶活動
 */
export function recordUserActivity(state: PowerSavingState): PowerSavingState {
  return {
    ...state,
    lastActivityTime: Date.now(),
  };
}

/**
 * 檢查是否應進入省電模式
 */
export function checkPowerSavingTrigger(state: PowerSavingState): boolean {
  if (!state.config.enabled) {
    return false;
  }

  const elapsedSeconds = (Date.now() - state.lastActivityTime) / 1000;
  return elapsedSeconds >= state.config.timeoutSeconds;
}

/**
 * 進入省電模式
 */
export function enterPowerSavingMode(state: PowerSavingState): PowerSavingState {
  return {
    ...state,
    isActive: true,
    brightness: state.config.minBrightness,
  };
}

/**
 * 退出省電模式
 */
export function exitPowerSavingMode(state: PowerSavingState): PowerSavingState {
  return {
    ...state,
    isActive: false,
    lastActivityTime: Date.now(),
    brightness: state.config.normalBrightness,
  };
}

/**
 * 喚醒時機：觸屏
 */
export function onScreenTouch(state: PowerSavingState): PowerSavingState {
  if (state.isActive) {
    return exitPowerSavingMode(state);
  }
  return recordUserActivity(state);
}

/**
 * 喚醒時機：轉彎提醒
 */
export function onTurnReminder(state: PowerSavingState): PowerSavingState {
  if (state.isActive) {
    return exitPowerSavingMode(state);
  }
  return state;
}

/**
 * 喚醒時機：補給提醒
 */
export function onSupplyReminder(state: PowerSavingState): PowerSavingState {
  if (state.isActive) {
    return exitPowerSavingMode(state);
  }
  return state;
}

/**
 * 獲取當前亮度
 */
export function getCurrentBrightness(state: PowerSavingState): number {
  return state.brightness;
}

/**
 * 獲取剩餘時間（秒）
 */
export function getRemainingTimeBeforePowerSaving(state: PowerSavingState): number {
  if (!state.config.enabled) {
    return -1;
  }

  const elapsedSeconds = (Date.now() - state.lastActivityTime) / 1000;
  const remaining = Math.max(0, state.config.timeoutSeconds - elapsedSeconds);
  return Math.round(remaining);
}

/**
 * 判斷是否在省電模式
 */
export function isPowerSavingActive(state: PowerSavingState): boolean {
  return state.isActive;
}

/**
 * 切換省電模式開關
 */
export function togglePowerSaving(state: PowerSavingState): PowerSavingState {
  return {
    ...state,
    config: { ...state.config, enabled: !state.config.enabled },
    isActive: false, // 切換時退出省電模式
  };
}
