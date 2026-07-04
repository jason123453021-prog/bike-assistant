import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

interface SpeechOptions {
  rate?: number; // 語速 (0.5 - 2.0)
  pitch?: number; // 音調 (0.5 - 2.0)
  volume?: number; // 音量 (0 - 1)
}

export class SpeechService {
  private static isSpeaking = false;
  private static speechQueue: string[] = [];

  /**
   * 初始化語音服務
   * 設置音頻模式以支援背景播放和鎖屏播放
   */
  static async initialize(): Promise<void> {
    try {
      // 語言設置將在 speak 方法中進行
      console.log('Speech Service Initialized');
    } catch (error) {
      console.error('Speech Service Initialization Error:', error);
    }
  }

  /**
   * 播報文本
   * 支援隊列機制，確保多個播報請求不會互相干擾
   * @param text 要播報的文本
   * @param options 播報選項
   */
  static async speak(text: string, options?: SpeechOptions): Promise<void> {
    if (!text || text.trim().length === 0) {
      console.warn('SpeechService: Empty text provided');
      return;
    }

    // 將文本加入隊列
    SpeechService.speechQueue.push(text);

    // 如果已經在播報，則等待當前播報完成
    if (SpeechService.isSpeaking) {
      return;
    }

    // 處理隊列中的第一個文本
    await SpeechService.processQueue(options);
  }

  /**
   * 處理播報隊列
   * @param options 播報選項
   */
  private static async processQueue(options?: SpeechOptions): Promise<void> {
    while (SpeechService.speechQueue.length > 0) {
      const text = SpeechService.speechQueue.shift();
      if (!text) continue;

      SpeechService.isSpeaking = true;

      try {
        await Speech.speak(text, {
          language: 'zh-TW',
          rate: options?.rate ?? 1.0,
          pitch: options?.pitch ?? 1.0,
          volume: options?.volume ?? 1.0,
          onDone: () => {
            SpeechService.isSpeaking = false;
            // 繼續處理隊列中的下一個文本
            if (SpeechService.speechQueue.length > 0) {
              SpeechService.processQueue(options);
            }
          },
          onError: (error) => {
            console.error('Speech Error:', error);
            SpeechService.isSpeaking = false;
            // 繼續處理隊列中的下一個文本
            if (SpeechService.speechQueue.length > 0) {
              SpeechService.processQueue(options);
            }
          },
        });
      } catch (error) {
        console.error('Speech Service Error:', error);
        SpeechService.isSpeaking = false;
      }
    }
  }

  /**
   * 停止當前播報
   */
  static async stop(): Promise<void> {
    try {
      await Speech.stop();
      SpeechService.isSpeaking = false;
      SpeechService.speechQueue = [];
    } catch (error) {
      console.error('Speech Stop Error:', error);
    }
  }

  /**
   * 清空播報隊列
   */
  static clearQueue(): void {
    SpeechService.speechQueue = [];
  }

  /**
   * 獲取當前是否正在播報
   */
  static getIsSpeaking(): boolean {
    return SpeechService.isSpeaking;
  }

  /**
   * 獲取隊列中待播報的文本數量
   */
  static getQueueLength(): number {
    return SpeechService.speechQueue.length;
  }

  /**
   * 播報轉彎指令
   * @param direction 轉向方向 ('left' | 'right' | 'straight')
   * @param distance 距離轉彎點的距離（米）
   */
  static async speakTurnInstruction(direction: 'left' | 'right' | 'straight', distance: number): Promise<void> {
    let directionText = '';
    if (direction === 'left') {
      directionText = '向左轉';
    } else if (direction === 'right') {
      directionText = '向右轉';
    } else {
      directionText = '直行';
    }

    const text = `前方 ${Math.round(distance)} 公尺，${directionText}`;
    await SpeechService.speak(text, { rate: 1.0, volume: 1.0 });
  }

  /**
   * 播報補給提醒
   * @param supplementName 補給品名稱
   */
  static async speakSupplementReminder(supplementName: string): Promise<void> {
    const text = `該補給了，請補充${supplementName}`;
    await SpeechService.speak(text, { rate: 1.0, volume: 1.0 });
  }

  /**
   * 播報偏離路線提醒
   */
  static async speakOffRouteWarning(): Promise<void> {
    const text = '您已偏離路線，正在重新規劃路線';
    await SpeechService.speak(text, { rate: 1.0, volume: 1.0 });
  }

  /**
   * 播報路線重規劃完成
   */
  static async speakRerouteComplete(): Promise<void> {
    const text = '新路線已規劃完成';
    await SpeechService.speak(text, { rate: 1.0, volume: 1.0 });
  }

  /**
   * 播報騎乘開始
   */
  static async speakRideStart(): Promise<void> {
    const text = '開始騎乘，祝您騎乘愉快';
    await SpeechService.speak(text, { rate: 1.0, volume: 1.0 });
  }

  /**
   * 播報騎乘結束
   */
  static async speakRideEnd(): Promise<void> {
    const text = '騎乘結束，感謝您使用本應用';
    await SpeechService.speak(text, { rate: 1.0, volume: 1.0 });
  }
}
