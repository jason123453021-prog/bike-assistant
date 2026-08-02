/**
 * 騎乘指標精準計算模組
 * 處理卡路里、海拔極值、坡度、標準化功率等複雜計算
 */

export interface GPSPoint {
  lat: number;
  lon: number;
  altitude: number;
  timestamp: number;
  power?: number; // 功率（瓦特）
}

export interface RideMetrics {
  // 基本數據
  distance: number; // km
  duration: number; // 秒
  
  // 海拔數據
  totalAscent: number; // 米
  totalDescent: number; // 米
  maxAltitude: number; // 米
  minAltitude: number; // 米
  
  // 坡度數據
  averageGrade: number; // %
  maxGrade: number; // %
  
  // 卡路里與能量
  calories: number; // kcal
  
  // 功率數據
  averagePower: number; // W
  maxPower: number; // W
  normalizedPower: number; // W
}

/**
 * 計算卡路里消耗
 * 優先使用功率數據，否則使用 METs 公式
 */
export function calculateCalories(
  points: GPSPoint[],
  userWeight: number = 75, // kg，默認體重
  avgPower?: number
): number {
  if (!points || points.length === 0) return 0;

  // 方法 1：基於功率計算（最精準）
  if (avgPower && avgPower > 0) {
    const totalSeconds = (points[points.length - 1].timestamp - points[0].timestamp) / 1000;
    const totalJoules = avgPower * totalSeconds; // 焦耳
    const totalKJ = totalJoules / 1000; // 千焦耳
    
    // 人體機械效率約 21-24%，取 22.5%
    // kcal = kJ / 4.184 / 0.225 * 0.225 = kJ / 4.184
    const calories = totalKJ / 4.184;
    
    return Math.round(calories);
  }

  // 方法 2：基於 METs 公式計算
  return calculateCaloriesByMETs(points, userWeight);
}

/**
 * 基於 METs 公式計算卡路里
 * METs = 代謝當量，表示運動強度相對於靜息代謝率的倍數
 */
function calculateCaloriesByMETs(points: GPSPoint[], userWeight: number): number {
  if (points.length < 2) return 0;

  let totalCalories = 0;
  const startTime = points[0].timestamp;
  const endTime = points[points.length - 1].timestamp;
  const totalSeconds = (endTime - startTime) / 1000;

  // 計算平均速度
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistance += haversineDistance(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );
  }
  const avgSpeedKmh = (totalDistance / 1000) / (totalSeconds / 3600);

  // 計算平均坡度
  let totalElevationGain = 0;
  for (let i = 1; i < points.length; i++) {
    const elevDiff = points[i].altitude - points[i - 1].altitude;
    if (elevDiff > 0) {
      totalElevationGain += elevDiff;
    }
  }
  const avgGrade = totalDistance > 0 ? (totalElevationGain / totalDistance) * 100 : 0;

  // 根據速度和坡度估算 METs
  let mets = 3.5; // 基礎值：輕鬆騎乘
  
  if (avgSpeedKmh < 10) {
    mets = 3.5; // 非常輕鬆
  } else if (avgSpeedKmh < 15) {
    mets = 5.8; // 輕鬆
  } else if (avgSpeedKmh < 20) {
    mets = 7.0; // 中等
  } else if (avgSpeedKmh < 25) {
    mets = 8.8; // 較快
  } else if (avgSpeedKmh < 30) {
    mets = 10.2; // 快速
  } else {
    mets = 12.0; // 非常快速
  }

  // 根據坡度調整 METs
  if (avgGrade > 5) {
    mets *= 1.3; // 陡坡增加 30%
  } else if (avgGrade > 3) {
    mets *= 1.15; // 中等坡度增加 15%
  }

  // 計算卡路里：kcal = METs × 體重(kg) × 時間(小時)
  const hours = totalSeconds / 3600;
  totalCalories = mets * userWeight * hours;

  return Math.round(totalCalories);
}

/**
 * 計算海拔極值與坡度
 */
