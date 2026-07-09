import AsyncStorage from '@react-native-async-storage/async-storage';
import { RideAnalytics } from './ride-analytics-dashboard';

export interface PerformanceBenchmark {
  id: string;
  userId: string;
  rideId: string;
  distance: number;
  duration: number;
  elevation: number;
  avgSpeed: number;
  maxSpeed: number;
  avgPower: number;
  maxPower: number;
  avgHeartRate: number;
  maxHeartRate: number;
  date: number;
  terrain: string;
  conditions: string;
}

export interface BenchmarkComparison {
  personalBest: PerformanceBenchmark | null;
  globalRank: number;
  globalTotal: number;
  regionRank: number;
  regionTotal: number;
  progressPercentage: number; // 相比個人最佳的進度百分比
  improvementTrend: number; // -1 到 1
  similarRides: PerformanceBenchmark[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  value: number;
  unit: string;
  date: number;
  badge?: string;
}

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
  unlockedAt?: number;
}

const BENCHMARKS_KEY = 'performance_benchmarks';
const LEADERBOARD_KEY = 'leaderboard_data';
const ACHIEVEMENTS_KEY = 'achievements';

export class RidePerformanceBenchmark {
  /**
   * 記錄騎乘成績
   */
  static async recordBenchmark(
    userId: string,
    rideId: string,
    analytics: RideAnalytics,
    terrain: string,
    conditions: string
  ): Promise<PerformanceBenchmark> {
    try {
      const benchmark: PerformanceBenchmark = {
        id: `bench_${Date.now()}`,
        userId,
        rideId,
        distance: analytics.distance || 0,
        duration: analytics.duration || 0,
        elevation: analytics.elevation || 0,
        avgSpeed: analytics.averageSpeed || 0,
        maxSpeed: analytics.maxSpeed || 0,
        avgPower: analytics.averagePower || 0,
        maxPower: analytics.maxPower || 0,
        avgHeartRate: analytics.averageHeartRate || 0,
        maxHeartRate: analytics.maxHeartRate || 0,
        date: Date.now(),
        terrain,
        conditions,
      };

      // 保存成績
      const benchmarks = await this.getAllBenchmarks();
      benchmarks.push(benchmark);
      await AsyncStorage.setItem(BENCHMARKS_KEY, JSON.stringify(benchmarks));

      // 檢查成就
      await this.checkAchievements(userId, benchmark);

      return benchmark;
    } catch (error) {
      console.error('Failed to record benchmark:', error);
      throw error;
    }
  }

  /**
   * 獲取成績對標
   */
  static async getBenchmarkComparison(
    userId: string,
    distance: number,
    terrain: string
  ): Promise<BenchmarkComparison> {
    try {
      const benchmarks = await this.getAllBenchmarks();

      // 找到個人最佳成績
      const userBenchmarks = benchmarks.filter(
        (b) => b.userId === userId && Math.abs(b.distance - distance) < 5 && b.terrain === terrain
      );
      const personalBest = userBenchmarks.length > 0 ? userBenchmarks[0] : null;

      // 全球排名
      const allBenchmarks = benchmarks.filter(
        (b) => Math.abs(b.distance - distance) < 5 && b.terrain === terrain
      );
      const sortedBySpeed = allBenchmarks.sort((a, b) => b.avgSpeed - a.avgSpeed);
      const globalRank = sortedBySpeed.findIndex((b) => b.userId === userId) + 1;

      // 地區排名（模擬）
      const regionBenchmarks = allBenchmarks.slice(0, Math.ceil(allBenchmarks.length * 0.3));
      const regionRank = regionBenchmarks.findIndex((b) => b.userId === userId) + 1;

      // 進度百分比
      let progressPercentage = 0;
      if (personalBest && userBenchmarks.length > 1) {
        const latestBench = userBenchmarks[userBenchmarks.length - 1];
        progressPercentage = ((latestBench.avgSpeed - personalBest.avgSpeed) / personalBest.avgSpeed) * 100;
      }

      // 進度趨勢
      const improvementTrend = progressPercentage > 0 ? Math.min(1, progressPercentage / 10) : Math.max(-1, progressPercentage / 10);

      // 相似騎乘
      const similarRides = allBenchmarks.filter((b) => b.userId !== userId).slice(0, 5);

      return {
        personalBest,
        globalRank,
        globalTotal: allBenchmarks.length,
        regionRank,
        regionTotal: regionBenchmarks.length,
        progressPercentage,
        improvementTrend,
        similarRides,
      };
    } catch (error) {
      console.error('Failed to get benchmark comparison:', error);
      return {
        personalBest: null,
        globalRank: 0,
        globalTotal: 0,
        regionRank: 0,
        regionTotal: 0,
        progressPercentage: 0,
        improvementTrend: 0,
        similarRides: [],
      };
    }
  }

