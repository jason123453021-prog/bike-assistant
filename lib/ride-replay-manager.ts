import AsyncStorage from '@react-native-async-storage/async-storage';
import { RideAnalytics, RideSplit } from './ride-analytics-dashboard';

export interface ReplayFrame {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  power: number;
  heartRate: number;
  cadence: number;
  distance: number;
  elevation: number;
}

export interface ReplaySession {
  rideId: string;
  frames: ReplayFrame[];
  totalDuration: number; // 秒
  totalDistance: number; // 公里
  startTime: number;
  endTime: number;
  playbackSpeed: number; // 1 = 正常速度
  currentFrame: number;
  isPlaying: boolean;
}

const REPLAY_SESSIONS_KEY = 'replay_sessions';

export class RideReplayManager {
  private static replaySessions: Map<string, ReplaySession> = new Map();

  /**
   * 從騎乘分析數據生成回放幀
   */
  static generateReplayFrames(analytics: RideAnalytics): ReplayFrame[] {
    const frames: ReplayFrame[] = [];
    const durationSeconds = analytics.duration;
    const frameInterval = Math.max(1, Math.floor(durationSeconds / 1000)); // 每秒生成一幀

    let currentDistance = 0;
    let currentElevation = 0;

    // 使用模擬的起點和終點
    const startLat = 25.0330;
    const startLon = 121.5654;
    const endLat = 25.0430;
    const endLon = 121.5754;

    for (let i = 0; i < durationSeconds; i += frameInterval) {
      const progress = i / durationSeconds;
      const [lat, lon] = this.interpolateCoordinates(
        startLat,
        startLon,
        endLat,
        endLon,
        progress
      );

      currentDistance = (analytics.distance || 0) * progress;
      currentElevation = (analytics.elevation || 0) * progress;

      const frame: ReplayFrame = {
        timestamp: i,
        latitude: lat,
        longitude: lon,
        altitude: currentElevation,
        speed: this.interpolateValue(0, analytics.maxSpeed, progress),
        power: this.interpolateValue(0, analytics.maxPower, progress),
        heartRate: this.interpolateValue(0, analytics.maxHeartRate, progress),
        cadence: this.interpolateValue(0, analytics.averageCadence, progress),
        distance: currentDistance,
        elevation: currentElevation,
      };

      frames.push(frame);
    }

    return frames;
  }

  /**
   * 創建回放會話
   */
  static createReplaySession(rideId: string, analytics: RideAnalytics): ReplaySession {
    const frames = this.generateReplayFrames(analytics);

    const session: ReplaySession = {
      rideId,
      frames,
      totalDuration: analytics.duration,
      totalDistance: analytics.distance,
      startTime: analytics.date,
      endTime: analytics.date + analytics.duration * 1000,
      playbackSpeed: 1,
      currentFrame: 0,
      isPlaying: false,
    };

    this.replaySessions.set(rideId, session);
    return session;
  }

  /**
   * 獲取回放會話
   */
  static getReplaySession(rideId: string): ReplaySession | null {
    return this.replaySessions.get(rideId) || null;
  }

  /**
   * 開始播放
   */
  static startPlayback(rideId: string): boolean {
    const session = this.replaySessions.get(rideId);
    if (!session) return false;

    session.isPlaying = true;
    return true;
  }

  /**
   * 暫停播放
   */
  static pausePlayback(rideId: string): boolean {
    const session = this.replaySessions.get(rideId);
    if (!session) return false;

    session.isPlaying = false;
    return true;
  }

  /**
   * 停止播放
   */
  static stopPlayback(rideId: string): boolean {
    const session = this.replaySessions.get(rideId);
    if (!session) return false;

    session.isPlaying = false;
    session.currentFrame = 0;
    return true;
  }

  /**
   * 設置播放速度
   */
  static setPlaybackSpeed(rideId: string, speed: number): boolean {
    const session = this.replaySessions.get(rideId);
    if (!session) return false;

    session.playbackSpeed = Math.max(0.25, Math.min(4, speed)); // 0.25x - 4x
    return true;
  }

