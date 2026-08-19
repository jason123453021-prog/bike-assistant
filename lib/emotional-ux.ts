/**
 * 情感化 UX 模組 (Emotional UX Module)
 * 
 * 整合 Haptic 反饋和 TTS 語音提示
 * 提升騎乘體驗的情感化設計
 */

import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { reportRecoverableIssue } from '@/lib/release-safe-log';

export enum HapticType {
  LIGHT = 'light',
  MEDIUM = 'medium',
  HEAVY = 'heavy',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum VoiceType {
  MALE = 'male',
  FEMALE = 'female',
}

export interface EmotionalUXConfig {
  hapticEnabled?: boolean;
  ttsEnabled?: boolean;
  voiceType?: VoiceType;
  speechRate?: number;           // 0.5 - 2.0
  pitch?: number;                // 0.5 - 2.0
  language?: string;             // 'zh-TW', 'zh-CN', 'en'
}

export class EmotionalUXManager {
  private static config: EmotionalUXConfig;
  private static isSpeaking = false;

  /**
   * 初始化情感化 UX
   */
  static async initialize(config: EmotionalUXConfig = {}) {
    this.config = {
      hapticEnabled: true,
      ttsEnabled: true,
      voiceType: VoiceType.FEMALE,
      speechRate: 1.0,
      pitch: 1.0,
      language: 'zh-TW',
      ...config,
    };

    // 初始化語音合成
    if (this.config.ttsEnabled) {
      try {
        await Speech.speak('', { rate: 0 }); // 預熱 TTS
      } catch (error) {
        reportRecoverableIssue('TTS initialization failed', error);
      }
    }
  }

  /**
   * 觸發 Haptic 反饋
   */
  static async triggerHaptic(type: HapticType = HapticType.LIGHT): Promise<void> {
    if (!this.config.hapticEnabled || Platform.OS === 'web') {
      return;
    }

    try {
      switch (type) {
        case HapticType.LIGHT:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case HapticType.MEDIUM:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case HapticType.HEAVY:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case HapticType.SUCCESS:
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case HapticType.WARNING:
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case HapticType.ERROR:
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    } catch (error) {
      reportRecoverableIssue('Haptic feedback failed', error);
    }
  }

  /**
   * 觸發 TTS 語音提示
   */
  static async speakMessage(message: string, options?: { rate?: number; pitch?: number }): Promise<void> {
    if (!this.config.ttsEnabled || Platform.OS === 'web') {
      return;
    }

    // 避免重疊語音
    if (this.isSpeaking) {
      await Speech.stop();
    }

    try {
      this.isSpeaking = true;
      await Speech.speak(message, {
        language: this.config.language,
        rate: options?.rate ?? this.config.speechRate,
        pitch: options?.pitch ?? this.config.pitch,
        onDone: () => {
          this.isSpeaking = false;
        },
        onError: () => {
          this.isSpeaking = false;
        },
      });
    } catch (error) {
      reportRecoverableIssue('TTS speech failed', error);
      this.isSpeaking = false;
    }
  }

  /**
   * 停止 TTS 語音
   */
  static async stopSpeech(): Promise<void> {
    try {
      await Speech.stop();
      this.isSpeaking = false;
    } catch (error) {
      reportRecoverableIssue('Failed to stop speech', error);
    }
  }

  /**
   * 自動暫停事件反饋
   */
  static async onAutoPauseTriggered(reason: 'speed' | 'accelerometer'): Promise<void> {
    // Haptic 反饋
    await this.triggerHaptic(HapticType.MEDIUM);

    // TTS 語音提示
    const message = reason === 'speed' 
      ? '已自動暫停騎乘記錄' 
      : '檢測到低速爬坡，已自動暫停';
    
    await this.speakMessage(message);
  }

  /**
   * 騎乘恢復事件反饋
   */
  static async onRideResumed(): Promise<void> {
    // Haptic 反饋
    await this.triggerHaptic(HapticType.SUCCESS);

    // TTS 語音提示
    await this.speakMessage('騎乘已恢復');
  }

  /**
   * 低電量警告反饋
   */
  static async onLowBatteryWarning(batteryLevel: number): Promise<void> {
    // Haptic 反饋
    await this.triggerHaptic(HapticType.WARNING);

    // TTS 語音提示
    await this.speakMessage(`電量剩餘 ${batteryLevel}%，請及時充電`);
  }

  /**
   * 方向改變事件反饋
   */
  static async onHeadingChanged(direction: string): Promise<void> {
    // 輕微 Haptic 反饋
    await this.triggerHaptic(HapticType.LIGHT);

    // 可選：TTS 語音提示（如果需要）
    // await this.speakMessage(`向${direction}轉向`);
  }

  /**
   * 騎乘完成事件反饋
   */
  static async onRideCompleted(duration: number, distance: number): Promise<void> {
    // Haptic 反饋
    await this.triggerHaptic(HapticType.SUCCESS);

    // TTS 語音提示
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const distanceKm = (distance / 1000).toFixed(1);

    let message = '騎乘完成！';
    if (hours > 0) {
      message += `耗時 ${hours} 小時 ${minutes} 分鐘，`;
    } else if (minutes > 0) {
      message += `耗時 ${minutes} 分鐘，`;
    }
    message += `距離 ${distanceKm} 公里。`;

    await this.speakMessage(message);
  }

  /**
   * 設定 Haptic 啟用狀態
   */
  static setHapticEnabled(enabled: boolean): void {
    this.config.hapticEnabled = enabled;
  }

  /**
   * 設定 TTS 啟用狀態
   */
  static setTTSEnabled(enabled: boolean): void {
    this.config.ttsEnabled = enabled;
  }

  /**
   * 設定語言
   */
  static setLanguage(language: string): void {
    this.config.language = language;
  }

  /**
   * 獲取當前配置
   */
  static getConfig(): EmotionalUXConfig {
    return { ...this.config };
  }

  /**
   * 重置配置
   */
  static reset(): void {
    this.config = {};
    this.isSpeaking = false;
  }
}

/**
 * 使用示例：
 * 
 * // 初始化
 * await EmotionalUXManager.initialize({
 *   hapticEnabled: true,
 *   ttsEnabled: true,
 *   language: 'zh-TW',
 * });
 * 
 * // 自動暫停事件
 * await EmotionalUXManager.onAutoPauseTriggered('speed');
 * 
 * // 騎乘恢復事件
 * await EmotionalUXManager.onRideResumed();
 * 
 * // 低電量警告
 * await EmotionalUXManager.onLowBatteryWarning(20);
 * 
 * // 騎乘完成
 * await EmotionalUXManager.onRideCompleted(3600, 25000);
 */
