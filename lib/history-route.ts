import type { GpxRoute } from "@/lib/gpx-parser";
import type { RideRecord } from "@/lib/ride-context";

/**
 * 將已保存在裝置的騎乘軌跡轉為導航可使用的路線資料。
 * 不會上傳位置，也不需要重新取得 GPX 或網路路徑服務。
 */
export function createRouteFromRideRecord(record: RideRecord): GpxRoute | null {
  if (!record.route || record.route.length < 2) return null;

  const points = record.route.map((point) => ({
    lat: point.latitude,
    lon: point.longitude,
    ele: point.altitude ?? 0,
    time: new Date(point.timestamp).toISOString(),
  }));
  const elevationProfile = record.route.map((point, index) => ({
    distance: index === record.route.length - 1
      ? record.distance
      : (record.distance * index) / (record.route.length - 1),
    elevation: point.altitude ?? 0,
  }));

  return {
    name: record.name?.trim() || `歷史騎乘 ${new Date(record.date).toLocaleDateString("zh-TW")}`,
    points,
    totalDistance: record.distance,
    totalAscent: record.totalAscent,
    totalDescent: record.totalDescent ?? 0,
    estimatedDuration: record.duration,
    estimatedCalories: record.calories,
    elevationProfile,
    gradientDistribution: {},
    avgGradient: 0,
    maxGradient: 0,
  };
}
