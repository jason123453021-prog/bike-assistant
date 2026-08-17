// 動態導入 expo-brightness 以避免編譯錯誤
let setBrightnessAsync: (brightness: number) => Promise<void> = async () => {};
let getBrightnessAsync: () => Promise<number> = async () => 0.8;

try {
  const brightness = require('expo-brightness');
  setBrightnessAsync = brightness.setBrightnessAsync;
  getBrightnessAsync = brightness.getBrightnessAsync;
} catch (e) {
  console.warn('[PowerSaving] expo-brightness not available');
}
import { useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PowerSavingSettings {
  enabled: boolean;
  timeoutSeconds: number; // 進入省電模式的時間（秒）
  minBrightness: number; // 最低亮度（0-1）
  normalBrightness: number; // 正常亮度（0-1）
}

const DEFAULT_SETTINGS: PowerSavingSettings = {
  enabled: true,
  timeoutSeconds: 300, // 5 分鐘
  minBrightness: 0.1,
  normalBrightness: 0.8,
};

const STORAGE_KEY = 'power_saving_settings';

export class SmartPowerSavingManager {
  private static instance: SmartPowerSavingManager;
  private settings: PowerSavingSettings = DEFAULT_SETTINGS;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private isInPowerSavingMode: boolean = false;
  private originalBrightness: number = 0.8;
  private brightnessSession = 0;
  private brightnessHolds = new Set<string>();
  private listeners: Set<(isActive: boolean) => void> = new Set();

  private constructor() {
    this.loadSettings();
  }

  static getInstance(): SmartPowerSavingManager {
    if (!SmartPowerSavingManager.instance) {
      SmartPowerSavingManager.instance = new SmartPowerSavingManager();
    }
    return SmartPowerSavingManager.instance;
  }

  async loadSettings(): Promise<PowerSavingSettings> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[PowerSaving] Failed to load settings:', error);
    }
    return this.settings;
  }

  async saveSettings(newSettings: Partial<PowerSavingSettings>) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('[PowerSaving] Failed to save settings:', error);
    }
  }

  getSettings(): PowerSavingSettings {
    return this.settings;
  }

  private resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    if (!this.settings.enabled || this.brightnessHolds.size > 0) return;

    this.inactivityTimer = setTimeout(() => {
      this.enterPowerSavingMode();
    }, this.settings.timeoutSeconds * 1000);
  }

  private async enterPowerSavingMode() {
    if (this.isInPowerSavingMode) return;
    const session = ++this.brightnessSession;
    this.isInPowerSavingMode = true;
    try {
      this.originalBrightness = await getBrightnessAsync();
      // 若手勢或補給彈窗在讀取亮度期間已喚醒，不能再把螢幕調暗。
      if (!this.isInPowerSavingMode || session !== this.brightnessSession) return;
      await setBrightnessAsync(this.settings.minBrightness);
      this.notifyListeners(true);
      console.log('[PowerSaving] Entered power saving mode');
    } catch (error) {
      console.error('[PowerSaving] Failed to enter power saving mode:', error);
    }
  }

  private async exitPowerSavingMode() {
    if (!this.isInPowerSavingMode) return;
    ++this.brightnessSession;
    this.isInPowerSavingMode = false;
    this.notifyListeners(false);
    try {
      await setBrightnessAsync(this.originalBrightness);
      console.log('[PowerSaving] Exited power saving mode');
    } catch (error) {
      console.error('[PowerSaving] Failed to exit power saving mode:', error);
    }
  }

  async wakeUp() {
    await this.exitPowerSavingMode();
    this.resetInactivityTimer();
  }

  /** 保持亮屏並暫停調暗計時；多個流程可各自持有。 */
  async holdBrightness(key: string) {
    this.brightnessHolds.add(key);
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    await this.exitPowerSavingMode();
  }

  /** 只有最後一個亮屏保持解除後，才重新開始調暗倒數。 */
  releaseBrightnessHold(key: string) {
    this.brightnessHolds.delete(key);
    if (this.brightnessHolds.size === 0) this.resetInactivityTimer();
  }

  onUserInteraction() {
    this.wakeUp();
  }

  onTurnGuidance() {
    this.wakeUp();
  }

  onSupplyReminder() {
    this.wakeUp();
  }

  subscribe(listener: (isActive: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(isActive: boolean) {
    this.listeners.forEach(listener => listener(isActive));
  }

  start() {
    if (!this.settings.enabled) return;
    this.resetInactivityTimer();
  }

  stop() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    this.brightnessHolds.clear();
    this.exitPowerSavingMode();
  }
}

export function useSmartPowerSaving() {
  const manager = SmartPowerSavingManager.getInstance();
  const isInPowerSavingMode = useRef(false);

  useEffect(() => {
    const unsubscribe = manager.subscribe((isActive) => {
      isInPowerSavingMode.current = isActive;
    });

    manager.start();

    return () => {
      unsubscribe();
      manager.stop();
    };
  }, []);

  return {
    manager,
    isInPowerSavingMode: isInPowerSavingMode.current,
    wakeUp: () => manager.wakeUp(),
    onUserInteraction: () => manager.onUserInteraction(),
    onTurnGuidance: () => manager.onTurnGuidance(),
    onSupplyReminder: () => manager.onSupplyReminder(),
  };
}
