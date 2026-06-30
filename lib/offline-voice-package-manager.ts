import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

export interface VoicePackage {
  id: string;
  language: string;
  name: string;
  version: string;
  size: number;
  downloadUrl: string;
  timestamp: number;
  isDownloaded: boolean;
}

export interface VoicePhrase {
  key: string;
  text: string;
  language: string;
  audioPath?: string;
}

const VOICE_CACHE_DIR = `${FileSystem.documentDirectory}offline-voices/`;
const VOICE_METADATA_KEY = 'offline_voice_packages';
const MAX_VOICE_CACHE_SIZE = 200 * 1024 * 1024; // 200 MB

/**
 * 離線語音包管理器
 * 功能：
 * - 語音包下載和管理
 * - 本地語音播放
 * - 語音快取策略
 * - 多語言支援
 */
export class OfflineVoicePackageManager {
  private packages: Map<string, VoicePackage> = new Map();
  private isPlaying: boolean = false;

  /**
   * 初始化語音包管理器
   */
  async initialize(): Promise<void> {
    try {
      // 創建語音快取目錄
      const dirInfo = await FileSystem.getInfoAsync(VOICE_CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(VOICE_CACHE_DIR, { intermediates: true });
      }

      // 加載元數據
      await this.loadMetadata();

      console.log('[OfflineVoicePackageManager] Initialized');
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Initialization error:', error);
      throw error;
    }
  }

