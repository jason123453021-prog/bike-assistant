import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BuddyLocation {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  altitude: number;
  timestamp: number;
  isRiding: boolean;
}

export interface BuddyStatus {
  userId: string;
  userName: string;
  userAvatar?: string;
  currentLocation: BuddyLocation;
  distance: number; // 與當前用戶的距離（米）
  direction: string; // 方向（北、東、南、西等）
  estimatedTimeToMeet: number; // 預計相遇時間（秒）
  status: 'riding' | 'stopped' | 'offline';
  lastUpdate: number;
}

export interface TeamSession {
  id: string;
  name: string;
  members: string[];
  createdAt: number;
  startTime?: number;
  endTime?: number;
  isActive: boolean;
  route?: { lat: number; lon: number }[];
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  userName: string;
  type: 'crash' | 'mechanical' | 'medical' | 'lost';
  location: { lat: number; lon: number };
  message: string;
  timestamp: number;
  responders: string[];
}

const BUDDY_LOCATIONS_KEY = 'buddy_locations';
const TEAM_SESSIONS_KEY = 'team_sessions';
const EMERGENCY_ALERTS_KEY = 'emergency_alerts';
const TRACKING_SETTINGS_KEY = 'tracking_settings';

export class RealTimeBuddyTracking {
  private static updateInterval: any = null;

  /**
   * 開始追蹤模式
   */
  static async startTracking(userId: string, userName: string): Promise<void> {
    try {
      // 保存追蹤設定
      const settings = {
        userId,
        userName,
        isTracking: true,
        startTime: Date.now(),
        shareLocation: true,
        shareSpeed: true,
        shareAltitude: true,
      };

      await AsyncStorage.setItem(TRACKING_SETTINGS_KEY, JSON.stringify(settings));

      // 啟動定期位置更新
      this.startLocationUpdates();
    } catch (error) {
      console.error('Failed to start tracking:', error);
    }
  }

  /**
   * 停止追蹤模式
   */
  static async stopTracking(): Promise<void> {
    try {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      const settings = await AsyncStorage.getItem(TRACKING_SETTINGS_KEY);
      if (settings) {
        const parsed = JSON.parse(settings);
        parsed.isTracking = false;
        await AsyncStorage.setItem(TRACKING_SETTINGS_KEY, JSON.stringify(parsed));
      }
    } catch (error) {
      console.error('Failed to stop tracking:', error);
    }
  }

