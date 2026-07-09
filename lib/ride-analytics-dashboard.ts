import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RideAnalytics {
  rideId: string;
  date: number;
  distance: number; // 公里
  duration: number; // 秒
  movingTime: number; // 秒
  elevation: number; // 米
  ascent: number; // 米
  descent: number; // 米
  averageSpeed: number; // km/h
  maxSpeed: number; // km/h
  averagePower: number; // 瓦
  maxPower: number; // 瓦
  averageHeartRate: number; // bpm
  maxHeartRate: number; // bpm
  averageCadence: number; // rpm
  maxCadence: number; // rpm
  calories: number;
  tss: number; // Training Stress Score
  powerZones: PowerZoneData[];
  heartRateZones: HeartRateZoneData[];
  splits: RideSplit[];
  weather?: WeatherSnapshot;
}

export interface PowerZoneData {
  zone: number; // 1-7
  name: string;
  timeInZone: number; // 秒
  percentage: number; // 百分比
  avgPower: number; // 瓦
}

export interface HeartRateZoneData {
  zone: number; // 1-5
  name: string;
  timeInZone: number; // 秒
  percentage: number; // 百分比
  avgHeartRate: number; // bpm
}

export interface RideSplit {
  distance: number; // 公里
  time: number; // 秒
  speed: number; // km/h
  power: number; // 瓦
  heartRate: number; // bpm
  elevation: number; // 米
}

export interface WeatherSnapshot {
  temperature: number;
  humidity: number;
  windSpeed: number;
  conditions: string;
}

export interface AnalyticsSummary {
  totalRides: number;
  totalDistance: number; // 公里
  totalTime: number; // 秒
  totalElevation: number; // 米
  averageDistance: number; // 公里
  averageSpeed: number; // km/h
  averagePower: number; // 瓦
  averageHeartRate: number; // bpm
  totalCalories: number;
  totalTSS: number;
  longestRide: RideAnalytics | null;
  hardestRide: RideAnalytics | null;
  fastestRide: RideAnalytics | null;
}

export interface ProgressComparison {
  period: 'week' | 'month' | 'year';
  current: AnalyticsSummary;
  previous: AnalyticsSummary;
  changePercentage: {
    distance: number;
    speed: number;
    power: number;
    heartRate: number;
  };
}

export interface FTPEstimate {
  estimatedFTP: number;
  confidence: number; // 0-100
  lastUpdated: number;
  baselineRide: string; // rideId
}

const ANALYTICS_KEY = 'ride_analytics';
const FTP_ESTIMATE_KEY = 'ftp_estimate';

