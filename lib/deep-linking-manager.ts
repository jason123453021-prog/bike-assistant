/**
 * 深度鏈接管理器
 * 支援應用內導航和社交分享
 */

export interface DeepLink {
  path: string;
  params?: Record<string, any>;
}

export class DeepLinkingManager {
  private static readonly SCHEME = 'bikeassist://';

  /**
   * 生成深度鏈接
   */
  static generateLink(path: string, params?: Record<string, any>): string {
    const queryString = params
      ? '?' + Object.entries(params)
          .map(([key, value]) => `${key}=${encodeURIComponent(JSON.stringify(value))}`)
          .join('&')
      : '';
    return `${this.SCHEME}${path}${queryString}`;
  }

  /**
   * 解析深度鏈接
   */
  static parseLink(url: string): DeepLink | null {
    try {
      if (!url.startsWith(this.SCHEME)) return null;

      const pathAndQuery = url.substring(this.SCHEME.length);
      const [path, queryString] = pathAndQuery.split('?');

      const params: Record<string, any> = {};
      if (queryString) {
        queryString.split('&').forEach((pair) => {
          const [key, value] = pair.split('=');
          params[key] = JSON.parse(decodeURIComponent(value));
        });
      }

      return { path, params };
    } catch (error) {
      console.error('[DeepLinkingManager] Failed to parse link:', error);
      return null;
    }
  }

  /**
   * 騎乘詳情鏈接
   */
  static rideDetailLink(rideId: string): string {
    return this.generateLink('ride-detail', { rideId });
  }

  /**
   * 用戶資料鏈接
   */
  static userProfileLink(userId: string): string {
    return this.generateLink('user-profile', { userId });
  }

  /**
   * 挑戰詳情鏈接
   */
  static challengeLink(challengeId: string): string {
    return this.generateLink('challenge-detail', { challengeId });
  }

  /**
   * 排行榜鏈接
   */
  static leaderboardLink(type: 'distance' | 'speed' | 'rides'): string {
    return this.generateLink('leaderboard', { type });
  }

  /**
   * 生成分享文本
   */
  static generateShareText(rideId: string, distance: number, time: number): string {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const speed = distance > 0 ? (distance / (time / 3600)).toFixed(1) : '0';

    return `我剛完成了一次騎乘！距離: ${distance.toFixed(1)}km，耗時: ${hours}h${minutes}m，平均速度: ${speed}km/h。\n\n用智慧單車騎乘助手追蹤你的騎乘！\n${this.rideDetailLink(rideId)}`;
  }

  /**
   * 生成社交媒體分享鏈接
   */
  static generateSocialShareLink(
    platform: 'facebook' | 'twitter' | 'whatsapp' | 'instagram',
    text: string,
    link: string,
  ): string {
    const encodedText = encodeURIComponent(text);
    const encodedLink = encodeURIComponent(link);

    switch (platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}&quote=${encodedText}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedLink}`;
      case 'whatsapp':
        return `https://wa.me/?text=${encodedText}%20${encodedLink}`;
      case 'instagram':
        // Instagram 不支援直接分享鏈接，只能複製到剪貼板
        return '';
      default:
        return '';
    }
  }

  /**
   * 生成邀請鏈接
   */
  static generateInviteLink(userId: string): string {
    return this.generateLink('invite', { userId });
  }

  /**
   * 生成 QR Code 內容
   */
  static generateQRContent(type: 'user' | 'ride' | 'challenge', id: string): string {
    switch (type) {
      case 'user':
        return this.userProfileLink(id);
      case 'ride':
        return this.rideDetailLink(id);
      case 'challenge':
        return this.challengeLink(id);
      default:
        return '';
    }
  }
}
