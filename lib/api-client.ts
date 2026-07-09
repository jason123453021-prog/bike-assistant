import axios, { AxiosInstance } from 'axios';

/**
 * 後端 API 客戶端
 */
export class ApiClient {
  private static instance: AxiosInstance;

  static getInstance(): AxiosInstance {
    if (!this.instance) {
      this.instance = axios.create({
        baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // 添加請求攔截器
      this.instance.interceptors.request.use(
        (config) => {
          // 可以在這裡添加認證令牌
          return config;
        },
        (error) => Promise.reject(error)
      );

      // 添加響應攔截器
      this.instance.interceptors.response.use(
        (response) => response.data,
        (error) => {
          console.error('API Error:', error);
          return Promise.reject(error);
        }
      );
    }

    return this.instance;
  }

  /**
   * 獲取騎乘記錄
   */
  static async getRideRecords(userId: string) {
    try {
      return await this.getInstance().get(`/api/rides/${userId}`);
    } catch (error) {
      console.error('Failed to fetch ride records:', error);
      return [];
    }
  }

  /**
   * 保存騎乘記錄
   */
  static async saveRideRecord(userId: string, rideData: any) {
    try {
      return await this.getInstance().post(`/api/rides/${userId}`, rideData);
    } catch (error) {
      console.error('Failed to save ride record:', error);
      throw error;
    }
  }

  /**
   * 獲取用戶排行榜
   */
  static async getLeaderboard(type: 'distance' | 'speed' | 'rides' = 'distance', limit: number = 100) {
    try {
      return await this.getInstance().get(`/api/leaderboard?type=${type}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      return [];
    }
  }

  /**
   * 獲取隊友列表
   */
  static async getBuddies(userId: string) {
    try {
      return await this.getInstance().get(`/api/buddies/${userId}`);
    } catch (error) {
      console.error('Failed to fetch buddies:', error);
      return [];
    }
  }

  /**
   * 獲取社群挑戰
   */
  static async getChallenges() {
    try {
      return await this.getInstance().get('/api/challenges');
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
      return [];
    }
  }

  /**
   * 加入挑戰
   */
  static async joinChallenge(userId: string, challengeId: string) {
    try {
      return await this.getInstance().post(`/api/challenges/${challengeId}/join`, { userId });
    } catch (error) {
      console.error('Failed to join challenge:', error);
      throw error;
    }
  }

  /**
   * 獲取訓練計劃
   */
  static async getTrainingPlans(userId: string) {
    try {
      return await this.getInstance().get(`/api/training-plans/${userId}`);
    } catch (error) {
      console.error('Failed to fetch training plans:', error);
      return [];
    }
  }

  /**
   * 獲取天氣信息
   */
  static async getWeather(latitude: number, longitude: number) {
    try {
      return await this.getInstance().get(`/api/weather?lat=${latitude}&lon=${longitude}`);
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      return null;
    }
  }

  /**
   * 獲取推薦路線
   */
  static async getRecommendedRoutes(userId: string) {
    try {
      return await this.getInstance().get(`/api/routes/recommended?userId=${userId}`);
    } catch (error) {
      console.error('Failed to fetch recommended routes:', error);
      return [];
    }
  }

  /**
   * 分享騎乘成績
   */
  static async shareRide(userId: string, rideId: string, platform: string) {
    try {
      return await this.getInstance().post(`/api/rides/${rideId}/share`, {
        userId,
        platform,
      });
    } catch (error) {
      console.error('Failed to share ride:', error);
      throw error;
    }
  }

  /**
   * 獲取騎乘評論
   */
  static async getRideComments(rideId: string) {
    try {
      return await this.getInstance().get(`/api/rides/${rideId}/comments`);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      return [];
    }
  }

  /**
   * 添加騎乘評論
   */
  static async addRideComment(rideId: string, userId: string, content: string) {
    try {
      return await this.getInstance().post(`/api/rides/${rideId}/comments`, {
        userId,
        content,
      });
    } catch (error) {
      console.error('Failed to add comment:', error);
      throw error;
    }
  }

  /**
   * 點讚評論
   */
  static async likeComment(commentId: string, userId: string) {
    try {
      return await this.getInstance().post(`/api/comments/${commentId}/like`, {
        userId,
      });
    } catch (error) {
      console.error('Failed to like comment:', error);
      throw error;
    }
  }

  /**
   * 獲取用戶通知
   */
  static async getNotifications(userId: string) {
    try {
      return await this.getInstance().get(`/api/notifications/${userId}`);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  }

  /**
   * 標記通知為已讀
   */
  static async markNotificationAsRead(notificationId: string) {
    try {
      return await this.getInstance().put(`/api/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * 獲取用戶分析數據
   */
  static async getUserAnalytics(userId: string) {
    try {
      return await this.getInstance().get(`/api/analytics/${userId}`);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      return null;
    }
  }
}
