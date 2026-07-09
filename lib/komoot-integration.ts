import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feature, LineString } from 'geojson';

export interface KomootRoute {
  id: number;
  name: string;
  description?: string;
  difficulty: 'easy' | 'moderate' | 'difficult';
  distance: number; // 公里
  duration: number; // 分鐘
  elevation: number; // 米
  ascent: number; // 米
  descent: number; // 米
  track: Feature<LineString>;
  startPoint: { lat: number; lon: number };
  endPoint: { lat: number; lon: number };
  type: 'bike' | 'road' | 'mtb' | 'gravel';
  popularity: number; // 0-100
  rating: number; // 0-5
  reviews: number;
  author?: string;
  tags: string[];
  imageUrl?: string;
  downloadedAt?: number;
  offlineAvailable: boolean;
}

export interface KomootChallenge {
  id: number;
  name: string;
  description: string;
  type: 'distance' | 'elevation' | 'speed' | 'time';
  target: number;
  unit: string;
  startDate: number;
  endDate: number;
  participants: number;
  leaderboard: ChallengeEntry[];
}

export interface ChallengeEntry {
  userId: string;
  userName: string;
  value: number;
  rank: number;
  avatar?: string;
}

const KOMOOT_ROUTES_KEY = 'komoot_routes';
const KOMOOT_CHALLENGES_KEY = 'komoot_challenges';
const KOMOOT_AUTH_KEY = 'komoot_auth';

export class KomootIntegration {
  private static accessToken: string | null = null;

