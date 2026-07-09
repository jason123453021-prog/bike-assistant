import { Feature, LineString, Point } from 'geojson';
import * as turf from '@turf/turf';
import { PowerCalculator, RiderProfile, EnvironmentalConditions } from './power-calculator';
import { RideRecordManager, type RideRecord } from './ride-record-manager';

export interface RideSessionData {
  startTime: number;
  currentTime: number;
  duration: number; // 秒
  distance: number; // 米
  track: Feature<LineString>;
  speeds: number[]; // km/h
  powers: number[]; // 瓦
  elevations: number[]; // 米
  pausedDuration: number; // 秒
  isPaused: boolean;
}

export class RideSessionManager {
  private static sessionData: RideSessionData | null = null;
  private static riderProfile: RiderProfile | null = null;
  private static environmentalConditions: EnvironmentalConditions | null = null;

  /**
   * 開始騎乘會話
   * @param riderProfile 騎手資料
   * @param conditions 環境條件
   */
  static startSession(riderProfile: RiderProfile, conditions: EnvironmentalConditions): void {
    const now = Date.now();
    this.sessionData = {
      startTime: now,
      currentTime: now,
      duration: 0,
      distance: 0,
      track: turf.lineString([]),
      speeds: [],
      powers: [],
      elevations: [],
      pausedDuration: 0,
      isPaused: false,
    };

    this.riderProfile = riderProfile;
    this.environmentalConditions = conditions;
  }

  /**
   * 更新騎乘數據
   * @param location 當前位置
   * @param speed 速度 (km/h)
   * @param elevation 海拔 (米)
   * @param heading 方向 (度)
   */
  static updateRideData(
    location: Feature<Point>,
    speed: number,
    elevation: number,
    heading: number = 0
  ): void {
    if (!this.sessionData || !this.riderProfile || !this.environmentalConditions) {
      console.warn('Ride session not started');
      return;
    }

    const now = Date.now();
    const timeDelta = (now - this.sessionData.currentTime) / 1000; // 秒

    // 更新時間
    this.sessionData.currentTime = now;
    if (!this.sessionData.isPaused) {
      this.sessionData.duration += timeDelta;
    }

    // 更新距離
    const coords = this.sessionData.track.geometry.coordinates as [number, number][];
    if (coords.length > 0) {
      const lastPoint = turf.point(coords[coords.length - 1]);
      const distance = turf.distance(lastPoint, location, { units: 'meters' });
      this.sessionData.distance += distance;
    }

    // 更新軌跡
    const newCoords = [...coords, location.geometry.coordinates as [number, number]];
    this.sessionData.track = turf.lineString(newCoords);

    // 計算坡度
    let grade = 0;
    if (coords.length > 0) {
      const lastElevation = this.sessionData.elevations[this.sessionData.elevations.length - 1] || elevation;
      const elevationDelta = elevation - lastElevation;
      const distanceDelta = this.sessionData.distance > 0 ? 
        turf.distance(turf.point(coords[coords.length - 1]), location, { units: 'meters' }) : 0;
      
      if (distanceDelta > 0) {
        grade = (elevationDelta / distanceDelta) * 100;
      }
    }

    // 計算功率
    const power = PowerCalculator.calculatePower(
      speed,
      grade,
      this.riderProfile,
      this.environmentalConditions,
      heading
    );

    // 記錄數據
    this.sessionData.speeds.push(speed);
    this.sessionData.powers.push(power);
    this.sessionData.elevations.push(elevation);
  }

  /**
   * 暫停騎乘
   */
  static pauseSession(): void {
    if (this.sessionData) {
      this.sessionData.isPaused = true;
    }
  }

  /**
   * 恢復騎乘
   */
  static resumeSession(): void {
    if (this.sessionData) {
      this.sessionData.isPaused = false;
      this.sessionData.currentTime = Date.now();
    }
  }

  /**
   * 結束騎乘並保存記錄
   * @param notes 備註
   * @param weather 天氣數據
   * @returns 記錄 ID
   */
  static async endSession(notes?: string, weather?: any): Promise<string | null> {
    if (!this.sessionData) {
      console.warn('No active ride session');
      return null;
    }

    try {
      const speeds = this.sessionData.speeds.filter((s) => s > 0);
      const powers = this.sessionData.powers.filter((p) => p > 0);

      const record: Omit<RideRecord, 'id'> = {
        startTime: this.sessionData.startTime,
        endTime: Date.now(),
        duration: this.sessionData.duration,
        distance: this.sessionData.distance,
        averageSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b) / speeds.length : 0,
        maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
        averagePower: powers.length > 0 ? powers.reduce((a, b) => a + b) / powers.length : 0,
        maxPower: powers.length > 0 ? Math.max(...powers) : 0,
        calories: PowerCalculator.calculateCalories(
          powers.length > 0 ? powers.reduce((a, b) => a + b) / powers.length : 0,
          this.sessionData.duration / 60,
          this.riderProfile?.weight || 70
        ),
        elevation: Math.max(...this.sessionData.elevations) - Math.min(...this.sessionData.elevations),
        track: this.sessionData.track,
        weather,
        notes,
      };

      const recordId = await RideRecordManager.saveRideRecord(record);

      // 清空會話
      this.sessionData = null;
      this.riderProfile = null;
      this.environmentalConditions = null;

      return recordId;
    } catch (error) {
      console.error('Failed to end ride session:', error);
      return null;
    }
  }

  /**
   * 獲取當前會話數據
   * @returns 會話數據或 null
   */
  static getSessionData(): RideSessionData | null {
    return this.sessionData;
  }

  /**
   * 獲取當前統計數據
   * @returns 統計數據
   */
  static getSessionStats() {
    if (!this.sessionData) return null;

    const speeds = this.sessionData.speeds.filter((s) => s > 0);
    const powers = this.sessionData.powers.filter((p) => p > 0);

    return {
      duration: this.sessionData.duration,
      distance: this.sessionData.distance,
      averageSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b) / speeds.length : 0,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
      averagePower: powers.length > 0 ? powers.reduce((a, b) => a + b) / powers.length : 0,
      maxPower: powers.length > 0 ? Math.max(...powers) : 0,
      elevation: Math.max(...this.sessionData.elevations) - Math.min(...this.sessionData.elevations),
    };
  }

  /**
   * 檢查是否有活躍會話
   * @returns 是否有活躍會話
   */
  static hasActiveSession(): boolean {
    return this.sessionData !== null;
  }

  /**
   * 取消會話
   */
  static cancelSession(): void {
    this.sessionData = null;
    this.riderProfile = null;
    this.environmentalConditions = null;
  }
}