export function calculateElevationMetrics(points: GPSPoint[]): {
  totalAscent: number;
  totalDescent: number;
  maxAltitude: number;
  minAltitude: number;
  averageGrade: number;
  maxGrade: number;
} {
  if (!points || points.length === 0) {
    return {
      totalAscent: 0,
      totalDescent: 0,
      maxAltitude: 0,
      minAltitude: 0,
      averageGrade: 0,
      maxGrade: 0,
    };
  }

  let totalAscent = 0;
  let totalDescent = 0;
  let maxAltitude = points[0].altitude;
  let minAltitude = points[0].altitude;
  let maxGrade = 0;
  let totalDistance = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // 更新最大/最小海拔
    maxAltitude = Math.max(maxAltitude, curr.altitude);
    minAltitude = Math.min(minAltitude, curr.altitude);

    // 計算爬升/下降
    const elevDiff = curr.altitude - prev.altitude;
    if (elevDiff > 0.5) { // 過濾 GPS 噪聲
      totalAscent += elevDiff;
    } else if (elevDiff < -0.5) {
      totalDescent += Math.abs(elevDiff);
    }

    // 計算分段坡度
    const distance = haversineDistance(
      prev.lat,
      prev.lon,
      curr.lat,
      curr.lon
    );
    totalDistance += distance;

    if (distance > 0) {
      const grade = (elevDiff / distance) * 100;
      maxGrade = Math.max(maxGrade, Math.abs(grade));
    }
  }

  // 計算平均坡度
  const averageGrade = totalDistance > 0 ? (totalAscent / totalDistance) * 100 : 0;

  return {
    totalAscent: Math.round(totalAscent),
    totalDescent: Math.round(totalDescent),
    maxAltitude: Math.round(maxAltitude),
    minAltitude: Math.round(minAltitude),
    averageGrade: Math.round(averageGrade * 10) / 10,
    maxGrade: Math.round(maxGrade * 10) / 10,
  };
}

/**
 * 計算標準化功率 (Normalized Power, NP)
 * 使用 30 秒滾動平均、四次方求和均值後再開四次方根
 */
export function calculateNormalizedPower(points: GPSPoint[]): number {
  if (!points || points.length === 0) return 0;

  // 提取功率數據
  const powerData = points
    .filter(p => p.power !== undefined && p.power > 0)
    .map(p => p.power!);

  if (powerData.length === 0) return 0;

  // 30 秒滾動平均
  const rollingAveragePower: number[] = [];
  const windowSize = Math.max(3, Math.floor(powerData.length / 10)); // 簡化：取 1/10 作為窗口

  for (let i = 0; i < powerData.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = powerData.slice(start, i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    rollingAveragePower.push(avg);
  }

  // 四次方求和均值
  const fourthPowerSum = rollingAveragePower.reduce((sum, p) => sum + Math.pow(p, 4), 0);
  const mean = fourthPowerSum / rollingAveragePower.length;

  // 開四次方根
  const normalizedPower = Math.pow(mean, 0.25);

  return Math.round(normalizedPower);
}

/**
 * Haversine 公式計算兩點間距離
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // 地球半徑（米）
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 角度轉弧度
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * 綜合計算所有騎乘指標
 */
export function calculateAllMetrics(
  points: GPSPoint[],
  userWeight: number = 75,
  avgPower?: number,
  maxPower?: number
): RideMetrics {
  if (!points || points.length < 2) {
    return {
      distance: 0,
      duration: 0,
      totalAscent: 0,
      totalDescent: 0,
      maxAltitude: 0,
      minAltitude: 0,
      averageGrade: 0,
      maxGrade: 0,
      calories: 0,
      averagePower: avgPower || 0,
      maxPower: maxPower || 0,
      normalizedPower: 0,
    };
  }

  // 計算距離
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistance += haversineDistance(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );
  }

  // 計算時間
  const duration = Math.floor((points[points.length - 1].timestamp - points[0].timestamp) / 1000);

  // 計算海拔指標
  const elevationMetrics = calculateElevationMetrics(points);

  // 計算卡路里
  const calories = calculateCalories(points, userWeight, avgPower);

  // 計算標準化功率
  const normalizedPower = calculateNormalizedPower(points);

  return {
    distance: Math.round((totalDistance / 1000) * 100) / 100,
    duration,
    ...elevationMetrics,
    calories,
    averagePower: avgPower || 0,
    maxPower: maxPower || 0,
    normalizedPower,
  };
}
