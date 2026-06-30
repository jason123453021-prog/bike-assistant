import { getUserAccountManager } from '@/lib/user-account-manager';

/**
 * 騎乘路線
 */
export interface CommunityRoute {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  name: string;
  description?: string;
  distance: number;
  elevationGain: number;
  elevationLoss: number;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  trackPoints: Array<{ lat: number; lon: number; altitude?: number }>;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
  likes: number;
  rides: number;
  averageRating: number;
  totalRatings: number;
  tags: string[];
  isPublic: boolean;
}

/**
 * 路線評分
 */
export interface RouteRating {
  id: string;
  routeId: string;
  userId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: number;
}

/**
 * 騎乘路線社群管理器
 */
class RouteCommunityManager {
  private static instance: RouteCommunityManager;

  private constructor() {}

  static getInstance(): RouteCommunityManager {
    if (!RouteCommunityManager.instance) {
      RouteCommunityManager.instance = new RouteCommunityManager();
    }
    return RouteCommunityManager.instance;
  }

  /**
   * 分享路線到社群
   */
  async shareRoute(
    name: string,
    description: string,
    distance: number,
    elevationGain: number,
    elevationLoss: number,
    difficulty: string,
    trackPoints: Array<{ lat: number; lon: number; altitude?: number }>,
    tags: string[],
    isPublic: boolean = true
  ): Promise<CommunityRoute> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/routes/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({
          name,
          description,
          distance,
          elevationGain,
          elevationLoss,
          difficulty,
          trackPoints,
          tags,
          isPublic,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to share route');
      }

      const route: CommunityRoute = await response.json();
      return route;
    } catch (error) {
      console.error('[RouteCommunityManager] Error sharing route:', error);
      throw error;
    }
  }

  /**
   * 獲取熱門路線
   */
  async getPopularRoutes(
    limit: number = 20,
    offset: number = 0
  ): Promise<CommunityRoute[]> {
    try {
      const response = await fetch(
        `/api/routes/popular?limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch popular routes');
      }

      const routes: CommunityRoute[] = await response.json();
      return routes;
    } catch (error) {
      console.error('[RouteCommunityManager] Error fetching popular routes:', error);
      throw error;
    }
  }

  /**
   * 搜尋路線
   */
  async searchRoutes(
    query: string,
    difficulty?: string,
    maxDistance?: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<CommunityRoute[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String(offset),
      });

      if (difficulty) {
        params.append('difficulty', difficulty);
      }

      if (maxDistance) {
        params.append('maxDistance', String(maxDistance));
      }

      const response = await fetch(`/api/routes/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to search routes');
      }

      const routes: CommunityRoute[] = await response.json();
      return routes;
    } catch (error) {
      console.error('[RouteCommunityManager] Error searching routes:', error);
      throw error;
    }
  }

  /**
   * 獲取路線詳情
   */
  async getRouteDetails(routeId: string): Promise<CommunityRoute> {
    try {
      const response = await fetch(`/api/routes/${routeId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch route details');
      }

      const route: CommunityRoute = await response.json();
      return route;
    } catch (error) {
      console.error('[RouteCommunityManager] Error fetching route details:', error);
      throw error;
    }
  }

  /**
   * 點讚路線
   */
  async likeRoute(routeId: string): Promise<void> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch(`/api/routes/${routeId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to like route');
      }
    } catch (error) {
      console.error('[RouteCommunityManager] Error liking route:', error);
      throw error;
    }
  }

  /**
   * 取消點讚路線
   */
  async unlikeRoute(routeId: string): Promise<void> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch(`/api/routes/${routeId}/unlike`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to unlike route');
      }
    } catch (error) {
      console.error('[RouteCommunityManager] Error unliking route:', error);
      throw error;
    }
  }

  /**
   * 評分路線
   */
  async rateRoute(
    routeId: string,
    rating: number,
    comment?: string
  ): Promise<RouteRating> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch(`/api/routes/${routeId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({ rating, comment }),
      });

      if (!response.ok) {
        throw new Error('Failed to rate route');
      }

      const routeRating: RouteRating = await response.json();
      return routeRating;
    } catch (error) {
      console.error('[RouteCommunityManager] Error rating route:', error);
      throw error;
    }
  }

  /**
   * 獲取路線評分
   */
  async getRouteRatings(
    routeId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<RouteRating[]> {
    try {
      const response = await fetch(
        `/api/routes/${routeId}/ratings?limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch route ratings');
      }

      const ratings: RouteRating[] = await response.json();
      return ratings;
    } catch (error) {
      console.error('[RouteCommunityManager] Error fetching route ratings:', error);
      throw error;
    }
  }

  /**
   * 獲取我的路線
   */
  async getMyRoutes(): Promise<CommunityRoute[]> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/routes/my-routes', {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch my routes');
      }

      const routes: CommunityRoute[] = await response.json();
      return routes;
    } catch (error) {
      console.error('[RouteCommunityManager] Error fetching my routes:', error);
      throw error;
    }
  }

  /**
   * 刪除路線
   */
  async deleteRoute(routeId: string): Promise<void> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch(`/api/routes/${routeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete route');
      }
    } catch (error) {
      console.error('[RouteCommunityManager] Error deleting route:', error);
      throw error;
    }
  }

  /**
   * 獲取難度標籤
   */
  getDifficultyLabel(difficulty: string): string {
    const labels: Record<string, string> = {
      easy: '簡單',
      moderate: '中等',
      hard: '困難',
      expert: '專家',
    };
    return labels[difficulty] || difficulty;
  }

  /**
   * 獲取難度顏色
   */
  getDifficultyColor(difficulty: string): string {
    const colors: Record<string, string> = {
      easy: '#22C55E',
      moderate: '#3B82F6',
      hard: '#F59E0B',
      expert: '#EF4444',
    };
    return colors[difficulty] || '#6B7280';
  }

  /**
   * 銷毀實例
   */
  destroy(): void {
    // 清理資源
  }
}

export function getRouteCommunityManager(): RouteCommunityManager {
  return RouteCommunityManager.getInstance();
}
