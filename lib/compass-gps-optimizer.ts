/**
 * 電子羅盤與 GPS 向量智慧切換
 * 優化導航精度與方向判斷
 */

// 羅盤和加速度計通過原生模組提供

export interface CompassData {
  heading: number;          // 0-360 度
  accuracy: number;         // 精度 (度)
  timestamp: number;
}

export interface GPSVector {
  bearing: number;          // 0-360 度
  accuracy: number;         // 精度 (米)
  speed: number;            // m/s
  timestamp: number;
}

export interface DirectionData {
  source: "compass" | "gps" | "hybrid";
  heading: number;          // 最終方向 (0-360 度)
  confidence: number;       // 信心度 (0-1)
  accuracy: number;         // 精度 (度)
}

const COMPASS_ACCURACY_THRESHOLD = 30;  // 羅盤精度閾值 (度)
const GPS_SPEED_THRESHOLD = 0.5;        // GPS 速度閾值 (m/s)
const GPS_DIRECTION_PRIORITY_SPEED = 1.2; // 穩定行進後優先使用 GPS 行進向量
const HYBRID_WEIGHT_COMPASS = 0.4;      // 混合模式下羅盤權重
const HYBRID_WEIGHT_GPS = 0.6;          // 混合模式下 GPS 權重

/** 車頭朝前地圖只接受可信的行進方向，避免手機羅盤與低品質定位造成畫面旋轉。 */
export const MIN_MAP_HEADING_SPEED_KMH = 7;
export const MAX_MAP_HEADING_ACCURACY_M = 35;
export const MAP_HEADING_DEAD_ZONE_DEG = 4;
export const MAP_HEADING_MAX_STEP_DEG = 35;

/**
 * 計算兩個方向之間的最小角度差
 */
