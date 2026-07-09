import { LocalStorageManager } from './local-storage-manager';

/**
 * 社區功能管理器
 */
export class CommunityFeaturesManager {
  /**
   * 騎乘評論類型
   */
  interface RideComment {
    id: string;
    rideId: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: number;
    likes: number;
    replies: RideComment[];
  }

  /**
   * 騎乘分享類型
   */
  interface RideShare {
    id: string;
    rideId: string;
    userId: string;
    platform: 'facebook' | 'twitter' | 'instagram' | 'whatsapp';
    timestamp: number;
    caption: string;
  }

  /**
   * 添加評論
   */
  static async addComment(rideId: string, content: string, userName: string = 'You') {
    const comment: any = {
      id: `comment_${Date.now()}`,
      rideId,
      userId: 'user_1',
      userName,
      content,
      timestamp: Date.now(),
      likes: 0,
      replies: [],
    };

    const comments = (await LocalStorageManager.getUserSettings())?.comments || [];
    comments.push(comment);

    await LocalStorageManager.saveUserSettings({
      comments,
    });

    return comment;
  }

  /**
   * 獲取騎乘評論
   */
  static async getRideComments(rideId: string) {
    const settings = await LocalStorageManager.getUserSettings();
    const comments = settings?.comments || [];

    return comments.filter((c: any) => c.rideId === rideId);
  }

  /**
   * 點讚評論
   */
  static async likeComment(commentId: string) {
    const settings = await LocalStorageManager.getUserSettings();
    const comments = settings?.comments || [];

    const comment = comments.find((c: any) => c.id === commentId);
    if (comment) {
      comment.likes += 1;
      await LocalStorageManager.saveUserSettings({ comments });
    }

    return comment;
  }

  /**
   * 分享騎乘成績
   */
  static async shareRide(
    rideId: string,
    platform: 'facebook' | 'twitter' | 'instagram' | 'whatsapp',
    caption: string
  ) {
    const share: any = {
      id: `share_${Date.now()}`,
      rideId,
      userId: 'user_1',
      platform,
      timestamp: Date.now(),
      caption,
    };

    const shares = (await LocalStorageManager.getUserSettings())?.shares || [];
    shares.push(share);

    await LocalStorageManager.saveUserSettings({ shares });

    // 生成分享 URL
    const shareUrl = this.generateShareUrl(rideId, platform, caption);

    return { share, shareUrl };
  }

  /**
   * 生成分享 URL
   */
  private static generateShareUrl(
    rideId: string,
    platform: string,
    caption: string
  ): string {
    const baseUrl = `https://bikeassist.app/ride/${rideId}`;
    const encodedCaption = encodeURIComponent(caption);

    switch (platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${baseUrl}&quote=${encodedCaption}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?url=${baseUrl}&text=${encodedCaption}`;
      case 'instagram':
        return `https://www.instagram.com/?url=${baseUrl}`;
      case 'whatsapp':
        return `https://wa.me/?text=${encodedCaption}%20${baseUrl}`;
      default:
        return baseUrl;
    }
  }

  /**
   * 獲取用戶分享歷史
   */
  static async getShareHistory(limit: number = 10) {
    const settings = await LocalStorageManager.getUserSettings();
    const shares = settings?.shares || [];

    return shares.sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * 生成分享預覽
   */
  static generateSharePreview(ride: any) {
    return {
      title: `我完成了 ${ride.distance} km 的騎乘！`,
      description: `耗時 ${Math.floor(ride.duration / 60)} 分鐘，平均速度 ${ride.speed} km/h`,
      image: ride.mapSnapshot || 'https://via.placeholder.com/1200x630',
      url: `https://bikeassist.app/ride/${ride.id}`,
    };
  }

  /**
   * 獲取社區熱門騎乘
   */
  static async getTrendingRides() {
    const records = await LocalStorageManager.getAllRideRecords();

    // 模擬社區熱門騎乘（基於距離和時間）
    return records
      .sort((a: any, b: any) => (b.distance || 0) - (a.distance || 0))
      .slice(0, 5)
      .map((r: any) => ({
        ...r,
        likes: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 50),
        shares: Math.floor(Math.random() * 20),
      }));
  }

  /**
   * 獲取用戶社區排名
   */
  static async getUserCommunityRanking() {
    const records = await LocalStorageManager.getAllRideRecords();
    const shares = (await LocalStorageManager.getUserSettings())?.shares || [];
    const comments = (await LocalStorageManager.getUserSettings())?.comments || [];

    return {
      totalRides: records.length,
      totalShares: shares.length,
      totalComments: comments.length,
      communityScore: records.length * 10 + shares.length * 5 + comments.length * 2,
    };
  }
}
