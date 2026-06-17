/**
 * GPX 檔案解析器
 * 解析 GPX XML 格式，提取路線點、距離、爬升等資訊
 */

import { haversineDistance, calculatePower, calculateCalories } from "./power-calc";

export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number;
  time?: string;
}

export interface GpxRoute {
  name: string;
  points: GpxPoint[];
  totalDistance: number;   // meters
  totalAscent: number;     // meters
  totalDescent: number;    // meters
  estimatedDuration: number; // seconds (at avg 20 km/h)
  estimatedCalories: number;
  elevationProfile: { distance: number; elevation: number }[];
}

/**
 * 解析 GPX XML 字串
 */
export function parseGpx(xmlString: string): GpxRoute | null {
  try {
    // 提取軌跡點 (trkpt) 或路線點 (rtept)
    const trkptRegex = /<(?:trkpt|rtept|wpt)\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/(?:trkpt|rtept|wpt)>/g;
    const eleRegex = /<ele>([^<]+)<\/ele>/;
    const timeRegex = /<time>([^<]+)<\/time>/;
    const nameRegex = /<name>([^<]+)<\/name>/;

    const nameMatch = xmlString.match(nameRegex);
    const routeName = nameMatch ? nameMatch[1].trim() : "未命名路線";

    const points: GpxPoint[] = [];
    let match;

    while ((match = trkptRegex.exec(xmlString)) !== null) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      const content = match[3];
      const eleMatch = content.match(eleRegex);
      const timeMatch = content.match(timeRegex);
      points.push({
        lat,
        lon,
        ele: eleMatch ? parseFloat(eleMatch[1]) : 0,
        time: timeMatch ? timeMatch[1] : undefined,
      });
    }

    if (points.length < 2) return null;

    // 計算統計
    let totalDistance = 0;
    let totalAscent = 0;
    let totalDescent = 0;
    const elevationProfile: { distance: number; elevation: number }[] = [];

    elevationProfile.push({ distance: 0, elevation: points[0].ele });

    for (let i = 1; i < points.length; i++) {
      const d = haversineDistance(
        points[i - 1].lat, points[i - 1].lon,
        points[i].lat, points[i].lon
      );
      totalDistance += d;

      const altDiff = points[i].ele - points[i - 1].ele;
      if (altDiff > 0) totalAscent += altDiff;
      else totalDescent += Math.abs(altDiff);

      elevationProfile.push({ distance: totalDistance, elevation: points[i].ele });
    }

    // 預估時間（基於距離和爬升）
    // 平地 20 km/h，每 100m 爬升增加 10 分鐘
    const flatTime = (totalDistance / 1000) / 20 * 3600;
    const climbTime = (totalAscent / 100) * 600;
    const estimatedDuration = Math.round(flatTime + climbTime);

    // 預估卡路里（基於功率估算）
    const avgSpeedMs = totalDistance / estimatedDuration;
    const avgGrade = totalAscent / totalDistance * 100;
    const avgPower = calculatePower({
      speedMs: avgSpeedMs,
      gradePct: avgGrade * 0.3, // 平均坡度（部分時間爬坡）
      windSpeedMs: 0,
      riderMassKg: 70,
    });
    const estimatedCalories = Math.round(
      calculateCalories(avgPower, estimatedDuration)
    );

    return {
      name: routeName,
      points,
      totalDistance,
      totalAscent,
      totalDescent,
      estimatedDuration,
      estimatedCalories,
      elevationProfile,
    };
  } catch (e) {
    console.error("GPX parse error:", e);
    return null;
  }
}