  /**
   * 獲取排行榜
   */
  static async getLeaderboard(
    metric: 'distance' | 'speed' | 'power' | 'elevation' | 'duration',
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    try {
      const benchmarks = await this.getAllBenchmarks();

      let sortedBenchmarks = benchmarks;
      let unit = '';

      if (metric === 'distance') {
        sortedBenchmarks = benchmarks.sort((a, b) => b.distance - a.distance);
        unit = 'km';
      } else if (metric === 'speed') {
        sortedBenchmarks = benchmarks.sort((a, b) => b.avgSpeed - a.avgSpeed);
        unit = 'km/h';
      } else if (metric === 'power') {
        sortedBenchmarks = benchmarks.sort((a, b) => b.avgPower - a.avgPower);
        unit = 'W';
      } else if (metric === 'elevation') {
        sortedBenchmarks = benchmarks.sort((a, b) => b.elevation - a.elevation);
        unit = 'm';
      } else if (metric === 'duration') {
        sortedBenchmarks = benchmarks.sort((a, b) => b.duration - a.duration);
        unit = 'min';
      }

      const leaderboard: LeaderboardEntry[] = sortedBenchmarks.slice(0, limit).map((b, index) => ({
        rank: index + 1,
        userId: b.userId,
        userName: `User ${b.userId.substring(0, 8)}`,
        value: metric === 'distance' ? b.distance : metric === 'speed' ? b.avgSpeed : metric === 'power' ? b.avgPower : metric === 'elevation' ? b.elevation : b.duration / 60,
        unit,
        date: b.date,
        badge: index < 3 ? ['🥇', '🥈', '🥉'][index] : undefined,
      }));

      return leaderboard;
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  /**
   * 獲取進度對比
   */
  static async getProgressComparison(userId: string, days: number = 30): Promise<any[]> {
    try {
      const benchmarks = await this.getAllBenchmarks();
      const userBenchmarks = benchmarks.filter((b) => b.userId === userId);

      const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;
      const recentBenchmarks = userBenchmarks.filter((b) => b.date > cutoffDate);

      // 按日期分組
      const grouped: { [key: string]: PerformanceBenchmark[] } = {};
      recentBenchmarks.forEach((b) => {
        const dateStr = new Date(b.date).toISOString().split('T')[0];
        if (!grouped[dateStr]) {
          grouped[dateStr] = [];
        }
        grouped[dateStr].push(b);
      });

      // 計算每日統計
      const progressData = Object.entries(grouped).map(([date, rides]) => ({
        date,
        totalDistance: rides.reduce((sum, r) => sum + r.distance, 0),
        avgSpeed: rides.reduce((sum, r) => sum + r.avgSpeed, 0) / rides.length,
        avgPower: rides.reduce((sum, r) => sum + r.avgPower, 0) / rides.length,
        rideCount: rides.length,
      }));

      return progressData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('Failed to get progress comparison:', error);
      return [];
    }
  }

  /**
   * 檢查成就
   */
  private static async checkAchievements(userId: string, benchmark: PerformanceBenchmark): Promise<void> {
    try {
      const achievements = await this.getAllAchievements();
      const userAchievements = achievements.filter((a) => a.unlockedAt !== undefined);

      // 檢查各種成就條件
      const newAchievements: AchievementBadge[] = [];

      // 100km 成就
      if (benchmark.distance >= 100 && !userAchievements.find((a) => a.id === 'century')) {
        newAchievements.push({
          id: 'century',
          name: '百公里騎士',
          description: '完成一次 100km 以上的騎乘',
          icon: '🏆',
          condition: 'distance >= 100',
          unlockedAt: Date.now(),
        });
      }

      // 1000m 爬升成就
      if (benchmark.elevation >= 1000 && !userAchievements.find((a) => a.id === 'climber')) {
        newAchievements.push({
          id: 'climber',
          name: '登山者',
          description: '完成一次 1000m 以上的爬升',
          icon: '⛰️',
          condition: 'elevation >= 1000',
          unlockedAt: Date.now(),
        });
      }

      // 平均速度 30km/h 成就
      if (benchmark.avgSpeed >= 30 && !userAchievements.find((a) => a.id === 'speedster')) {
        newAchievements.push({
          id: 'speedster',
          name: '速度獵人',
          description: '完成一次平均速度 30km/h 以上的騎乘',
          icon: '⚡',
          condition: 'avgSpeed >= 30',
          unlockedAt: Date.now(),
        });
      }

      // 功率 300W 成就
      if (benchmark.avgPower >= 300 && !userAchievements.find((a) => a.id === 'powerhouse')) {
        newAchievements.push({
          id: 'powerhouse',
          name: '動力機器',
          description: '完成一次平均功率 300W 以上的騎乘',
          icon: '💪',
          condition: 'avgPower >= 300',
          unlockedAt: Date.now(),
        });
      }

      // 保存新成就
      if (newAchievements.length > 0) {
        const allAchievements = [...achievements, ...newAchievements];
        await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(allAchievements));
      }
    } catch (error) {
      console.error('Failed to check achievements:', error);
    }
  }

  /**
   * 獲取所有成績
   */
  private static async getAllBenchmarks(): Promise<PerformanceBenchmark[]> {
    try {
      const data = await AsyncStorage.getItem(BENCHMARKS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all benchmarks:', error);
      return [];
    }
  }

  /**
   * 獲取所有成就
   */
  private static async getAllAchievements(): Promise<AchievementBadge[]> {
    try {
      const data = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all achievements:', error);
      return [];
    }
  }

  /**
   * 獲取用戶成就
   */
  static async getUserAchievements(userId: string): Promise<AchievementBadge[]> {
    try {
      const achievements = await this.getAllAchievements();
      return achievements.filter((a) => a.unlockedAt !== undefined);
    } catch (error) {
      console.error('Failed to get user achievements:', error);
      return [];
    }
  }
}
