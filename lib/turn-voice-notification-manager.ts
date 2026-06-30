import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export type Language = 'zh-TW' | 'en-US';

export interface VoiceConfig {
  language: Language;
  rate: number; // 0.5-2.0，預設 1.0
  pitch: number; // 0.5-2.0，預設 1.0
  volume: number; // 0.0-1.0，預設 1.0
  enabled: boolean;
  silenceMode: boolean; // 靜音模式
  repeatCount: number; // 重複播放次數
}

export interface TurnNotification {
  id: string;
  type: 'approaching' | 'immediate' | 'passed';
  turnType: string;
  distance: number; // 距離（米）
  instruction: string;
  voiceText: string;
  timestamp: number;
}

const DEFAULT_CONFIG: VoiceConfig = {
  language: 'zh-TW',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  enabled: true,
  silenceMode: false,
  repeatCount: 1,
};

const APPROACHING_DISTANCE = 300; // 300 米時開始提醒
const IMMEDIATE_DISTANCE = 50; // 50 米時立即提醒

/**
 * 轉向導航語音提示管理器
 * 功能：
 * - 根據距離自動播放語音提示
 * - 支援多語言
 * - 可配置語音速率、音量、重複次數
 * - 靜音模式支援
 * - 語音播放狀態追蹤
 */
export class TurnVoiceNotificationManager {
  private config: VoiceConfig = { ...DEFAULT_CONFIG };
  private lastNotificationId: string | null = null;
  private isSpeaking = false;
  private listeners: Set<(notification: TurnNotification) => void> = new Set();
  private notificationQueue: TurnNotification[] = [];

  constructor(config?: Partial<VoiceConfig>) {
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }
  }

  /**
   * 初始化語音引擎
   */
  async initialize(): Promise<void> {
    try {
      // 檢查語音支援
      const available = await Speech.isSpeakingAsync();
      console.log('[TurnVoiceNotificationManager] Speech engine available:', !available);
      // 語言設置在 speak() 方法中指定

      console.log('[TurnVoiceNotificationManager] Initialized');
    } catch (error) {
      console.error('[TurnVoiceNotificationManager] Initialization error:', error);
    }
  }

  /**
   * 訂閱語音通知事件
   */
  subscribe(listener: (notification: TurnNotification) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[TurnVoiceNotificationManager] Config updated:', this.config);
  }

  /**
   * 檢查並播放轉向提示
   */
  async checkAndPlayTurnNotification(
    distance: number,
    turnType: string,
    instruction: string,
    voiceText: string
  ): Promise<void> {
    try {
      // 如果禁用或靜音模式，跳過播放
      if (!this.config.enabled || this.config.silenceMode) {
        return;
      }

      // 判斷通知類型
      let notificationType: 'approaching' | 'immediate' | 'passed';
      let shouldPlay = false;

      if (distance <= IMMEDIATE_DISTANCE) {
        notificationType = 'immediate';
        shouldPlay = true;
      } else if (distance <= APPROACHING_DISTANCE) {
        notificationType = 'approaching';
        // 只在第一次接近時播放
        shouldPlay = this.lastNotificationId !== `${turnType}-approaching`;
      } else {
        return; // 距離太遠，不播放
      }

      if (!shouldPlay) {
        return;
      }

      const notification: TurnNotification = {
        id: `${turnType}-${notificationType}`,
        type: notificationType,
        turnType,
        distance,
        instruction,
        voiceText,
        timestamp: Date.now(),
      };

      // 播放語音
      await this.playVoice(voiceText);

      // 記錄最後通知
      this.lastNotificationId = notification.id;

      // 通知監聽者
      this.notifyListeners(notification);
    } catch (error) {
      console.error('[TurnVoiceNotificationManager] Error playing notification:', error);
    }
  }

  /**
   * 播放語音
   */
  private async playVoice(text: string): Promise<void> {
    try {
      // 檢查是否已在播放
      if (this.isSpeaking) {
        console.log('[TurnVoiceNotificationManager] Already speaking, queuing...');
        this.notificationQueue.push({
          id: `queued-${Date.now()}`,
          type: 'approaching',
          turnType: 'queued',
          distance: 0,
          instruction: text,
          voiceText: text,
          timestamp: Date.now(),
        });
        return;
      }

      this.isSpeaking = true;
      console.log('[TurnVoiceNotificationManager] Playing voice:', text);

      // 播放語音
      for (let i = 0; i < this.config.repeatCount; i++) {
        await Speech.speak(text, {
          language: this.config.language,
          rate: this.config.rate,
          pitch: this.config.pitch,
          volume: this.config.volume,
          onDone: () => {
            console.log('[TurnVoiceNotificationManager] Voice playback done');
          },
          onError: (error) => {
            console.error('[TurnVoiceNotificationManager] Voice playback error:', error);
          },
        });

        // 等待播放完成
        await this.waitForSpeechComplete();

        // 重複播放時添加間隔
        if (i < this.config.repeatCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      this.isSpeaking = false;

      // 處理隊列中的下一個通知
      if (this.notificationQueue.length > 0) {
        const next = this.notificationQueue.shift();
        if (next) {
          await this.playVoice(next.voiceText);
        }
      }
    } catch (error) {
      this.isSpeaking = false;
      console.error('[TurnVoiceNotificationManager] Error in playVoice:', error);
    }
  }

  /**
   * 等待語音播放完成
   */
  private waitForSpeechComplete(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const isSpeaking = await Speech.isSpeakingAsync();
        if (!isSpeaking) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // 超時保護（最多等待 30 秒）
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000);
    });
  }

  /**
   * 停止語音播放
   */
  async stop(): Promise<void> {
    try {
      await Speech.stop();
      this.isSpeaking = false;
      this.notificationQueue = [];
      console.log('[TurnVoiceNotificationManager] Stopped');
    } catch (error) {
      console.error('[TurnVoiceNotificationManager] Error stopping:', error);
    }
  }

  /**
   * 重置通知狀態
   */
  reset(): void {
    this.lastNotificationId = null;
    this.notificationQueue = [];
    console.log('[TurnVoiceNotificationManager] Reset');
  }

  /**
   * 獲取當前配置
   */
  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  /**
   * 獲取語音播放狀態
   */
  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  /**
   * 測試語音播放
   */
  async testVoice(): Promise<void> {
    const testText = this.config.language === 'zh-TW' ? '語音測試' : 'Voice test';
    await this.playVoice(testText);
  }

  /**
   * 通知所有監聽者
   */
  private notifyListeners(notification: TurnNotification): void {
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch (error) {
        console.error('[TurnVoiceNotificationManager] Error in listener:', error);
      }
    }
  }

  /**
   * 清理資源
   */
  async destroy(): Promise<void> {
    await this.stop();
    this.listeners.clear();
    console.log('[TurnVoiceNotificationManager] Destroyed');
  }
}

// 全局單例
let managerInstance: TurnVoiceNotificationManager | null = null;

export function getTurnVoiceNotificationManager(
  config?: Partial<VoiceConfig>
): TurnVoiceNotificationManager {
  if (!managerInstance) {
    managerInstance = new TurnVoiceNotificationManager(config);
  }
  return managerInstance;
}
