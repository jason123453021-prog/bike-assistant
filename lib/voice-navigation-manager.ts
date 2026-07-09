import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export class VoiceNavigationManager {
  private static isSpeaking = false;
  private static voiceEnabled = true;

  /**
   * 初始化語音導航
   */
  static async initialize() {
    // 語音導航初始化
    this.voiceEnabled = true;
  }

  /**
   * 播放轉彎提示
   * @param instruction 轉彎指令文本
   */
  static async speakTurnInstruction(instruction: string) {
    if (!this.voiceEnabled || this.isSpeaking) return;

    try {
      this.isSpeaking = true;
      if (Platform.OS !== 'web') {
        await Speech.speak(instruction, {
          language: 'zh-TW',
          pitch: 1.0,
          rate: 0.9,
        });
      }
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      this.isSpeaking = false;
    }
  }

  /**
   * 播放偏離警告
   */
  static async speakOffRouteWarning() {
    if (!this.voiceEnabled || this.isSpeaking) return;

    try {
      this.isSpeaking = true;
      if (Platform.OS !== 'web') {
        await Speech.speak('您已偏離路線，請重新規劃路線', {
          language: 'zh-TW',
          pitch: 1.2,
          rate: 0.8,
        });
      }
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      this.isSpeaking = false;
    }
  }

  /**
   * 播放到達目的地提示
   */
  static async speakDestinationReached() {
    if (!this.voiceEnabled || this.isSpeaking) return;

    try {
      this.isSpeaking = true;
      if (Platform.OS !== 'web') {
        await Speech.speak('您已到達目的地', {
          language: 'zh-TW',
          pitch: 1.0,
          rate: 0.9,
        });
      }
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      this.isSpeaking = false;
    }
  }

  /**
   * 停止語音播放
   */
  static async stop() {
    try {
      if (Platform.OS !== 'web') {
        await Speech.stop();
      }
    } catch (error) {
      console.error('Failed to stop speech:', error);
    }
  }

  /**
   * 設置語音啟用狀態
   */
  static setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
  }

  /**
   * 獲取語音啟用狀態
   */
  static isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }
}
