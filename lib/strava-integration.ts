import AsyncStorage from '@react-native-async-storage/async-storage';
import { RideRecord } from './ride-record-manager';

export interface StravaActivity {
  id: number;
  name: string;
  distance: number; // 米
  movingTime: number; // 秒
  elapsedTime: number; // 秒
  totalElevationGain: number; // 米
  type: string;
  sportType: string;
  startDate: string;
  averageSpeed: number; // m/s
  maxSpeed: number; // m/s
  averageHeartrate?: number;
  maxHeartrate?: number;
  averagePower?: number;
  maxPower?: number;
  calories?: number;
  kudosCount: number;
  commentCount: number;
  athleteCount: number;
  photoCount: number;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  flagged: boolean;
  workoutType?: number;
  gear?: {
    id: string;
    name: string;
    distance: number;
  };
  segmentEfforts?: SegmentEffort[];
}

export interface SegmentEffort {
  id: number;
  name: string;
  segment: {
    id: number;
    name: string;
    activityType: string;
    distance: number;
    averageGrade: number;
    maxGrade: number;
    elevationHigh: number;
    elevationLow: number;
    startLocation: [number, number];
    endLocation: [number, number];
    climbCategory: number;
    city: string;
    state: string;
    country: string;
    private: boolean;
    hazardous: boolean;
    starred: boolean;
  };
  athleteSegmentStats: {
    prRank?: number;
    goalProgress?: number;
  };
  personalRecord: boolean;
  createdAt: string;
  updatedAt: string;
  startIndex: number;
  endIndex: number;
  movingTime: number;
  elapsedTime: number;
  startDate: string;
  startDateLocal: string;
  distance: number;
  averageHeartrate?: number;
  maxHeartrate?: number;
  averageCadence?: number;
  maxCadence?: number;
  averagePower?: number;
  maxPower?: number;
  averageGrade?: number;
  maxGrade?: number;
  elevation?: number;
}

export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city: string;
  state: string;
  country: string;
  sex: string;
  premium: boolean;
  summit: boolean;
  createdAt: string;
  updatedAt: string;
  badImageUrl: string;
  profileMedium: string;
  profile: string;
  friend?: string;
  follower?: string;
  stats: {
    allRideTotals: {
      count: number;
      distance: number;
      movingTime: number;
      elapsedTime: number;
      elevationGain: number;
      achievementCount: number;
    };
    recentRideTotals: {
      count: number;
      distance: number;
      movingTime: number;
      elapsedTime: number;
      elevationGain: number;
    };
    ytdRideTotals: {
      count: number;
      distance: number;
      movingTime: number;
      elapsedTime: number;
      elevationGain: number;
    };
  };
}

const STRAVA_STORAGE_KEY = 'strava_auth';
const STRAVA_ACTIVITIES_KEY = 'strava_activities';
const STRAVA_ATHLETE_KEY = 'strava_athlete';

export class StravaIntegration {
  private static accessToken: string | null = null;
  private static refreshToken: string | null = null;
  private static expiresAt: number | null = null;