  /**
   * 更新當前位置
   */
  static async updateLocation(
    userId: string,
    latitude: number,
    longitude: number,
    speed: number,
    heading: number,
    altitude: number,
    isRiding: boolean
  ): Promise<void> {
    try {
      const location: BuddyLocation = {
        userId,
        userName: '',
        latitude,
        longitude,
        speed,
        heading,
        altitude,
        timestamp: Date.now(),
        isRiding,
      };

      // 保存位置
      const locations = await this.getAllLocations();
      const existingIndex = locations.findIndex((l) => l.userId === userId);

      if (existingIndex >= 0) {
        locations[existingIndex] = location;
      } else {
        locations.push(location);
      }

      await AsyncStorage.setItem(BUDDY_LOCATIONS_KEY, JSON.stringify(locations));
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  }

  /**
   * 獲取隊友狀態
   */
  static async getBuddyStatus(
    buddyId: string,
    currentLat: number,
    currentLon: number
  ): Promise<BuddyStatus | null> {
    try {
      const locations = await this.getAllLocations();
      const buddyLocation = locations.find((l) => l.userId === buddyId);

      if (!buddyLocation) return null;

      const distance = this.calculateDistance(currentLat, currentLon, buddyLocation.latitude, buddyLocation.longitude);
      const direction = this.calculateDirection(currentLat, currentLon, buddyLocation.latitude, buddyLocation.longitude);
      const estimatedTimeToMeet = this.estimateTimeToMeet(distance, buddyLocation.speed);

      return {
        userId: buddyId,
        userName: buddyLocation.userName,
        currentLocation: buddyLocation,
        distance,
        direction,
        estimatedTimeToMeet,
        status: buddyLocation.isRiding ? 'riding' : 'stopped',
        lastUpdate: buddyLocation.timestamp,
      };
    } catch (error) {
      console.error('Failed to get buddy status:', error);
      return null;
    }
  }

  /**
   * 獲取所有隊友狀態
   */
  static async getAllBuddiesStatus(
    currentLat: number,
    currentLon: number,
    buddyIds: string[]
  ): Promise<BuddyStatus[]> {
    try {
      const statuses: BuddyStatus[] = [];

      for (const buddyId of buddyIds) {
        const status = await this.getBuddyStatus(buddyId, currentLat, currentLon);
        if (status) {
          statuses.push(status);
        }
      }

      return statuses.sort((a, b) => a.distance - b.distance);
    } catch (error) {
      console.error('Failed to get all buddies status:', error);
      return [];
    }
  }

  /**
   * 創建隊伍會話
   */
  static async createTeamSession(
    teamName: string,
    memberIds: string[]
  ): Promise<TeamSession> {
    try {
      const session: TeamSession = {
        id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: teamName,
        members: memberIds,
        createdAt: Date.now(),
        isActive: true,
      };

      const sessions = await this.getAllTeamSessions();
      sessions.push(session);
      await AsyncStorage.setItem(TEAM_SESSIONS_KEY, JSON.stringify(sessions));

      return session;
    } catch (error) {
      console.error('Failed to create team session:', error);
      throw error;
    }
  }

  /**
   * 結束隊伍會話
   */
  static async endTeamSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getAllTeamSessions();
      const session = sessions.find((s) => s.id === sessionId);

      if (session) {
        session.isActive = false;
        session.endTime = Date.now();
        await AsyncStorage.setItem(TEAM_SESSIONS_KEY, JSON.stringify(sessions));
      }
    } catch (error) {
      console.error('Failed to end team session:', error);
    }
  }

  /**
   * 獲取所有隊伍會話
   */
  static async getAllTeamSessions(): Promise<TeamSession[]> {
    try {
      const data = await AsyncStorage.getItem(TEAM_SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all team sessions:', error);
      return [];
    }
  }

  /**
   * 發送緊急警報
   */
  static async sendEmergencyAlert(
    userId: string,
    userName: string,
    type: 'crash' | 'mechanical' | 'medical' | 'lost',
    location: { lat: number; lon: number },
    message: string
  ): Promise<EmergencyAlert> {
    try {
      const alert: EmergencyAlert = {
        id: `alert_${Date.now()}`,
        userId,
        userName,
        type,
        location,
        message,
        timestamp: Date.now(),
        responders: [],
      };

      const alerts = await this.getAllEmergencyAlerts();
      alerts.push(alert);
      await AsyncStorage.setItem(EMERGENCY_ALERTS_KEY, JSON.stringify(alerts));

      // 通知隊友
      await this.notifyTeammates(alert);

      return alert;
    } catch (error) {
      console.error('Failed to send emergency alert:', error);
      throw error;
    }
  }

  /**
   * 回應緊急警報
   */
  static async respondToEmergency(alertId: string, responderId: string): Promise<void> {
    try {
      const alerts = await this.getAllEmergencyAlerts();
      const alert = alerts.find((a) => a.id === alertId);

      if (alert && !alert.responders.includes(responderId)) {
        alert.responders.push(responderId);
        await AsyncStorage.setItem(EMERGENCY_ALERTS_KEY, JSON.stringify(alerts));
      }
    } catch (error) {
      console.error('Failed to respond to emergency:', error);
    }
  }

  /**
   * 獲取所有緊急警報
   */
  static async getAllEmergencyAlerts(): Promise<EmergencyAlert[]> {
    try {
      const data = await AsyncStorage.getItem(EMERGENCY_ALERTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all emergency alerts:', error);
      return [];
    }
  }

  /**
   * 啟動位置更新
   */
  private static startLocationUpdates(): void {
    if (typeof setInterval !== 'undefined') {
      this.updateInterval = setInterval(() => {
        // 模擬位置更新
        console.log('Location update interval triggered');
      }, 5000); // 每 5 秒更新一次
    }
  }

  /**
   * 計算距離（米）
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // 地球半徑（米）
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 計算方向
   */
  private static calculateDirection(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): string {
    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    const normalizedBearing = (bearing + 360) % 360;

    if (normalizedBearing < 45 || normalizedBearing >= 315) return '北';
    if (normalizedBearing < 135) return '東';
    if (normalizedBearing < 225) return '南';
    return '西';
  }

  /**
   * 估計相遇時間（秒）
   */
  private static estimateTimeToMeet(distance: number, speed: number): number {
    if (speed === 0) return Infinity;
    return Math.round(distance / speed);
  }

  /**
   * 通知隊友
   */
  private static async notifyTeammates(alert: EmergencyAlert): Promise<void> {
    try {
      const sessions = await this.getAllTeamSessions();
      const activeSession = sessions.find((s) => s.isActive);

      if (activeSession) {
        console.log(`Notifying team members about ${alert.type} emergency`);
        // 實際應用中應發送推送通知
      }
    } catch (error) {
      console.error('Failed to notify teammates:', error);
    }
  }

  /**
   * 獲取所有位置
   */
  private static async getAllLocations(): Promise<BuddyLocation[]> {
    try {
      const data = await AsyncStorage.getItem(BUDDY_LOCATIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all locations:', error);
      return [];
    }
  }
}
