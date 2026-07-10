import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * 語音導航與節能模式管理器
 * 
 * 功能：
 * - 逐向語音導航（播報轉彎、盲區、危險路段）
 * - 中文語音播報
 * - 智慧節能模式（長直路自動變暗螢幕）
 */

export interface VoiceNavigationConfig {
  enabled: boolean; // 是否啟用語音導航
  language: string; // 語言代碼（zh-TW 或 zh-CN）
  rate: number; // 播報速率（0.5-2.0）
  pitch: number; // 音調（0.5-2.0）
  enableBatteryWarning: boolean; // 是否啟用電量警告
  enableKeyControl: boolean; // 是否啟用按鍵控制
}

export interface PowerSavingConfig {
  enabled: boolean; // 是否啟用節能模式
  mode: 'auto' | 'manual' | 'off'; // 自動/手動/關閉
  straightThreshold: number; // 直路判定閾值（度數，推薦 15）
  screenDimLevel: number; // 螢幕變暗程度（0-1，推薦 0.3）
  dimDuration: number; // 變暗持續時間（毫秒）
}

class VoiceNavigationManager {
  private config: VoiceNavigationConfig = {
    enabled: true,
    language: 'zh-TW',
    rate: 1.0,
    pitch: 1.0,
    enableBatteryWarning: false, // 預設關閉電量警告
    enableKeyControl: true, // 預設啟用按鍵控制
  };

  private isSpeaking = false;
  private speechQueue: string[] = [];

  constructor(config?: Partial<VoiceNavigationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VoiceNavigationConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 播報導航指令
   */
  async speakInstruction(instruction: string) {
    if (!this.config.enabled) {
      return;
    }

    // 如果正在播報，加入隊列
    if (this.isSpeaking) {
      this.speechQueue.push(instruction);
      return;
    }

    try {
      this.isSpeaking = true;
      await Speech.speak(instruction, {
        language: this.config.language,
        rate: this.config.rate,
        pitch: this.config.pitch,
        onDone: () => {
          this.isSpeaking = false;
          // 處理隊列中的下一條指令
          if (this.speechQueue.length > 0) {
            const nextInstruction = this.speechQueue.shift();
            if (nextInstruction) {
              this.speakInstruction(nextInstruction);
            }
          }
        },
        onError: (error) => {
          console.error('Speech error:', error);
          this.isSpeaking = false;
        },
      });
    } catch (error) {
      console.error('Speak error:', error);
      this.isSpeaking = false;
    }
  }

  /**
   * 播報轉彎指令
   */
  async speakTurn(direction: 'left' | 'right' | 'straight' | 'uturn', distance: number) {
    const directionText = {
      left: '左轉',
      right: '右轉',
      straight: '直行',
      uturn: 'U 轉',
    }[direction];

    const distanceText = distance < 1000 ? `${Math.round(distance)} 公尺` : `${(distance / 1000).toFixed(1)} 公里`;
    const instruction = `即將${directionText}，距離${distanceText}`;

    await this.speakInstruction(instruction);
  }

  /**
   * 播報危險警告
   */
  async speakWarning(warningType: string, details?: string) {
    // 跳過電量警告
    if (warningType === 'battery' && !this.config.enableBatteryWarning) {
      return;
    }

    const warnings: Record<string, string> = {
      steep: '前方陰坑，請小心',
      intersection: '前方十字路口，請注意安全',
      traffic: '前方車流較多，請謹慎騎乘',
      construction: '前方施工區域，請繞行',
      lowVisibility: '能見度較低，請開啟車燈',
      battery: '電量不足',
    };

    const instruction = `警告：${warnings[warningType] || '請注意安全'}${details ? `，${details}` : ''}`;
    await this.speakInstruction(instruction);
  }



  /**
   * 播報到達目的地
   */
  async speakArrival() {
    await this.speakInstruction('已到達目的地');
  }

  /**
   * 停止播報
   */
  async stop() {
    try {
      await Speech.stop();
      this.isSpeaking = false;
      this.speechQueue = [];
    } catch (error) {
      console.error('Stop speech error:', error);
    }
  }

  /**
   * 檢查是否正在播報
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

class PowerSavingManager {
  private config: PowerSavingConfig = {
    enabled: true,
    mode: 'auto',
    straightThreshold: 15,
    screenDimLevel: 0.3,
    dimDuration: 5000,
  };

  private dimTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentScreenBrightness = 1.0;

  constructor(config?: Partial<PowerSavingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PowerSavingConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 檢查是否為直路
   * @param bearing1 當前方向角
   * @param bearing2 下一個方向角
   * @returns 是否為直路
   */
  isStraightPath(bearing1: number, bearing2: number): boolean {
    const diff = Math.abs(bearing1 - bearing2);
    const normalizedDiff = Math.min(diff, 360 - diff);
    return normalizedDiff < this.config.straightThreshold;
  }

  /**
   * 應用節能模式
   * @param isStraight 是否為直路
   */
  applySavingMode(isStraight: boolean) {
    if (!this.config.enabled || this.config.mode === 'off') {
      this.restoreScreenBrightness();
      return;
    }

    if (this.config.mode === 'auto' && isStraight) {
      this.dimScreen();
    } else if (this.config.mode === 'manual') {
      // 手動模式由用戶控制
      this.dimScreen();
    } else {
      this.restoreScreenBrightness();
    }
  }

  /**
   * 變暗螢幕
   */
  private dimScreen() {
    // 清除之前的超時
    if (this.dimTimeout) {
      clearTimeout(this.dimTimeout);
    }

    this.currentScreenBrightness = this.config.screenDimLevel;

    // 在指定時間後恢復亮度
    this.dimTimeout = setTimeout(() => {
      this.restoreScreenBrightness();
    }, this.config.dimDuration);
  }

  /**
   * 恢復螢幕亮度
   */
  private restoreScreenBrightness() {
    if (this.dimTimeout) {
      clearTimeout(this.dimTimeout);
      this.dimTimeout = null;
    }

    this.currentScreenBrightness = 1.0;
  }

  /**
   * 獲取當前螢幕亮度
   */
  getScreenBrightness(): number {
    return this.currentScreenBrightness;
  }

  /**
   * 手動設置螢幕亮度
   */
  setScreenBrightness(brightness: number) {
    this.currentScreenBrightness = Math.max(0, Math.min(1, brightness));
  }

  /**
   * 清理資源
   */
  cleanup() {
    if (this.dimTimeout) {
      clearTimeout(this.dimTimeout);
      this.dimTimeout = null;
    }
    this.restoreScreenBrightness();
  }
}

// 導出單例
export const voiceNavigationManager = new VoiceNavigationManager();
export const powerSavingManager = new PowerSavingManager();