  /**
   * 初始化 Strava 集成
   */
  static async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STRAVA_STORAGE_KEY);
      if (stored) {
        const { accessToken, refreshToken, expiresAt } = JSON.parse(stored);
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresAt = expiresAt;

        // 檢查 token 是否過期
        if (this.expiresAt && this.expiresAt < Date.now()) {
          await this.refreshAccessToken();
        }
      }
    } catch (error) {
      console.error('Failed to initialize Strava integration:', error);
    }
  }

  /**
   * 獲取授權 URL
   */
  static getAuthorizationURL(clientId: string, redirectUri: string): string {
    const scopes = ['read', 'activity:read_all', 'profile:read_all'];
    return `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes.join(',')}`;
  }

  /**
   * 交換授權碼獲取 token
   */
  static async exchangeAuthorizationCode(
    code: string,
    clientId: string,
    clientSecret: string
  ): Promise<boolean> {
    try {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange authorization code');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.expiresAt = data.expires_at * 1000; // 轉換為毫秒

      // 保存到存儲
      await AsyncStorage.setItem(
        STRAVA_STORAGE_KEY,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresAt: this.expiresAt,
        })
      );

      return true;
    } catch (error) {
      console.error('Failed to exchange authorization code:', error);
      return false;
    }
  }

  /**
   * 刷新 access token
   */
  private static async refreshAccessToken(): Promise<boolean> {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh access token');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.expiresAt = data.expires_at * 1000;

      // 更新存儲
      await AsyncStorage.setItem(
        STRAVA_STORAGE_KEY,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresAt: this.expiresAt,
        })
      );

      return true;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      return false;
    }
  }

  /**
   * 獲取當前運動員信息
   */
  static async getAthleteProfile(): Promise<StravaAthlete | null> {
    try {
      if (!this.accessToken) {
        throw new Error('Not authenticated with Strava');
      }

      const response = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch athlete profile');
      }

      const athlete = await response.json();

      // 保存到存儲
      await AsyncStorage.setItem(STRAVA_ATHLETE_KEY, JSON.stringify(athlete));

      return athlete;
    } catch (error) {
      console.error('Failed to get athlete profile:', error);
      return null;
    }
  }

  /**
   * 獲取活動列表
   */
  static async getActivities(page: number = 1, perPage: number = 30): Promise<StravaActivity[]> {
    try {
      if (!this.accessToken) {
        throw new Error('Not authenticated with Strava');
      }

      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const activities = await response.json();

      // 保存到存儲
      const stored = await AsyncStorage.getItem(STRAVA_ACTIVITIES_KEY);
      const allActivities = stored ? JSON.parse(stored) : [];
      const merged = [...activities, ...allActivities.filter((a: any) => !activities.find((b: any) => b.id === a.id))];
      await AsyncStorage.setItem(STRAVA_ACTIVITIES_KEY, JSON.stringify(merged));

      return activities;
    } catch (error) {
      console.error('Failed to get activities:', error);
      return [];
    }
  }

  /**
   * 獲取活動詳情
   */
  static async getActivityDetails(activityId: number): Promise<StravaActivity | null> {
    try {
      if (!this.accessToken) {
        throw new Error('Not authenticated with Strava');
      }

      const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity details');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get activity details:', error);
      return null;
    }
  }

  /**
   * 上傳騎乘記錄到 Strava
   */
  static async uploadActivity(record: RideRecord): Promise<number | null> {
    try {
      if (!this.accessToken) {
        throw new Error('Not authenticated with Strava');
      }

      const gpxData = this.generateGPXFromRecord(record);

      const formData = new FormData();
      formData.append('file', new Blob([gpxData], { type: 'application/gpx+xml' }), 'activity.gpx');
      formData.append('data_type', 'gpx');
      formData.append('name', `騎乘 - ${new Date(record.startTime).toLocaleDateString('zh-TW')}`);
      formData.append('description', `距離: ${(record.distance / 1000).toFixed(2)} km, 時間: ${this.formatDuration(record.duration)}`);
      formData.append('trainer', 'false');
      formData.append('commute', 'false');

      const response = await fetch('https://www.strava.com/api/v3/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload activity');
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Failed to upload activity:', error);
      return null;
    }
  }

  /**
   * 從騎乘記錄生成 GPX
   */
  private static generateGPXFromRecord(record: RideRecord): string {
    const coordinates = record.track.geometry.coordinates as [number, number][];
    const startDate = new Date(record.startTime).toISOString();

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Bike Assistant">
  <metadata>
    <time>${startDate}</time>
  </metadata>
  <trk>
    <name>Ride ${record.id}</name>
    <trkseg>`;

    for (const [lon, lat] of coordinates) {
      gpx += `
      <trkpt lat="${lat}" lon="${lon}">
        <time>${startDate}</time>
      </trkpt>`;
    }

    gpx += `
    </trkseg>
  </trk>
</gpx>`;

    return gpx;
  }

  /**
   * 獲取分段排行榜
   */
  static async getSegmentLeaderboard(segmentId: number, limit: number = 10): Promise<any[]> {
    try {
      if (!this.accessToken) {
        throw new Error('Not authenticated with Strava');
      }

      const response = await fetch(
        `https://www.strava.com/api/v3/segments/${segmentId}/leaderboard?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch segment leaderboard');
      }

      const data = await response.json();
      return data.entries || [];
    } catch (error) {
      console.error('Failed to get segment leaderboard:', error);
      return [];
    }
  }

  /**
   * 登出
   */
  static async logout(): Promise<void> {
    try {
      this.accessToken = null;
      this.refreshToken = null;
      this.expiresAt = null;

      await AsyncStorage.removeItem(STRAVA_STORAGE_KEY);
      await AsyncStorage.removeItem(STRAVA_ACTIVITIES_KEY);
      await AsyncStorage.removeItem(STRAVA_ATHLETE_KEY);
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  }

  /**
   * 檢查是否已認證
   */
  static isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * 格式化時間
   */
  private static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