export class RideAnalyticsDashboard {
  /**
   * 保存騎乘分析
   */
  static async saveRideAnalytics(analytics: RideAnalytics): Promise<void> {
    try {
      const allAnalytics = await this.getAllAnalytics();
      allAnalytics.push(analytics);

      // 按日期排序
      allAnalytics.sort((a, b) => b.date - a.date);

      await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(allAnalytics));
    } catch (error) {
      console.error('Failed to save ride analytics:', error);
    }
  }

  /**
   * 獲取所有分析數據
   */
  static async getAllAnalytics(): Promise<RideAnalytics[]> {
    try {
      const data = await AsyncStorage.getItem(ANALYTICS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all analytics:', error);
      return [];
    }
  }

  /**
   * 獲取分析摘要
   */
  static async getAnalyticsSummary(days: number = 30): Promise<AnalyticsSummary> {
    try {
      const allAnalytics = await this.getAllAnalytics();
      const now = Date.now();
      const cutoff = now - days * 24 * 60 * 60 * 1000;

      const filtered = allAnalytics.filter((a) => a.date >= cutoff);

      if (filtered.length === 0) {
        return {
          totalRides: 0,
          totalDistance: 0,
          totalTime: 0,
          totalElevation: 0,
          averageDistance: 0,
          averageSpeed: 0,
          averagePower: 0,
          averageHeartRate: 0,
          totalCalories: 0,
          totalTSS: 0,
          longestRide: null,
          hardestRide: null,
          fastestRide: null,
        };
      }

      const totalDistance = filtered.reduce((sum, a) => sum + a.distance, 0);
      const totalTime = filtered.reduce((sum, a) => sum + a.duration, 0);
      const totalElevation = filtered.reduce((sum, a) => sum + a.elevation, 0);
      const totalCalories = filtered.reduce((sum, a) => sum + a.calories, 0);
      const totalTSS = filtered.reduce((sum, a) => sum + a.tss, 0);

      const averageDistance = totalDistance / filtered.length;
      const averageSpeed = filtered.reduce((sum, a) => sum + a.averageSpeed, 0) / filtered.length;
      const averagePower = filtered.reduce((sum, a) => sum + a.averagePower, 0) / filtered.length;
      const averageHeartRate = filtered.reduce((sum, a) => sum + a.averageHeartRate, 0) / filtered.length;

      const longestRide = filtered.reduce((max, a) => (a.distance > max.distance ? a : max));
      const hardestRide = filtered.reduce((max, a) => (a.tss > max.tss ? a : max));
      const fastestRide = filtered.reduce((max, a) => (a.maxSpeed > max.maxSpeed ? a : max));

      return {
        totalRides: filtered.length,
        totalDistance,
        totalTime,
        totalElevation,
        averageDistance,
        averageSpeed,
        averagePower,
        averageHeartRate,
        totalCalories,
        totalTSS,
        longestRide,
        hardestRide,
        fastestRide,
      };
    } catch (error) {
      console.error('Failed to get analytics summary:', error);
      throw error;
    }
  }

  /**
   * 獲取進度對比
   */
  static async getProgressComparison(period: 'week' | 'month' | 'year'): Promise<ProgressComparison> {
    try {
      const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;

      const current = await this.getAnalyticsSummary(days);
      const previous = await this.getAnalyticsSummary(days * 2);

      // 計算前一個時期的數據
      const allAnalytics = await this.getAllAnalytics();
      const now = Date.now();
      const currentCutoff = now - days * 24 * 60 * 60 * 1000;
      const previousCutoff = now - days * 2 * 24 * 60 * 60 * 1000;

      const previousPeriodData = allAnalytics.filter(
        (a) => a.date >= previousCutoff && a.date < currentCutoff
      );

      let previousSummary: AnalyticsSummary = {
        totalRides: 0,
        totalDistance: 0,
        totalTime: 0,
        totalElevation: 0,
        averageDistance: 0,
        averageSpeed: 0,
        averagePower: 0,
        averageHeartRate: 0,
        totalCalories: 0,
        totalTSS: 0,
        longestRide: null,
        hardestRide: null,
        fastestRide: null,
      };

      if (previousPeriodData.length > 0) {
        previousSummary = {
          totalRides: previousPeriodData.length,
          totalDistance: previousPeriodData.reduce((sum, a) => sum + a.distance, 0),
          totalTime: previousPeriodData.reduce((sum, a) => sum + a.duration, 0),
          totalElevation: previousPeriodData.reduce((sum, a) => sum + a.elevation, 0),
          averageDistance: previousPeriodData.reduce((sum, a) => sum + a.distance, 0) / previousPeriodData.length,
          averageSpeed: previousPeriodData.reduce((sum, a) => sum + a.averageSpeed, 0) / previousPeriodData.length,
          averagePower: previousPeriodData.reduce((sum, a) => sum + a.averagePower, 0) / previousPeriodData.length,
          averageHeartRate: previousPeriodData.reduce((sum, a) => sum + a.averageHeartRate, 0) / previousPeriodData.length,
          totalCalories: previousPeriodData.reduce((sum, a) => sum + a.calories, 0),
          totalTSS: previousPeriodData.reduce((sum, a) => sum + a.tss, 0),
          longestRide: null,
          hardestRide: null,
          fastestRide: null,
        };
      }

      const changePercentage = {
        distance: previousSummary.totalDistance > 0
          ? ((current.totalDistance - previousSummary.totalDistance) / previousSummary.totalDistance) * 100
          : 0,
        speed: previousSummary.averageSpeed > 0
          ? ((current.averageSpeed - previousSummary.averageSpeed) / previousSummary.averageSpeed) * 100
          : 0,
        power: previousSummary.averagePower > 0
          ? ((current.averagePower - previousSummary.averagePower) / previousSummary.averagePower) * 100
          : 0,
        heartRate: previousSummary.averageHeartRate > 0
          ? ((current.averageHeartRate - previousSummary.averageHeartRate) / previousSummary.averageHeartRate) * 100
          : 0,
      };

      return {
        period,
        current,
        previous: previousSummary,
        changePercentage,
      };
    } catch (error) {
      console.error('Failed to get progress comparison:', error);
      throw error;
    }
  }

  /**
   * 估算 FTP
   */
  static async estimateFTP(rideAnalytics: RideAnalytics): Promise<FTPEstimate> {
    try {
      // 使用 20 分鐘平均功率的 95% 作為 FTP 估算
      const twentyMinutePower = rideAnalytics.averagePower * 0.95;

      const estimate: FTPEstimate = {
        estimatedFTP: Math.round(twentyMinutePower),
        confidence: Math.min(100, (rideAnalytics.duration / 1200) * 100), // 基於騎乘時間
        lastUpdated: Date.now(),
        baselineRide: rideAnalytics.rideId,
      };

      // 保存估算
      await AsyncStorage.setItem(FTP_ESTIMATE_KEY, JSON.stringify(estimate));

      return estimate;
    } catch (error) {
      console.error('Failed to estimate FTP:', error);
      throw error;
    }
  }

  /**
   * 獲取 FTP 估算
   */
  static async getFTPEstimate(): Promise<FTPEstimate | null> {
    try {
      const data = await AsyncStorage.getItem(FTP_ESTIMATE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get FTP estimate:', error);
      return null;
    }
  }

  /**
   * 計算功率區間
   */
  static calculatePowerZones(ftp: number, rideData: any[]): PowerZoneData[] {
    const zones = [
      { zone: 1, name: '恢復', min: 0, max: 0.55 },
      { zone: 2, name: '耐力', min: 0.55, max: 0.75 },
      { zone: 3, name: '節奏', min: 0.75, max: 0.9 },
      { zone: 4, name: '閾值', min: 0.9, max: 1.05 },
      { zone: 5, name: '無氧', min: 1.05, max: 1.2 },
      { zone: 6, name: '最大', min: 1.2, max: Infinity },
    ];

    const zoneData: PowerZoneData[] = zones.map((zone) => ({
      zone: zone.zone,
      name: zone.name,
      timeInZone: 0,
      percentage: 0,
      avgPower: 0,
    }));

    let totalTime = 0;
    const zoneTotals: { [key: number]: { time: number; power: number; count: number } } = {};

    for (const data of rideData) {
      const power = data.power || 0;
      const percentage = power / ftp;

      for (const zone of zones) {
        if (percentage >= zone.min && percentage < zone.max) {
          if (!zoneTotals[zone.zone]) {
            zoneTotals[zone.zone] = { time: 0, power: 0, count: 0 };
          }
          zoneTotals[zone.zone].time += 1;
          zoneTotals[zone.zone].power += power;
          zoneTotals[zone.zone].count += 1;
          totalTime += 1;
          break;
        }
      }
    }

    return zoneData.map((zone) => ({
      ...zone,
      timeInZone: zoneTotals[zone.zone]?.time || 0,
      percentage: totalTime > 0 ? ((zoneTotals[zone.zone]?.time || 0) / totalTime) * 100 : 0,
      avgPower: zoneTotals[zone.zone]?.count ? zoneTotals[zone.zone].power / zoneTotals[zone.zone].count : 0,
    }));
  }

  /**
   * 計算心率區間
   */
  static calculateHeartRateZones(maxHeartRate: number, rideData: any[]): HeartRateZoneData[] {
    const zones = [
      { zone: 1, name: '恢復', min: 0, max: 0.5 },
      { zone: 2, name: '耐力', min: 0.5, max: 0.7 },
      { zone: 3, name: '節奏', min: 0.7, max: 0.85 },
      { zone: 4, name: '閾值', min: 0.85, max: 0.95 },
      { zone: 5, name: '最大', min: 0.95, max: Infinity },
    ];

    const zoneData: HeartRateZoneData[] = zones.map((zone) => ({
      zone: zone.zone,
      name: zone.name,
      timeInZone: 0,
      percentage: 0,
      avgHeartRate: 0,
    }));

    let totalTime = 0;
    const zoneTotals: { [key: number]: { time: number; heartRate: number; count: number } } = {};

    for (const data of rideData) {
      const heartRate = data.heartRate || 0;
      const percentage = heartRate / maxHeartRate;

      for (const zone of zones) {
        if (percentage >= zone.min && percentage < zone.max) {
          if (!zoneTotals[zone.zone]) {
            zoneTotals[zone.zone] = { time: 0, heartRate: 0, count: 0 };
          }
          zoneTotals[zone.zone].time += 1;
          zoneTotals[zone.zone].heartRate += heartRate;
          zoneTotals[zone.zone].count += 1;
          totalTime += 1;
          break;
        }
      }
    }

    return zoneData.map((zone) => ({
      ...zone,
      timeInZone: zoneTotals[zone.zone]?.time || 0,
      percentage: totalTime > 0 ? ((zoneTotals[zone.zone]?.time || 0) / totalTime) * 100 : 0,
      avgHeartRate: zoneTotals[zone.zone]?.count ? zoneTotals[zone.zone].heartRate / zoneTotals[zone.zone].count : 0,
    }));
  }

  /**
   * 計算 TSS (Training Stress Score)
   */
  static calculateTSS(ftp: number, averagePower: number, durationMinutes: number): number {
    const normalizedPower = averagePower;
    const intensityFactor = normalizedPower / ftp;
    const tss = (durationMinutes * intensityFactor * intensityFactor * 100) / 36;
    return Math.round(tss);
  }

  /**
   * 獲取騎乘趨勢
   */
  static async getRidingTrends(days: number = 30): Promise<any[]> {
    try {
      const allAnalytics = await this.getAllAnalytics();
      const now = Date.now();
      const cutoff = now - days * 24 * 60 * 60 * 1000;

      const filtered = allAnalytics.filter((a) => a.date >= cutoff);

      // 按日期分組
      const grouped: { [key: string]: RideAnalytics[] } = {};
      for (const analytics of filtered) {
        const date = new Date(analytics.date).toISOString().split('T')[0];
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(analytics);
      }

      // 生成趨勢數據
      return Object.entries(grouped).map(([date, rides]) => ({
        date,
        rideCount: rides.length,
        totalDistance: rides.reduce((sum, r) => sum + r.distance, 0),
        totalTime: rides.reduce((sum, r) => sum + r.duration, 0),
        totalElevation: rides.reduce((sum, r) => sum + r.elevation, 0),
        averagePower: rides.reduce((sum, r) => sum + r.averagePower, 0) / rides.length,
      }));
    } catch (error) {
      console.error('Failed to get riding trends:', error);
      return [];
    }
  }
}
