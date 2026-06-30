import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { type RideStatistics } from '@/lib/ride-statistics-manager';

export interface ShareOptions {
  platform?: 'instagram' | 'facebook' | 'strava' | 'twitter' | 'generic';
  includeMap?: boolean;
  includeStats?: boolean;
  customMessage?: string;
}

/**
 * 社交分享管理器
 * 功能：
 * - 生成分享卡片
 * - 分享到社交媒體
 * - 生成分享統計
 */
export class SocialShareManager {
  /**
   * 生成分享文本
   */
  generateShareText(statistics: RideStatistics, customMessage?: string): string {
    const distance = (statistics.totalDistance / 1000).toFixed(2);
    const time = this.formatTime(statistics.totalTime);
    const avgSpeed = statistics.averageSpeed.toFixed(1);
    const maxSpeed = statistics.maxSpeed.toFixed(1);
    const elevation = Math.round(statistics.totalElevationGain);

    const defaultMessage = `🚴 騎乘完成！

📍 ${statistics.routeName || '騎乘路線'}
📏 距離: ${distance} km
⏱️ 時間: ${time}
⚡ 平均速度: ${avgSpeed} km/h
🔥 最高速度: ${maxSpeed} km/h
⛰️ 爬升: ${elevation} m

#自行車 #騎乘 #運動 #健身`;

    return customMessage || defaultMessage;
  }

  /**
   * 分享到社交媒體
   */
  async shareToSocial(
    statistics: RideStatistics,
    options: ShareOptions = {}
  ): Promise<void> {
    try {
      const shareText = this.generateShareText(
        statistics,
        options.customMessage
      );

      const platform = options.platform || 'generic';

      switch (platform) {
        case 'instagram':
          await this.shareToInstagram(shareText, statistics);
          break;
        case 'facebook':
          await this.shareToFacebook(shareText, statistics);
          break;
        case 'strava':
          await this.shareToStrava(shareText, statistics);
          break;
        case 'twitter':
          await this.shareToTwitter(shareText);
          break;
        default:
          await this.shareGeneric(shareText);
      }

      console.log('[SocialShareManager] Shared to', platform);
    } catch (error) {
      console.error('[SocialShareManager] Error sharing:', error);
      throw error;
    }
  }

  /**
   * 分享到 Instagram
   */
  private async shareToInstagram(
    text: string,
    statistics: RideStatistics
  ): Promise<void> {
    try {
      // 生成分享卡片圖片
      const imagePath = await this.generateShareImage(statistics);

      // 使用 expo-sharing 分享到 Instagram
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(imagePath, {
          mimeType: 'image/png',
          UTI: 'com.instagram.photo',
        });
      } else {
        throw new Error('Sharing not available');
      }
    } catch (error) {
      console.error('[SocialShareManager] Error sharing to Instagram:', error);
      throw error;
    }
  }

  /**
   * 分享到 Facebook
   */
  private async shareToFacebook(
    text: string,
    statistics: RideStatistics
  ): Promise<void> {
    try {
      // 生成分享卡片圖片
      const imagePath = await this.generateShareImage(statistics);

      // 使用 expo-sharing 分享到 Facebook
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(imagePath, {
          mimeType: 'image/png',
          UTI: 'com.facebook.photo',
        });
      } else {
        throw new Error('Sharing not available');
      }
    } catch (error) {
      console.error('[SocialShareManager] Error sharing to Facebook:', error);
      throw error;
    }
  }

  /**
   * 分享到 Strava
   */
  private async shareToStrava(
    text: string,
    statistics: RideStatistics
  ): Promise<void> {
    try {
      // Strava 分享 URL 格式
      const stravaUrl = `https://www.strava.com/activities/new?name=${encodeURIComponent(
        statistics.routeName || '騎乘'
      )}&description=${encodeURIComponent(text)}`;

      // 在實際應用中，應該使用 Strava API 進行集成
      console.log('[SocialShareManager] Strava share URL:', stravaUrl);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(stravaUrl);
      }
    } catch (error) {
      console.error('[SocialShareManager] Error sharing to Strava:', error);
      throw error;
    }
  }

  /**
   * 分享到 Twitter
   */
  private async shareToTwitter(text: string): Promise<void> {
    try {
      // Twitter 分享 URL 格式
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(twitterUrl);
      }
    } catch (error) {
      console.error('[SocialShareManager] Error sharing to Twitter:', error);
      throw error;
    }
  }

  /**
   * 通用分享
   */
  private async shareGeneric(text: string): Promise<void> {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(text);
      }
    } catch (error) {
      console.error('[SocialShareManager] Error sharing:', error);
      throw error;
    }
  }

  /**
   * 生成分享卡片圖片
   */
  private async generateShareImage(statistics: RideStatistics): Promise<string> {
    try {
      // 簡化版本 - 實際應使用圖片生成庫
      const fileName = `ride_summary_${statistics.id}.png`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      // 在實際應用中，應該使用 canvas 或圖片生成庫
      // 這裡只是返回一個占位符路徑
      console.log('[SocialShareManager] Generated share image:', filePath);

      return filePath;
    } catch (error) {
      console.error('[SocialShareManager] Error generating share image:', error);
      throw error;
    }
  }

  /**
   * 格式化時間
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  }

  /**
   * 銷毀管理器
   */
  destroy(): void {
    console.log('[SocialShareManager] Destroyed');
  }
}

// 全局單例
let managerInstance: SocialShareManager | null = null;

export function getSocialShareManager(): SocialShareManager {
  if (!managerInstance) {
    managerInstance = new SocialShareManager();
  }
  return managerInstance;
}