  /**
   * 跳轉到特定時間
   */
  static seekToTime(rideId: string, timeSeconds: number): boolean {
    const session = this.replaySessions.get(rideId);
    if (!session) return false;

    const frameIndex = Math.floor((timeSeconds / session.totalDuration) * session.frames.length);
    session.currentFrame = Math.max(0, Math.min(frameIndex, session.frames.length - 1));
    return true;
  }

  /**
   * 跳轉到特定距離
   */
  static seekToDistance(rideId: string, distanceKm: number): boolean {
    const session = this.replaySessions.get(rideId);
    if (!session) return false;

    const frameIndex = Math.floor(
      (distanceKm / session.totalDistance) * session.frames.length
    );
    session.currentFrame = Math.max(0, Math.min(frameIndex, session.frames.length - 1));
    return true;
  }

  /**
   * 獲取當前幀
   */
  static getCurrentFrame(rideId: string): ReplayFrame | null {
    const session = this.replaySessions.get(rideId);
    if (!session) return null;

    return session.frames[session.currentFrame] || null;
  }

  /**
   * 獲取下一幀
   */
  static getNextFrame(rideId: string): ReplayFrame | null {
    const session = this.replaySessions.get(rideId);
    if (!session) return null;

    if (session.currentFrame < session.frames.length - 1) {
      session.currentFrame++;
    } else {
      session.isPlaying = false; // 播放完成
    }

    return session.frames[session.currentFrame] || null;
  }

  /**
   * 獲取進度百分比
   */
  static getProgressPercentage(rideId: string): number {
    const session = this.replaySessions.get(rideId);
    if (!session) return 0;

    return (session.currentFrame / session.frames.length) * 100;
  }

  /**
   * 獲取當前播放時間
   */
  static getCurrentPlaybackTime(rideId: string): number {
    const session = this.replaySessions.get(rideId);
    if (!session) return 0;

    const frame = session.frames[session.currentFrame];
    return frame ? frame.timestamp : 0;
  }

  /**
   * 獲取統計信息
   */
  static getReplayStats(rideId: string) {
    const session = this.replaySessions.get(rideId);
    if (!session) return null;

    const frames = session.frames;
    const maxSpeed = Math.max(...frames.map((f) => f.speed));
    const maxPower = Math.max(...frames.map((f) => f.power));
    const maxHeartRate = Math.max(...frames.map((f) => f.heartRate));
    const avgSpeed = frames.reduce((sum, f) => sum + f.speed, 0) / frames.length;
    const avgPower = frames.reduce((sum, f) => sum + f.power, 0) / frames.length;
    const avgHeartRate = frames.reduce((sum, f) => sum + f.heartRate, 0) / frames.length;

    return {
      maxSpeed,
      maxPower,
      maxHeartRate,
      avgSpeed,
      avgPower,
      avgHeartRate,
      totalFrames: frames.length,
      currentFrame: session.currentFrame,
    };
  }

  /**
   * 獲取軌跡線
   */
  static getTrackLine(rideId: string): Array<{ latitude: number; longitude: number }> {
    const session = this.replaySessions.get(rideId);
    if (!session) return [];

    return session.frames.map((f) => ({
      latitude: f.latitude,
      longitude: f.longitude,
    }));
  }

  /**
   * 獲取已播放軌跡
   */
  static getPlayedTrack(rideId: string): Array<{ latitude: number; longitude: number }> {
    const session = this.replaySessions.get(rideId);
    if (!session) return [];

    return session.frames.slice(0, session.currentFrame + 1).map((f) => ({
      latitude: f.latitude,
      longitude: f.longitude,
    }));
  }

  /**
   * 插值坐標
   */
  private static interpolateCoordinates(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    progress: number
  ): [number, number] {
    return [
      lat1 + (lat2 - lat1) * progress,
      lon1 + (lon2 - lon1) * progress,
    ];
  }

  /**
   * 插值數值
   */
  private static interpolateValue(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }

  /**
   * 清理會話
   */
  static clearSession(rideId: string): void {
    this.replaySessions.delete(rideId);
  }

  /**
   * 清理所有會話
   */
  static clearAllSessions(): void {
    this.replaySessions.clear();
  }
}
