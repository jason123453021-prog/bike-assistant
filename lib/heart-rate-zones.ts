/**
 * 心率區間自動校準模組
 * 根據用戶實際心率數據自動校準心率區間（Zone 1-5）
 */

export interface HeartRateZone {
  name: string;
  min: number;
  max: number;
  color: string;
  minBpm?: number;
  maxBpm?: number;
}

export interface HeartRateCalibration {
  maxHeartRate: number;
  restingHeartRate: number;
  zones: HeartRateZone[];
  calibratedAt: number;
}

/**
 * 根據最大心率計算心率儲備
 * HRR = MaxHR - RHR
 */
export function calculateHeartRateReserve(maxHR: number, restingHR: number = 60): number {
  return Math.max(0, maxHR - restingHR);
}

/**
 * 根據 Karvonen 公式計算心率區間
 * 使用心率儲備百分比而不是最大心率百分比，更準確
 */
export function calculateHeartRateZones(
  maxHeartRate: number,
  restingHeartRate: number = 60
): HeartRateZone[] {
  const hrr = calculateHeartRateReserve(maxHeartRate, restingHeartRate);

  // Zone 定義（使用 Karvonen 公式的百分比）
  const zones: HeartRateZone[] = [
    {
      name: "恢復",
      min: 0.5,
      max: 0.6,
      color: "#4FC3F7",
      minBpm: Math.round(restingHeartRate + hrr * 0.5),
      maxBpm: Math.round(restingHeartRate + hrr * 0.6),
    },
    {
      name: "有氧基礎",
      min: 0.6,
      max: 0.7,
      color: "#66BB6A",
      minBpm: Math.round(restingHeartRate + hrr * 0.6),
      maxBpm: Math.round(restingHeartRate + hrr * 0.7),
    },
    {
      name: "有氧耐力",
      min: 0.7,
      max: 0.8,
      color: "#FDD835",
      minBpm: Math.round(restingHeartRate + hrr * 0.7),
      maxBpm: Math.round(restingHeartRate + hrr * 0.8),
    },
    {
      name: "乳酸閾值",
      min: 0.8,
      max: 0.9,
      color: "#FB8C00",
      minBpm: Math.round(restingHeartRate + hrr * 0.8),
      maxBpm: Math.round(restingHeartRate + hrr * 0.9),
    },
    {
      name: "最大強度",
      min: 0.9,
      max: 1.0,
      color: "#E53935",
      minBpm: Math.round(restingHeartRate + hrr * 0.9),
      maxBpm: maxHeartRate,
    },
  ];

  return zones;
}

/**
 * 從歷史騎乘記錄中自動偵測最大心率
 * 取歷史最大心率的前 10% 作為代表
 */
export function detectMaxHeartRate(rideRecords: any[]): number {
  if (!rideRecords || rideRecords.length === 0) {
    return 200; // 默認值
  }

  // 收集所有最大心率
  const maxHeartRates = rideRecords
    .filter((r) => r.maxHeartRate && r.maxHeartRate > 0)
    .map((r) => r.maxHeartRate)
    .sort((a, b) => b - a);

  if (maxHeartRates.length === 0) {
    return 200; // 默認值
  }

  // 取前 10% 的最大值的平均
  const topCount = Math.max(1, Math.ceil(maxHeartRates.length * 0.1));
  const topValues = maxHeartRates.slice(0, topCount);
  const avgTopMaxHR = Math.round(topValues.reduce((a, b) => a + b, 0) / topValues.length);

  // 確保在合理範圍內（150-220 bpm）
  return Math.max(150, Math.min(220, avgTopMaxHR));
}

/**
 * 從歷史騎乘記錄中估算靜息心率
 * 取所有最小心率的平均
 */
export function estimateRestingHeartRate(rideRecords: any[]): number {
  if (!rideRecords || rideRecords.length === 0) {
    return 60; // 默認值
  }

  // 收集所有最小心率（假設每次騎乘的最小心率接近靜息心率）
  const minHeartRates = rideRecords
    .filter((r) => r.minHeartRate && r.minHeartRate > 0)
    .map((r) => r.minHeartRate)
    .sort((a, b) => a - b);

  if (minHeartRates.length === 0) {
    return 60; // 默認值
  }

  // 取最低的 10% 的平均
  const bottomCount = Math.max(1, Math.ceil(minHeartRates.length * 0.1));
  const bottomValues = minHeartRates.slice(0, bottomCount);
  const avgBottomMinHR = Math.round(bottomValues.reduce((a, b) => a + b, 0) / bottomValues.length);

  // 確保在合理範圍內（40-100 bpm）
  return Math.max(40, Math.min(100, avgBottomMinHR));
}

/**
 * 計算心率在各區間的分布
 * 基於實際心率數據而不是估算
 */
export function calculateHeartRateDistribution(
  heartRateData: number[],
  zones: HeartRateZone[]
): number[] {
  const distribution = [0, 0, 0, 0, 0];

  if (!heartRateData || heartRateData.length === 0) {
    return distribution;
  }

  heartRateData.forEach((hr) => {
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const minBpm = zone.minBpm || 0;
      const maxBpm = zone.maxBpm || 220;

      if (hr >= minBpm && hr <= maxBpm) {
        distribution[i]++;
        break;
      }
    }
  });

  return distribution;
}

/**
 * 獲取自動校準的心率區間
 */
export function getAutoCalibrationZones(
  rideRecords: any[],
  userRestingHeartRate?: number
): HeartRateCalibration {
  const maxHR = detectMaxHeartRate(rideRecords);
  const restingHR = userRestingHeartRate || estimateRestingHeartRate(rideRecords);
  const zones = calculateHeartRateZones(maxHR, restingHR);

  return {
    maxHeartRate: maxHR,
    restingHeartRate: restingHR,
    zones,
    calibratedAt: Date.now(),
  };
}