  /**
   * 下載語音包
   */
  async downloadVoicePackage(
    packageId: string,
    language: string,
    downloadUrl: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    try {
      const packageDir = `${VOICE_CACHE_DIR}${packageId}/`;

      // 創建包目錄
      const dirInfo = await FileSystem.getInfoAsync(packageDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(packageDir, { intermediates: true });
      }

      // 下載語音包
      console.log(`[OfflineVoicePackageManager] Downloading voice package: ${packageId}`);
      const zipPath = `${packageDir}${packageId}.zip`;

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, zipPath);

      if (downloadResult.status !== 200) {
        throw new Error(`Failed to download voice package: ${downloadResult.status}`);
      }

      // 解壓縮（簡化版，實際應使用 zip 庫）
      // 這裡假設下載的是已解壓的文件
      const fileInfo = await FileSystem.getInfoAsync(zipPath);
      const size = (fileInfo.exists && 'size' in fileInfo) ? (fileInfo as any).size || 0 : 0;

      // 更新元數據
      const voicePackage: VoicePackage = {
        id: packageId,
        language,
        name: `Voice Package - ${language}`,
        version: '1.0.0',
        size,
        downloadUrl,
        timestamp: Date.now(),
        isDownloaded: true,
      };

      this.packages.set(packageId, voicePackage);
      await this.saveMetadata();

      console.log(`[OfflineVoicePackageManager] Voice package downloaded: ${packageId}`);
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Error downloading voice package:', error);
      throw error;
    }
  }

  /**
   * 獲取本地語音文件路徑
   */
  async getLocalVoicePath(packageId: string, phraseKey: string): Promise<string | null> {
    try {
      const voicePath = `${VOICE_CACHE_DIR}${packageId}/${phraseKey}.mp3`;
      const fileInfo = await FileSystem.getInfoAsync(voicePath);

      if (fileInfo.exists) {
        return voicePath;
      }

      return null;
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Error getting voice path:', error);
      return null;
    }
  }

  /**
   * 播放本地語音
   */
  async playLocalVoice(voicePath: string): Promise<void> {
    try {
      // 使用 Speech API 播放本地音頻
      // 注意：expo-speech 主要用於文本轉語音
      // 對於本地音頻文件，應使用 expo-audio 或其他音頻庫
      console.log('[OfflineVoicePackageManager] Playing local voice:', voicePath);
      this.isPlaying = true;
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Error playing voice:', error);
      throw error;
    }
  }

  /**
   * 停止播放
   */
  async stopPlayback(): Promise<void> {
    try {
      this.isPlaying = false;
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Error stopping playback:', error);
    }
  }

  /**
   * 預生成常用語音短語
   */
  async generateCommonPhrases(packageId: string, language: string): Promise<VoicePhrase[]> {
    const phrases: VoicePhrase[] = [];

    const commonPhrases = {
      'zh-TW': [
        { key: 'turn-left-immediate', text: '立即左轉' },
        { key: 'turn-right-immediate', text: '立即右轉' },
        { key: 'turn-left-100m', text: '100公尺後左轉' },
        { key: 'turn-right-100m', text: '100公尺後右轉' },
        { key: 'turn-left-300m', text: '300公尺後左轉' },
        { key: 'turn-right-300m', text: '300公尺後右轉' },
        { key: 'off-route', text: '您已偏離路線' },
        { key: 'back-on-route', text: '返回路線' },
        { key: 'destination-reached', text: '已到達目的地' },
        { key: 'recalculating', text: '正在重新計算路線' },
      ],
      'en-US': [
        { key: 'turn-left-immediate', text: 'Turn left immediately' },
        { key: 'turn-right-immediate', text: 'Turn right immediately' },
        { key: 'turn-left-100m', text: 'Turn left in 100 meters' },
        { key: 'turn-right-100m', text: 'Turn right in 100 meters' },
        { key: 'turn-left-300m', text: 'Turn left in 300 meters' },
        { key: 'turn-right-300m', text: 'Turn right in 300 meters' },
        { key: 'off-route', text: 'You are off route' },
        { key: 'back-on-route', text: 'Back on route' },
        { key: 'destination-reached', text: 'Destination reached' },
        { key: 'recalculating', text: 'Recalculating route' },
      ],
    };

    const languagePhrases = commonPhrases[language as keyof typeof commonPhrases] || [];

    for (const phrase of languagePhrases) {
      phrases.push({
        key: phrase.key,
        text: phrase.text,
        language,
      });
    }

    return phrases;
  }

  /**
   * 獲取已下載的語音包
   */
  getDownloadedPackages(): VoicePackage[] {
    return Array.from(this.packages.values()).filter((pkg) => pkg.isDownloaded);
  }

  /**
   * 檢查語音包是否已下載
   */
  isPackageDownloaded(packageId: string): boolean {
    const pkg = this.packages.get(packageId);
    return pkg ? pkg.isDownloaded : false;
  }

  /**
   * 刪除語音包
   */
  async deleteVoicePackage(packageId: string): Promise<void> {
    try {
      const packageDir = `${VOICE_CACHE_DIR}${packageId}/`;
      await FileSystem.deleteAsync(packageDir);

      this.packages.delete(packageId);
      await this.saveMetadata();

      console.log(`[OfflineVoicePackageManager] Voice package deleted: ${packageId}`);
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Error deleting voice package:', error);
      throw error;
    }
  }

  /**
   * 獲取快取統計信息
   */
  async getCacheStats(): Promise<{ totalSize: number; packageCount: number }> {
    try {
      let totalSize = 0;

      for (const pkg of this.packages.values()) {
        totalSize += pkg.size;
      }

      return {
        totalSize,
        packageCount: this.packages.size,
      };
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Error getting cache stats:', error);
      return { totalSize: 0, packageCount: 0 };
    }
  }

  /**
   * 清空語音快取
   */
  async clearCache(): Promise<void> {
    try {
      await FileSystem.deleteAsync(VOICE_CACHE_DIR);
      await FileSystem.makeDirectoryAsync(VOICE_CACHE_DIR, { intermediates: true });
      await AsyncStorage.removeItem(VOICE_METADATA_KEY);
      this.packages.clear();

      console.log('[OfflineVoicePackageManager] Voice cache cleared');
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * 加載元數據
   */
  private async loadMetadata(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(VOICE_METADATA_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.packages = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Error loading metadata:', error);
    }
  }

  /**
   * 保存元數據
   */
  private async saveMetadata(): Promise<void> {
    try {
      const data = Object.fromEntries(this.packages);
      await AsyncStorage.setItem(VOICE_METADATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[OfflineVoicePackageManager] Error saving metadata:', error);
    }
  }

  /**
   * 銷毀管理器
   */
  async destroy(): Promise<void> {
    await this.stopPlayback();
    this.packages.clear();
    console.log('[OfflineVoicePackageManager] Destroyed');
  }
}

// 全局單例
let managerInstance: OfflineVoicePackageManager | null = null;

export function getOfflineVoicePackageManager(): OfflineVoicePackageManager {
  if (!managerInstance) {
    managerInstance = new OfflineVoicePackageManager();
  }
  return managerInstance;
}
