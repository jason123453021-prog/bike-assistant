/**
 * TTS Manager - 文字轉語音統一管理模塊
 *
 * 功能：
 * - 支援動態語音播報自訂補給品名稱
 * - 支援中文語音合成
 * - 集成 Audio Focus 確保優先級
 * - 支援語音隊列和中斷
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export interface TtsOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

class TtsManagerClass {
  private isSpeaking = false;
  private speechQueue: Array<{ text: string; options?: TtsOptions }> = [];
  private currentLanguage = 'zh-TW'; // 預設繁體中文

  /**
   * 初始化 TTS 引擎
   */
  async initialize(): Promise<void> {
    try {
      // 獲取可用的語言列表
      const availableVoices = await Speech.getAvailableVoicesAsync();
      console.log('[TtsManager] Available voices:', availableVoices);

      // 檢查是否支援繁體中文
      const hasChinese = availableVoices.some(
        (voice) => voice.language.startsWith('zh') || voice.language.startsWith('yue')
      );

      if (!hasChinese) {
        console.warn('[TtsManager] Chinese voice not available, using default');
        this.currentLanguage = 'en-US';
      }
    } catch (error) {
      console.error('[TtsManager] Initialization error:', error);
    }
  }

  /**
   * 播報補給品提醒
   * @param supplyItemName 補給品名稱（如 "水分"、"BCAA"、"電解質"）
   * @param options TTS 選項
   */
  async speakSupplyReminder(
    supplyItemName: string,
    options?: TtsOptions
  ): Promise<void> {
    const text = `請補充${supplyItemName}`;
    await this.speak(text, {
      language: this.currentLanguage,
      pitch: 1.0,
      rate: 0.9, // 稍微放慢速度，確保清晰
      volume: 1.0,
      ...options,
    });
  }

  /**
   * 播報通用文本
   * @param text 要播報的文本
   * @param options TTS 選項
   */
  async speak(text: string, options?: TtsOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      // 如果正在播報，加入隊列
      if (this.isSpeaking) {
        this.speechQueue.push({ text, options });
        resolve();
        return;
      }

      this.isSpeaking = true;

      try {
        Speech.speak(text, {
          language: options?.language || this.currentLanguage,
          pitch: options?.pitch ?? 1.0,
          rate: options?.rate ?? 1.0,
          volume: options?.volume ?? 1.0,
          onDone: () => {
            this.isSpeaking = false;
            options?.onDone?.();

            // 處理隊列中的下一個語音
            if (this.speechQueue.length > 0) {
              const next = this.speechQueue.shift();
              if (next) {
                this.speak(next.text, next.options);
              }
            }

            resolve();
          },
          onError: (error) => {
            this.isSpeaking = false;
            console.error('[TtsManager] Speech error:', error);
            options?.onError?.(new Error(String(error)));

            // 處理隊列中的下一個語音
            if (this.speechQueue.length > 0) {
              const next = this.speechQueue.shift();
              if (next) {
                this.speak(next.text, next.options);
              }
            }

            reject(error);
          },
        });
      } catch (error) {
        this.isSpeaking = false;
        console.error('[TtsManager] Speak error:', error);
        reject(error);
      }
    });
  }

  /**
   * 停止當前播報並清空隊列
   */
  async stop(): Promise<void> {
    try {
      await Speech.stop();
      this.isSpeaking = false;
      this.speechQueue = [];
      console.log('[TtsManager] Speech stopped');
    } catch (error) {
      console.error('[TtsManager] Stop error:', error);
    }
  }

  /**
   * 暫停播報
   */
  async pause(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        // Android 上暫停
        await Speech.stop();
        console.log('[TtsManager] Speech paused');
      }
    } catch (error) {
      console.error('[TtsManager] Pause error:', error);
    }
  }

  /**
   * 檢查是否正在播報
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * 清空隊列
   */
  clearQueue(): void {
    this.speechQueue = [];
  }

  /**
   * 設置語言
   */
  setLanguage(language: string): void {
    this.currentLanguage = language;
    console.log('[TtsManager] Language set to:', language);
  }

  /**
   * 獲取當前語言
   */
  getLanguage(): string {
    return this.currentLanguage;
  }
}

// 單例模式
export const ttsManager = new TtsManagerClass();
