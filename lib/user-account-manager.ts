import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 用戶帳戶資訊
 */
export interface UserAccount {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  bio?: string;
  createdAt: number;
  updatedAt: number;
  totalRides: number;
  totalDistance: number;
  totalTime: number;
  totalElevationGain: number;
  followers: number;
  following: number;
}

/**
 * 用戶認證令牌
 */
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * 用戶帳戶管理器
 */
class UserAccountManager {
  private static instance: UserAccountManager;
  private currentUser: UserAccount | null = null;
  private authToken: AuthToken | null = null;
  private readonly STORAGE_KEYS = {
    USER: 'bike_assistant_user',
    AUTH_TOKEN: 'bike_assistant_auth_token',
  };

  private constructor() {}

  static getInstance(): UserAccountManager {
    if (!UserAccountManager.instance) {
      UserAccountManager.instance = new UserAccountManager();
    }
    return UserAccountManager.instance;
  }

  /**
   * 初始化 - 從本地存儲加載用戶信息
   */
  async initialize(): Promise<void> {
    try {
      const userJson = await AsyncStorage.getItem(this.STORAGE_KEYS.USER);
      const tokenJson = await AsyncStorage.getItem(this.STORAGE_KEYS.AUTH_TOKEN);

      if (userJson) {
        this.currentUser = JSON.parse(userJson);
      }

      if (tokenJson) {
        this.authToken = JSON.parse(tokenJson);
        // 檢查令牌是否過期
        if (this.authToken && this.authToken.expiresAt < Date.now()) {
          await this.refreshAuthToken();
        }
      }
    } catch (error) {
      console.error('[UserAccountManager] Error initializing:', error);
    }
  }

  /**
   * 用戶註冊
   */
  async register(
    email: string,
    username: string,
    password: string
  ): Promise<UserAccount> {
    try {
      // 這裡應該調用後端 API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const data = await response.json();
      const user: UserAccount = data.user;
      const token: AuthToken = data.token;

      // 保存用戶和令牌
      await this.saveUserAndToken(user, token);

      return user;
    } catch (error) {
      console.error('[UserAccountManager] Registration error:', error);
      throw error;
    }
  }

  /**
   * 用戶登錄
   */
  async login(email: string, password: string): Promise<UserAccount> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      const user: UserAccount = data.user;
      const token: AuthToken = data.token;

      // 保存用戶和令牌
      await this.saveUserAndToken(user, token);

      return user;
    } catch (error) {
      console.error('[UserAccountManager] Login error:', error);
      throw error;
    }
  }

  /**
   * 用戶登出
   */
  async logout(): Promise<void> {
    try {
      // 調用後端登出 API
      if (this.authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.authToken.accessToken}`,
          },
        });
      }

      // 清除本地數據
      this.currentUser = null;
      this.authToken = null;

      await AsyncStorage.removeItem(this.STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(this.STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('[UserAccountManager] Logout error:', error);
    }
  }

  /**
   * 刷新認證令牌
   */
  async refreshAuthToken(): Promise<void> {
    try {
      if (!this.authToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.authToken.refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const newToken: AuthToken = data.token;

      this.authToken = newToken;
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.AUTH_TOKEN,
        JSON.stringify(newToken)
      );
    } catch (error) {
      console.error('[UserAccountManager] Token refresh error:', error);
      // 令牌刷新失敗，需要重新登錄
      await this.logout();
    }
  }

  /**
   * 更新用戶資料
   */
  async updateProfile(
    updates: Partial<UserAccount>
  ): Promise<UserAccount> {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in');
      }

      const response = await fetch(`/api/users/${this.currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken?.accessToken}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Update failed');
      }

      const updatedUser: UserAccount = await response.json();

      // 更新本地用戶信息
      this.currentUser = updatedUser;
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.USER,
        JSON.stringify(updatedUser)
      );

      return updatedUser;
    } catch (error) {
      console.error('[UserAccountManager] Update profile error:', error);
      throw error;
    }
  }

  /**
   * 獲取當前用戶
   */
  getCurrentUser(): UserAccount | null {
    return this.currentUser;
  }

  /**
   * 獲取認證令牌
   */
  getAuthToken(): AuthToken | null {
    return this.authToken;
  }

  /**
   * 檢查用戶是否已登錄
   */
  isLoggedIn(): boolean {
    return this.currentUser !== null && this.authToken !== null;
  }

  /**
   * 獲取用戶統計信息
   */
  async getUserStats(): Promise<Partial<UserAccount>> {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in');
      }

      const response = await fetch(`/api/users/${this.currentUser.id}/stats`, {
        headers: {
          Authorization: `Bearer ${this.authToken?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const stats = await response.json();
      return stats;
    } catch (error) {
      console.error('[UserAccountManager] Get stats error:', error);
      throw error;
    }
  }

  /**
   * 保存用戶和令牌到本地存儲
   */
  private async saveUserAndToken(
    user: UserAccount,
    token: AuthToken
  ): Promise<void> {
    this.currentUser = user;
    this.authToken = token;

    await AsyncStorage.setItem(
      this.STORAGE_KEYS.USER,
      JSON.stringify(user)
    );
    await AsyncStorage.setItem(
      this.STORAGE_KEYS.AUTH_TOKEN,
      JSON.stringify(token)
    );
  }

  /**
   * 銷毀實例
   */
  destroy(): void {
    this.currentUser = null;
    this.authToken = null;
  }
}

export function getUserAccountManager(): UserAccountManager {
  return UserAccountManager.getInstance();
}