  /**
   * 初始化 Komoot 集成
   */
  static async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(KOMOOT_AUTH_KEY);
      if (stored) {
        const { accessToken } = JSON.parse(stored);
        this.accessToken = accessToken;
      }
    } catch (error) {
      console.error('Failed to initialize Komoot integration:', error);
    }
  }

  /**
   * 搜尋推薦路線
   */
  static async searchRecommendedRoutes(
    latitude: number,
    longitude: number,
    radius: number = 50,
    type: 'bike' | 'road' | 'mtb' | 'gravel' = 'bike'
  ): Promise<KomootRoute[]> {
    try {
      // 模擬推薦路線
      const mockRoutes: KomootRoute[] = [
        {
          id: 1,
          name: '城市環線騎乘',
          description: '穿過城市公園和河濱的輕鬆騎乘',
          difficulty: 'easy',
          distance: 25,
          duration: 90,
          elevation: 150,
          ascent: 80,
          descent: 80,
          track: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [longitude, latitude],
                [longitude + 0.01, latitude + 0.01],
                [longitude + 0.02, latitude],
              ],
            },
            properties: {},
          },
          startPoint: { lat: latitude, lon: longitude },
          endPoint: { lat: latitude + 0.02, lon: longitude + 0.02 },
          type: 'bike',
          popularity: 85,
          rating: 4.5,
          reviews: 234,
          author: 'Komoot Community',
          tags: ['城市', '公園', '輕鬆'],
          offlineAvailable: false,
        },
        {
          id: 2,
          name: '山區爬坡挑戰',
          description: '適合進階騎手的山區路線',
          difficulty: 'difficult',
          distance: 45,
          duration: 180,
          elevation: 1200,
          ascent: 800,
          descent: 800,
          track: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [longitude, latitude],
                [longitude + 0.02, latitude + 0.02],
                [longitude + 0.04, latitude + 0.01],
              ],
            },
            properties: {},
          },
          startPoint: { lat: latitude, lon: longitude },
          endPoint: { lat: latitude + 0.04, lon: longitude + 0.01 },
          type: 'mtb',
          popularity: 72,
          rating: 4.8,
          reviews: 156,
          author: 'Mountain Bike Enthusiasts',
          tags: ['山區', '爬坡', '挑戰'],
          offlineAvailable: false,
        },
        {
          id: 3,
          name: '河濱公路騎乘',
          description: '沿河流的平坦公路騎乘',
          difficulty: 'easy',
          distance: 35,
          duration: 120,
          elevation: 80,
          ascent: 40,
          descent: 40,
          track: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [longitude, latitude],
                [longitude + 0.015, latitude - 0.01],
                [longitude + 0.03, latitude],
              ],
            },
            properties: {},
          },
          startPoint: { lat: latitude, lon: longitude },
          endPoint: { lat: latitude + 0.03, lon: longitude },
          type: 'road',
          popularity: 90,
          rating: 4.6,
          reviews: 312,
          author: 'Road Cycling Group',
          tags: ['河濱', '公路', '平坦'],
          offlineAvailable: false,
        },
      ];

      return mockRoutes;
    } catch (error) {
      console.error('Failed to search recommended routes:', error);
      return [];
    }
  }

  /**
   * 獲取熱門路線
   */
  static async getPopularRoutes(limit: number = 10): Promise<KomootRoute[]> {
    try {
      const routes = await this.searchRecommendedRoutes(0, 0);
      return routes.sort((a, b) => b.popularity - a.popularity).slice(0, limit);
    } catch (error) {
      console.error('Failed to get popular routes:', error);
      return [];
    }
  }

  /**
   * 下載路線進行離線使用
   */
  static async downloadRouteForOffline(route: KomootRoute): Promise<boolean> {
    try {
      const routes = await this.getDownloadedRoutes();
      const updated = [...routes, { ...route, downloadedAt: Date.now(), offlineAvailable: true }];
      await AsyncStorage.setItem(KOMOOT_ROUTES_KEY, JSON.stringify(updated));

      console.log(`Downloaded route: ${route.name}`);
      return true;
    } catch (error) {
      console.error('Failed to download route:', error);
      return false;
    }
  }

  /**
   * 獲取已下載的路線
   */
  static async getDownloadedRoutes(): Promise<KomootRoute[]> {
    try {
      const data = await AsyncStorage.getItem(KOMOOT_ROUTES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get downloaded routes:', error);
      return [];
    }
  }

  /**
   * 刪除下載的路線
   */
  static async deleteDownloadedRoute(routeId: number): Promise<boolean> {
    try {
      const routes = await this.getDownloadedRoutes();
      const filtered = routes.filter((r) => r.id !== routeId);
      await AsyncStorage.setItem(KOMOOT_ROUTES_KEY, JSON.stringify(filtered));

      return true;
    } catch (error) {
      console.error('Failed to delete route:', error);
      return false;
    }
  }

  /**
   * 搜尋路線
   */
  static async searchRoutes(query: string): Promise<KomootRoute[]> {
    try {
      const allRoutes = await this.searchRecommendedRoutes(0, 0);
      const lowerQuery = query.toLowerCase();

      return allRoutes.filter(
        (r) =>
          r.name.toLowerCase().includes(lowerQuery) ||
          r.description?.toLowerCase().includes(lowerQuery) ||
          r.tags.some((t) => t.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('Failed to search routes:', error);
      return [];
    }
  }

  /**
   * 獲取活躍挑戰
   */
  static async getActiveChallenges(): Promise<KomootChallenge[]> {
    try {
      const now = Date.now();
      const mockChallenges: KomootChallenge[] = [
        {
          id: 1,
          name: '七月騎乘距離挑戰',
          description: '本月騎乘最多距離的騎手',
          type: 'distance',
          target: 500,
          unit: 'km',
          startDate: now - 7 * 24 * 60 * 60 * 1000,
          endDate: now + 23 * 24 * 60 * 60 * 1000,
          participants: 1250,
          leaderboard: [
            { userId: 'user1', userName: '騎乘王', value: 450, rank: 1, avatar: '👑' },
            { userId: 'user2', userName: '速度獵人', value: 420, rank: 2, avatar: '⚡' },
            { userId: 'user3', userName: '你', value: 380, rank: 3, avatar: '🚴' },
          ],
        },
        {
          id: 2,
          name: '爬坡高度挑戰',
          description: '本月爬升最多高度的騎手',
          type: 'elevation',
          target: 10000,
          unit: 'm',
          startDate: now - 7 * 24 * 60 * 60 * 1000,
          endDate: now + 23 * 24 * 60 * 60 * 1000,
          participants: 890,
          leaderboard: [
            { userId: 'user4', userName: '山地騎手', value: 8500, rank: 1, avatar: '🏔️' },
            { userId: 'user5', userName: '耐力戰士', value: 7800, rank: 2, avatar: '💪' },
            { userId: 'user3', userName: '你', value: 6200, rank: 5, avatar: '🚴' },
          ],
        },
      ];

      return mockChallenges;
    } catch (error) {
      console.error('Failed to get active challenges:', error);
      return [];
    }
  }

  /**
   * 獲取挑戰排行榜
   */
  static async getChallengeLeaderboard(challengeId: number): Promise<ChallengeEntry[]> {
    try {
      const challenges = await this.getActiveChallenges();
      const challenge = challenges.find((c) => c.id === challengeId);
      return challenge?.leaderboard || [];
    } catch (error) {
      console.error('Failed to get challenge leaderboard:', error);
      return [];
    }
  }

  /**
   * 獲取路線難度統計
   */
  static getDifficultyStats(routes: KomootRoute[]) {
    const stats = {
      easy: routes.filter((r) => r.difficulty === 'easy').length,
      moderate: routes.filter((r) => r.difficulty === 'moderate').length,
      difficult: routes.filter((r) => r.difficulty === 'difficult').length,
    };

    return stats;
  }

  /**
   * 獲取路線類型統計
   */
  static getTypeStats(routes: KomootRoute[]) {
    const stats = {
      bike: routes.filter((r) => r.type === 'bike').length,
      road: routes.filter((r) => r.type === 'road').length,
      mtb: routes.filter((r) => r.type === 'mtb').length,
      gravel: routes.filter((r) => r.type === 'gravel').length,
    };

    return stats;
  }

  /**
   * 計算路線評分
   */
  static calculateRouteScore(route: KomootRoute): number {
    const ratingScore = route.rating * 20; // 0-100
    const popularityScore = route.popularity; // 0-100
    const reviewScore = Math.min(route.reviews / 5, 20); // 0-20

    return Math.round((ratingScore + popularityScore + reviewScore) / 3);
  }

  /**
   * 推薦路線
   */
  static async recommendRoutes(userPreferences: {
    difficulty?: 'easy' | 'moderate' | 'difficult';
    type?: 'bike' | 'road' | 'mtb' | 'gravel';
    maxDistance?: number;
    minRating?: number;
  }): Promise<KomootRoute[]> {
    try {
      let routes = await this.searchRecommendedRoutes(0, 0);

      if (userPreferences.difficulty) {
        routes = routes.filter((r) => r.difficulty === userPreferences.difficulty);
      }

      if (userPreferences.type) {
        routes = routes.filter((r) => r.type === userPreferences.type);
      }

      if (userPreferences.maxDistance) {
        routes = routes.filter((r) => r.distance <= userPreferences.maxDistance!);
      }

      if (userPreferences.minRating) {
        routes = routes.filter((r) => r.rating >= userPreferences.minRating!);
      }

      // 按評分排序
      return routes.sort((a, b) => this.calculateRouteScore(b) - this.calculateRouteScore(a));
    } catch (error) {
      console.error('Failed to recommend routes:', error);
      return [];
    }
  }
}
