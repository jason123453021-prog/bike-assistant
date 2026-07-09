import { LocalStorageManager } from './local-storage-manager';

/**
 * 騎乘統計儀表板管理器
 */
export class RideStatisticsDashboard {
  /**
   * 獲取週統計
   */
  static async getWeeklyStats() {
    const records = await LocalStorageManager.getAllRideRecords();
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const weeklyRecords = records.filter((r: any) => r.timestamp >= weekAgo);

    return {
      totalRides: weeklyRecords.length,
      totalDistance: weeklyRecords.reduce((s: number, r: any) => s + (r.distance || 0), 0),
      totalTime: weeklyRecords.reduce((s: number, r: any) => s + (r.duration || 0), 0),
      avgSpeed: weeklyRecords.length > 0
        ? weeklyRecords.reduce((s: number, r: any) => s + (r.speed || 0), 0) / weeklyRecords.length
        : 0,
      avgDistance: weeklyRecords.length > 0
        ? weeklyRecords.reduce((s: number, r: any) => s + (r.distance || 0), 0) / weeklyRecords.length
        : 0,
      dailyBreakdown: this.getDailyBreakdown(weeklyRecords),
    };
  }

  /**
   * 獲取月統計
   */
  static async getMonthlyStats() {
    const records = await LocalStorageManager.getAllRideRecords();
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const monthlyRecords = records.filter((r: any) => r.timestamp >= monthAgo);

    return {
      totalRides: monthlyRecords.length,
      totalDistance: monthlyRecords.reduce((s: number, r: any) => s + (r.distance || 0), 0),
      totalTime: monthlyRecords.reduce((s: number, r: any) => s + (r.duration || 0), 0),
      avgSpeed: monthlyRecords.length > 0
        ? monthlyRecords.reduce((s: number, r: any) => s + (r.speed || 0), 0) / monthlyRecords.length
        : 0,
      avgDistance: monthlyRecords.length > 0
        ? monthlyRecords.reduce((s: number, r: any) => s + (r.distance || 0), 0) / monthlyRecords.length
        : 0,
      weeklyBreakdown: this.getWeeklyBreakdown(monthlyRecords),
    };
  }

  /**
   * 獲取年統計
   */
  static async getYearlyStats() {
    const records = await LocalStorageManager.getAllRideRecords();
    const now = Date.now();
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000;

    const yearlyRecords = records.filter((r: any) => r.timestamp >= yearAgo);

    return {
      totalRides: yearlyRecords.length,
      totalDistance: yearlyRecords.reduce((s: number, r: any) => s + (r.distance || 0), 0),
      totalTime: yearlyRecords.reduce((s: number, r: any) => s + (r.duration || 0), 0),
      avgSpeed: yearlyRecords.length > 0
        ? yearlyRecords.reduce((s: number, r: any) => s + (r.speed || 0), 0) / yearlyRecords.length
        : 0,
      avgDistance: yearlyRecords.length > 0
        ? yearlyRecords.reduce((s: number, r: any) => s + (r.distance || 0), 0) / yearlyRecords.length
        : 0,
      monthlyBreakdown: this.getMonthlyBreakdown(yearlyRecords),
    };
  }

  /**
   * 獲取個人記錄
   */
  static async getPersonalRecords() {
    const records = await LocalStorageManager.getAllRideRecords();

    if (records.length === 0) {
      return {
        longestDistance: 0,
        fastestSpeed: 0,
        longestDuration: 0,
        highestElevation: 0,
      };
    }

    return {
      longestDistance: Math.max(...records.map((r: any) => r.distance || 0)),
      fastestSpeed: Math.max(...records.map((r: any) => r.speed || 0)),
      longestDuration: Math.max(...records.map((r: any) => r.duration || 0)),
      highestElevation: Math.max(...records.map((r: any) => r.elevation || 0)),
    };
  }

  /**
   * 獲取進度趨勢
   */
  static async getProgressTrend(period: 'week' | 'month' | 'year' = 'month') {
    const records = await LocalStorageManager.getAllRideRecords();

    let days = 30;
    if (period === 'week') days = 7;
    if (period === 'year') days = 365;

    const now = Date.now();
    const startDate = now - days * 24 * 60 * 60 * 1000;

    const trend = [];
    for (let i = 0; i < days; i++) {
      const dayStart = startDate + i * 24 * 60 * 60 * 1000;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const dayRecords = records.filter((r: any) => r.timestamp >= dayStart && r.timestamp < dayEnd);

      trend.push({
        date: new Date(dayStart).toLocaleDateString('zh-TW'),
        distance: dayRecords.reduce((s: number, r: any) => s + (r.distance || 0), 0),
        rides: dayRecords.length,
        avgSpeed: dayRecords.length > 0
          ? dayRecords.reduce((s: number, r: any) => s + (r.speed || 0), 0) / dayRecords.length
          : 0,
      });
    }

    return trend;
  }

  /**
   * 獲取目標達成情況
   */
  static async getGoalProgress(goals: any[]) {
    const stats = await this.getMonthlyStats();

    return goals.map((goal) => {
      let progress = 0;
      let target = 0;

      if (goal.type === 'distance') {
        progress = stats.totalDistance;
        target = goal.target;
      } else if (goal.type === 'rides') {
        progress = stats.totalRides;
        target = goal.target;
      } else if (goal.type === 'time') {
        progress = stats.totalTime / 3600; // 轉換為小時
        target = goal.target;
      }

      return {
        ...goal,
        progress,
        target,
        percentage: Math.min((progress / target) * 100, 100),
        completed: progress >= target,
      };
    });
  }

  private static getDailyBreakdown(records: any[]) {
    const breakdown: any = {};

    records.forEach((r: any) => {
      const date = new Date(r.timestamp).toLocaleDateString('zh-TW');
      if (!breakdown[date]) {
        breakdown[date] = { distance: 0, rides: 0 };
      }
      breakdown[date].distance += r.distance || 0;
      breakdown[date].rides += 1;
    });

    return breakdown;
  }

  private static getWeeklyBreakdown(records: any[]) {
    const breakdown: any = {};

    records.forEach((r: any) => {
      const date = new Date(r.timestamp);
      const weekNum = Math.floor(date.getDate() / 7) + 1;
      const key = `第 ${weekNum} 週`;

      if (!breakdown[key]) {
        breakdown[key] = { distance: 0, rides: 0 };
      }
      breakdown[key].distance += r.distance || 0;
      breakdown[key].rides += 1;
    });

    return breakdown;
  }

  private static getMonthlyBreakdown(records: any[]) {
    const breakdown: any = {};

    records.forEach((r: any) => {
      const date = new Date(r.timestamp);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const key = `${date.getFullYear()}-${month}`;

      if (!breakdown[key]) {
        breakdown[key] = { distance: 0, rides: 0 };
      }
      breakdown[key].distance += r.distance || 0;
      breakdown[key].rides += 1;
    });

    return breakdown;
  }
}
