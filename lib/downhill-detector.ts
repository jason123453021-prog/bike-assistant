/**
 * 長下坡偵測與自動暫停
 * 偵測連續下坡（坡度 < -5%），自動暫停計時
 */

export interface DownhillSegment {
  startTime: number;
  startAltitude: number;
  maxDescentRate: number;  // 最大下降率 (%)
  totalDescent: number;    // 總下降高度 (m)
  duration: number;        // 持續時間 (秒)
  shouldPause: boolean;    // 是否應暫停
}

const DOWNHILL_THRESHOLD = -5;      // 下坡坡度閾值 (%)
const MIN_DOWNHILL_DURATION = 30;   // 最小下坡持續時間 (秒)
const STEEP_DOWNHILL_THRESHOLD = -10; // 陡下坡閾值 (%)

/**
 * 計算坡度 (%)
 * @param altitudeDiff 高度差 (m)
 * @param distance 距離 (m)
 */
export function calculateGradient(altitudeDiff: number, distance: number): number {
  if (distance === 0) return 0;
  return (altitudeDiff / distance) * 100;
}

/**
 * 偵測下坡段落
 */
export function detectDownhillSegment(
  currentAltitude: number,
  previousAltitude: number,
  distance: number,
  currentTime: number,
  previousTime: number
): DownhillSegment | null {
  const altitudeDiff = currentAltitude - previousAltitude;
  const gradient = calculateGradient(altitudeDiff, distance);
  const duration = currentTime - previousTime;

  // 不是下坡
  if (gradient >= DOWNHILL_THRESHOLD) {
    return null;
  }

  // 下坡時間太短
  if (duration < MIN_DOWNHILL_DURATION) {
    return null;
  }

  const shouldPause = gradient <= STEEP_DOWNHILL_THRESHOLD || duration > 60;

  return {
    startTime: previousTime,
    startAltitude: previousAltitude,
    maxDescentRate: gradient,
    totalDescent: Math.abs(altitudeDiff),
    duration,
    shouldPause,
  };
}

/**
 * 判斷是否應自動暫停騎乘
 * 條件：
 * 1. 坡度 < -10% 且持續 > 30 秒
 * 2. 坡度 < -5% 且持續 > 60 秒
 */
export function shouldAutoPause(segment: DownhillSegment): boolean {
  if (segment.maxDescentRate <= STEEP_DOWNHILL_THRESHOLD && segment.duration >= MIN_DOWNHILL_DURATION) {
    return true;
  }
  if (segment.maxDescentRate <= DOWNHILL_THRESHOLD && segment.duration >= 60) {
    return true;
  }
  return false;
}

/**
 * 生成下坡通知訊息
 */
export function generateDownhillNotification(segment: DownhillSegment): string {
  const descentM = Math.round(segment.totalDescent);
  const durationMin = Math.round(segment.duration / 60);
  const gradient = Math.abs(Math.round(segment.maxDescentRate * 10) / 10);

  if (segment.maxDescentRate <= STEEP_DOWNHILL_THRESHOLD) {
    return `⚠️ 陡下坡 ${gradient}% | 下降 ${descentM}m | ${durationMin} 分鐘\n已自動暫停計時`;
  } else {
    return `📉 長下坡 ${gradient}% | 下降 ${descentM}m | ${durationMin} 分鐘\n已自動暫停計時`;
  }
}