export function calculateHeadingDifference(heading1: number, heading2: number): number {
  let diff = Math.abs(heading1 - heading2);
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * 根據兩點座標計算方位角 (bearing)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = toDeg(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;

  return bearing;
}

/**
 * 智慧方向選擇
 * 根據羅盤精度和 GPS 速度決定使用哪個源
 */
export function selectDirectionSource(
  compassData: CompassData | null,
  gpsVector: GPSVector | null
): "compass" | "gps" | "hybrid" {
  // 只有羅盤
  if (compassData && !gpsVector) {
    return "compass";
  }

  // 只有 GPS
  if (!compassData && gpsVector) {
    return "gps";
  }

  // 都沒有
  if (!compassData || !gpsVector) {
    return "compass";
  }

  // 羅盤精度差且 GPS 速度足夠
  if (compassData.accuracy > COMPASS_ACCURACY_THRESHOLD && gpsVector.speed > GPS_SPEED_THRESHOLD) {
    return "gps";
  }

  // 羅盤精度好且 GPS 速度不足
  if (compassData.accuracy <= COMPASS_ACCURACY_THRESHOLD && gpsVector.speed <= GPS_SPEED_THRESHOLD) {
    return "compass";
  }

  // 單車穩定前進時，行進向量最符合實際車頭方向；不混入手機握持角度。
  if (gpsVector.speed >= GPS_DIRECTION_PRIORITY_SPEED) {
    return "gps";
  }

  // 緩慢起步或短暫減速時才混合兩者，以維持轉向連續性。
  return "hybrid";
}

/**
 * 混合羅盤和 GPS 方向
 */
export function hybridDirection(compassData: CompassData, gpsVector: GPSVector): number {
  // 計算權重（基於精度）
  const compassWeight = Math.max(0, 1 - compassData.accuracy / 180) * HYBRID_WEIGHT_COMPASS;
  const gpsWeight = Math.max(0, 1 - gpsVector.accuracy / 100) * HYBRID_WEIGHT_GPS;
  const totalWeight = compassWeight + gpsWeight;

  if (totalWeight === 0) {
    return compassData.heading;
  }

  // 加權平均（考慮角度循環）
  const compassRad = (compassData.heading * Math.PI) / 180;
  const gpsRad = (gpsVector.bearing * Math.PI) / 180;

  const x = (Math.cos(compassRad) * compassWeight + Math.cos(gpsRad) * gpsWeight) / totalWeight;
  const y = (Math.sin(compassRad) * compassWeight + Math.sin(gpsRad) * gpsWeight) / totalWeight;

  let heading = Math.atan2(y, x) * (180 / Math.PI);
  heading = (heading + 360) % 360;

  return heading;
}

/**
 * 獲取最終方向資料
 */
export function getFinalDirection(
  compassData: CompassData | null,
  gpsVector: GPSVector | null
): DirectionData {
  const source = selectDirectionSource(compassData, gpsVector);

  let heading = 0;
  let accuracy = 0;
  let confidence = 0;

  switch (source) {
    case "compass":
      if (compassData) {
        heading = compassData.heading;
        accuracy = compassData.accuracy;
        confidence = Math.max(0, 1 - compassData.accuracy / 180);
      }
      break;

    case "gps":
      if (gpsVector) {
        heading = gpsVector.bearing;
        accuracy = gpsVector.accuracy;
        confidence = Math.max(0, 1 - gpsVector.accuracy / 100);
      }
      break;

    case "hybrid":
      if (compassData && gpsVector) {
        heading = hybridDirection(compassData, gpsVector);
        accuracy = Math.sqrt(
          Math.pow(compassData.accuracy, 2) + Math.pow(gpsVector.accuracy / 10, 2)
        );
        confidence = (Math.max(0, 1 - compassData.accuracy / 180) +
          Math.max(0, 1 - gpsVector.accuracy / 100)) / 2;
      }
      break;
  }

  return {
    source,
    heading: Math.round(heading * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    accuracy: Math.round(accuracy * 10) / 10,
  };
}

/**
 * 平滑方向變化（低通濾波）
 */
export function smoothHeading(
  currentHeading: number,
  previousHeading: number,
  alpha: number = 0.2
): number {
  // 處理角度循環
  let diff = currentHeading - previousHeading;
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }

  let smoothed = previousHeading + diff * alpha;
  smoothed = (smoothed + 360) % 360;

  return Math.round(smoothed * 10) / 10;
}

/**
 * 將可信 GPS 航向轉換為可安全套用到地圖的下一個航向。
 * 回傳 null 表示應維持目前地圖方向，避免低速、低精度或微小抖動帶動畫面。
 */
export function stabilizeMapHeading(
  candidateHeading: number,
  previousHeading: number,
  speedKmh: number,
  locationAccuracyM: number | null | undefined,
): number | null {
  if (
    !Number.isFinite(candidateHeading)
    || !Number.isFinite(previousHeading)
    || speedKmh < MIN_MAP_HEADING_SPEED_KMH
    || locationAccuracyM === null
    || locationAccuracyM === undefined
    || locationAccuracyM > MAX_MAP_HEADING_ACCURACY_M
  ) {
    return null;
  }

  let delta = ((candidateHeading - previousHeading + 540) % 360) - 180;
  if (Math.abs(delta) <= MAP_HEADING_DEAD_ZONE_DEG) return null;
  delta = Math.max(-MAP_HEADING_MAX_STEP_DEG, Math.min(MAP_HEADING_MAX_STEP_DEG, delta));
  return (previousHeading + delta + 360) % 360;
}

/**
 * 判斷方向是否穩定
 */
export function isHeadingStable(
  currentHeading: number,
  previousHeading: number,
  threshold: number = 5
): boolean {
  const diff = calculateHeadingDifference(currentHeading, previousHeading);
  return diff < threshold;
}

/**
 * 生成方向診斷報告
 */
export function generateDirectionDiagnostics(direction: DirectionData): string {
  const sourceLabel = {
    compass: "🧭 羅盤",
    gps: "📍 GPS",
    hybrid: "🔄 混合",
  };

  const confidenceBar = "█".repeat(Math.round(direction.confidence * 10)) +
    "░".repeat(10 - Math.round(direction.confidence * 10));

  return `📊 方向診斷\n\n` +
    `來源: ${sourceLabel[direction.source]}\n` +
    `方向: ${Math.round(direction.heading)}°\n` +
    `精度: ±${direction.accuracy}°\n` +
    `信心: ${confidenceBar} ${Math.round(direction.confidence * 100)}%`;
}
