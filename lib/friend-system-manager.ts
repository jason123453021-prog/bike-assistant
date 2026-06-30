import { getUserAccountManager, type UserAccount } from '@/lib/user-account-manager';

/**
 * 好友關係
 */
export interface FriendRelation {
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: number;
  acceptedAt?: number;
}

/**
 * 好友統計對比
 */
export interface FriendComparison {
  userId: string;
  friendId: string;
  userStats: FriendStats;
  friendStats: FriendStats;
  comparisonDate: number;
}

/**
 * 好友統計信息
 */
export interface FriendStats {
  userId: string;
  username: string;
  avatar?: string;
  totalRides: number;
  totalDistance: number;
  totalTime: number;
  totalElevationGain: number;
  averageSpeed: number;
  maxSpeed: number;
  thisMonthDistance: number;
  thisMonthRides: number;
  thisWeekDistance: number;
  thisWeekRides: number;
}

/**
 * 好友系統管理器
 */
class FriendSystemManager {
  private static instance: FriendSystemManager;

  private constructor() {}

  static getInstance(): FriendSystemManager {
    if (!FriendSystemManager.instance) {
      FriendSystemManager.instance = new FriendSystemManager();
    }
    return FriendSystemManager.instance;
  }

  /**
   * 發送好友請求
   */
  async sendFriendRequest(friendId: string): Promise<FriendRelation> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({ friendId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send friend request');
      }

      const relation: FriendRelation = await response.json();
      return relation;
    } catch (error) {
      console.error('[FriendSystemManager] Error sending friend request:', error);
      throw error;
    }
  }

  /**
   * 接受好友請求
   */
  async acceptFriendRequest(friendId: string): Promise<FriendRelation> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({ friendId }),
      });

      if (!response.ok) {
        throw new Error('Failed to accept friend request');
      }

      const relation: FriendRelation = await response.json();
      return relation;
    } catch (error) {
      console.error('[FriendSystemManager] Error accepting friend request:', error);
      throw error;
    }
  }

  /**
   * 拒絕好友請求
   */
  async rejectFriendRequest(friendId: string): Promise<void> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/friends/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({ friendId }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject friend request');
      }
    } catch (error) {
      console.error('[FriendSystemManager] Error rejecting friend request:', error);
      throw error;
    }
  }

  /**
   * 移除好友
   */
  async removeFriend(friendId: string): Promise<void> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch(`/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove friend');
      }
    } catch (error) {
      console.error('[FriendSystemManager] Error removing friend:', error);
      throw error;
    }
  }

  /**
   * 獲取好友列表
   */
  async getFriendsList(): Promise<UserAccount[]> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/friends/list', {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch friends list');
      }

      const friends: UserAccount[] = await response.json();
      return friends;
    } catch (error) {
      console.error('[FriendSystemManager] Error fetching friends list:', error);
      throw error;
    }
  }

  /**
   * 獲取待處理的好友請求
   */
  async getPendingRequests(): Promise<UserAccount[]> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/friends/pending', {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending requests');
      }

      const requests: UserAccount[] = await response.json();
      return requests;
    } catch (error) {
      console.error('[FriendSystemManager] Error fetching pending requests:', error);
      throw error;
    }
  }

  /**
   * 獲取好友統計信息
   */
  async getFriendStats(friendId: string): Promise<FriendStats> {
    try {
      const userManager = getUserAccountManager();
      const token = userManager.getAuthToken();

      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch(`/api/friends/${friendId}/stats`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch friend stats');
      }

      const stats: FriendStats = await response.json();
      return stats;
    } catch (error) {
      console.error('[FriendSystemManager] Error fetching friend stats:', error);
      throw error;
    }
  }

  /**
   * 對比好友統計
   */
  async compareFriendStats(friendId: string): Promise<FriendComparison> {
    try {
      const userManager = getUserAccountManager();
      const currentUser = userManager.getCurrentUser();

      if (!currentUser) {
        throw new Error('No current user');
      }

      const token = userManager.getAuthToken();
      if (!token) {
        throw new Error('No auth token');
      }

      // 獲取當前用戶統計
      const userStatsResponse = await fetch('/api/users/me/stats', {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      if (!userStatsResponse.ok) {
        throw new Error('Failed to fetch user stats');
      }

      const userStats: FriendStats = await userStatsResponse.json();

      // 獲取好友統計
      const friendStats = await this.getFriendStats(friendId);

      const comparison: FriendComparison = {
        userId: currentUser.id,
        friendId,
        userStats,
        friendStats,
        comparisonDate: Date.now(),
      };

      return comparison;
    } catch (error) {
      console.error('[FriendSystemManager] Error comparing friend stats:', error);
      throw error;
    }
  }

  /**
   * 計算統計對比百分比
   */
  calculateComparisonPercentage(userValue: number, friendValue: number): number {
    if (friendValue === 0) {
      return userValue > 0 ? 100 : 0;
    }

    return ((userValue - friendValue) / friendValue) * 100;
  }

  /**
   * 獲取對比結果文本
   */
  getComparisonText(userValue: number, friendValue: number, label: string): string {
    const percentage = this.calculateComparisonPercentage(userValue, friendValue);

    if (percentage > 0) {
      return `領先 ${percentage.toFixed(1)}% 的 ${label}`;
    } else if (percentage < 0) {
      return `落後 ${Math.abs(percentage).toFixed(1)}% 的 ${label}`;
    } else {
      return `與好友相同的 ${label}`;
    }
  }

  /**
   * 銷毀實例
   */
  destroy(): void {
    // 清理資源
  }
}

export function getFriendSystemManager(): FriendSystemManager {
  return FriendSystemManager.getInstance();
}
