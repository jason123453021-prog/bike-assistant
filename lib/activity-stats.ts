/**
 * 四大活動統計模組
 * 月度統計、年度統計、路線排行、成績排行
 */

import { RideRecord } from "./ride-context";

export interface ActivityStats {
  totalDistance: number;      // 總距離 (km)
  totalTime: number;          // 總時間 (秒)
  totalElevation: number;     // 總爬升 (m)
  totalCalories: number;      // 總卡路里 (kcal)
  averageSpeed: number;       // 平均速度 (km/h)
  averagePace: number;        // 平均配速 (分鐘/km)
  maxSpeed: number;           // 最高速度 (km/h)
  maxElevation: number;       // 最大單次爬升 (m)
  rideCount: number;          // 騎乘次數
}

export interface RouteRanking {
  routeName: string;
  rideCount: number;
  totalDistance: number;
  bestTime: number;           // 秒
  averageSpeed: number;       // km/h
  lastRideDate: number;       // timestamp
}

export interface PersonalRecord {
  routeName: string;
  distance: number;
  time: number;               // 秒
  speed: number;              // km/h
  elevation: number;
  date: number;               // timestamp
  calories: number;
}

/**
 * 計算月度統計
 */
export function calculateMonthlyStats(rides: RideRecord[], month: number, year: number): ActivityStats {
  const filtered = rides.filter((r) => {
    const date = new Date(r.date);
    return date.getMonth() === month && date.getFullYear() === year;
  });

  return calculateStats(filtered);
}

/**
 * 計算年度統計
 */
export function calculateYearlyStats(rides: RideRecord[], year: number): ActivityStats {
  const filtered = rides.filter((r) => {
    const date = new Date(r.date);
    return date.getFullYear() === year;
  });

  return calculateStats(filtered);
}

/**
 * 計算通用統計
 */
function calculateStats(rides: RideRecord[]): ActivityStats {
  if (rides.length === 0) {
    return {
      totalDistance: 0,
      totalTime: 0,
      totalElevation: 0,
      totalCalories: 0,
      averageSpeed: 0,
      averagePace: 0,
      maxSpeed: 0,
      maxElevation: 0,
      rideCount: 0,
    };
  }

  const totalDistance = rides.reduce((sum, r) => sum + r.distance, 0);
  const totalTime = rides.reduce((sum, r) => sum + r.duration, 0);
  const totalElevation = rides.reduce((sum, r) => sum + r.totalAscent, 0);
  const totalCalories = rides.reduce((sum, r) => sum + (r.calories || 0), 0);
  const maxSpeed = Math.max(...rides.map((r) => r.maxSpeed || 0));
  const maxElevation = Math.max(...rides.map((r) => r.totalAscent || 0));

  const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
  const averagePace = totalDistance > 0 ? (totalTime / 60) / totalDistance : 0;

  return {
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalTime,
    totalElevation: Math.round(totalElevation),
    totalCalories: Math.round(totalCalories),
    averageSpeed: Math.round(averageSpeed * 10) / 10,
    averagePace: Math.round(averagePace * 10) / 10,
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    maxElevation: Math.round(maxElevation),
    rideCount: rides.length,
  };
}

/**
 * 計算路線排行
 */
export function calculateRouteRankings(rides: RideRecord[]): RouteRanking[] {
  const routeMap = new Map<string, RideRecord[]>();

  // 按路線名稱分組
  rides.forEach((r) => {
    const name = r.name || "未命名路線";
    if (!routeMap.has(name)) {
      routeMap.set(name, []);
    }
    routeMap.get(name)!.push(r);
  });

  // 計算每條路線的統計
  const rankings: RouteRanking[] = [];
  routeMap.forEach((rideList, routeName) => {
    const bestTime = Math.min(...rideList.map((r) => r.duration));
    const totalDistance = rideList.reduce((sum, r) => sum + r.distance, 0);
    const averageSpeed = rideList.reduce((sum, r) => sum + r.avgSpeed, 0) / rideList.length;
    const lastRideDate = Math.max(...rideList.map((r) => r.date));

    rankings.push({
      routeName,
      rideCount: rideList.length,
      totalDistance: Math.round(totalDistance * 100) / 100,
      bestTime,
      averageSpeed: Math.round(averageSpeed * 10) / 10,
      lastRideDate,
    });
  });

  // 按騎乘次數排序
  return rankings.sort((a, b) => b.rideCount - a.rideCount);
}

/**
 * 計算個人紀錄（成績排行）
 */
export function calculatePersonalRecords(rides: RideRecord[]): PersonalRecord[] {
  return rides
    .map((r) => ({
      routeName: r.name || "未命名路線",
      distance: r.distance,
      time: r.duration,
      speed: r.avgSpeed,
      elevation: r.totalAscent,
      date: r.date,
      calories: r.calories || 0,
    }))
    .sort((a, b) => b.speed - a.speed); // 按速度排序
}

/**
 * 計算最快的 N 條路線
 */
export function getTopFastestRoutes(rankings: RouteRanking[], limit: number = 5): RouteRanking[] {
  return rankings
    .sort((a, b) => b.averageSpeed - a.averageSpeed)
    .slice(0, limit);
}

/**
 * 計算最常騎的 N 條路線
 */
export function getTopFrequentRoutes(rankings: RouteRanking[], limit: number = 5): RouteRanking[] {
  return rankings
    .sort((a, b) => b.rideCount - a.rideCount)
    .slice(0, limit);
}

/**
 * 生成統計摘要
 */
export function generateStatsSummary(stats: ActivityStats, period: string): string {
  const hours = Math.floor(stats.totalTime / 3600);
  const minutes = Math.floor((stats.totalTime % 3600) / 60);

  return `📊 ${period} 統計摘要\n\n` +
    `🚴 騎乘次數: ${stats.rideCount} 次\n` +
    `📏 總距離: ${stats.totalDistance} km\n` +
    `⏱️ 總時間: ${hours}h ${minutes}m\n` +
    `📈 總爬升: ${stats.totalElevation} m\n` +
    `🔥 總卡路里: ${stats.totalCalories} kcal\n` +
    `⚡ 平均速度: ${stats.averageSpeed} km/h\n` +
    `🏁 最高速度: ${stats.maxSpeed} km/h`;
}

/**
 * 生成路線排行摘要
 */
export function generateRouteRankingSummary(rankings: RouteRanking[], limit: number = 5): string {
  const topRoutes = rankings.slice(0, limit);
  let summary = `🏆 路線排行 (前 ${limit})\n\n`;

  topRoutes.forEach((r, index) => {
    const medal = ["🥇", "🥈", "🥉"][index] || `${index + 1}.`;
    const timeMin = Math.round(r.bestTime / 60);
    summary += `${medal} ${r.routeName}\n` +
      `   騎乘 ${r.rideCount} 次 | 最佳時間 ${timeMin} 分鐘 | 平均速度 ${r.averageSpeed} km/h\n\n`;
  });

  return summary;
}
