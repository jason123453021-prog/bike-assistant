/**
 * 外部感測器管理
 * 支援心率帶、功率計、踏頻器配對與數據接收
 */

export type SensorType = "heart-rate" | "power-meter" | "cadence-sensor";

export interface SensorDevice {
  id: string;
  name: string;
  type: SensorType;
  macAddress: string;
  isConnected: boolean;
  lastUpdate: number;
  batteryLevel?: number;
}

export interface SensorData {
  heartRate?: number;           // bpm
  power?: number;               // watts
  cadence?: number;             // rpm
  timestamp: number;
}

export interface HeartRateZone {
  zone: 1 | 2 | 3 | 4 | 5;
  name: string;
  minBpm: number;
  maxBpm: number;
  description: string;
}

/**
 * 根據年齡計算最大心率 (Karvonen 公式)
 */
export function calculateMaxHeartRate(age: number): number {
  return 220 - age;
}

/**
 * 計算靜息心率 (假設平均 60 bpm)
 */
export function calculateRestingHeartRate(): number {
  return 60;
}

/**
 * 根據年齡計算心率區間
 * 區間 1: 恢復 (50-60% max HR)
 * 區間 2: 耐力 (60-70% max HR)
 * 區間 3: 節奏 (70-80% max HR)
 * 區間 4: 乳酸閾值 (80-90% max HR)
 * 區間 5: 無氧 (90-100% max HR)
 */
export function calculateHeartRateZones(age: number): HeartRateZone[] {
  const maxHR = calculateMaxHeartRate(age);
  const restHR = calculateRestingHeartRate();
  const reserve = maxHR - restHR;

  return [
    {
      zone: 1,
      name: "恢復",
      minBpm: Math.round(restHR + reserve * 0.5),
      maxBpm: Math.round(restHR + reserve * 0.6),
      description: "輕鬆騎乘，可交談",
    },
    {
      zone: 2,
      name: "耐力",
      minBpm: Math.round(restHR + reserve * 0.6),
      maxBpm: Math.round(restHR + reserve * 0.7),
      description: "穩定騎乘，略感吃力",
    },
    {
      zone: 3,
      name: "節奏",
      minBpm: Math.round(restHR + reserve * 0.7),
      maxBpm: Math.round(restHR + reserve * 0.8),
      description: "中等強度，呼吸加快",
    },
    {
      zone: 4,
      name: "乳酸閾值",
      minBpm: Math.round(restHR + reserve * 0.8),
      maxBpm: Math.round(restHR + reserve * 0.9),
      description: "高強度，難以交談",
    },
    {
      zone: 5,
      name: "無氧",
      minBpm: Math.round(restHR + reserve * 0.9),
      maxBpm: maxHR,
      description: "最大努力，無法交談",
    },
  ];
}

/**
 * 根據心率判斷所在區間
 */
export function getHeartRateZone(heartRate: number, zones: HeartRateZone[]): HeartRateZone | null {
  return zones.find((z) => heartRate >= z.minBpm && heartRate <= z.maxBpm) || null;
}

/**
 * 根據功率計算騎乘強度
 * FTP (Functional Threshold Power) 假設為 250W
 */
export function calculatePowerZone(power: number, ftp: number = 250): number {
  const ratio = power / ftp;
  if (ratio < 0.55) return 1; // 恢復
  if (ratio < 0.75) return 2; // 耐力
  if (ratio < 0.9) return 3;  // 節奏
  if (ratio < 1.05) return 4; // 乳酸閾值
  if (ratio < 1.2) return 5;  // 無氧
  return 6;                    // 衝刺
}

/**
 * 計算平均功率
 */
export function calculateAveragePower(powerReadings: number[]): number {
  if (powerReadings.length === 0) return 0;
  const sum = powerReadings.reduce((a, b) => a + b, 0);
  return Math.round(sum / powerReadings.length);
}

/**
 * 計算正規化功率 (Normalized Power)
 * 用於比較不同強度的騎乘
 */
export function calculateNormalizedPower(powerReadings: number[]): number {
  if (powerReadings.length === 0) return 0;
  
  // 30 秒移動平均
  const smoothed: number[] = [];
  for (let i = 0; i < powerReadings.length; i++) {
    const start = Math.max(0, i - 15);
    const end = Math.min(powerReadings.length, i + 15);
    const avg = powerReadings.slice(start, end).reduce((a, b) => a + b, 0) / (end - start);
    smoothed.push(avg);
  }

  // 計算第 4 次方平均
  const fourthPower = smoothed.map((p) => Math.pow(p, 4));
  const avg4 = fourthPower.reduce((a, b) => a + b, 0) / fourthPower.length;
  
  return Math.round(Math.pow(avg4, 0.25));
}

/**
 * 計算踏頻平均值
 */
export function calculateAverageCadence(cadenceReadings: number[]): number {
  if (cadenceReadings.length === 0) return 0;
  const sum = cadenceReadings.reduce((a, b) => a + b, 0);
  return Math.round(sum / cadenceReadings.length);
}

/**
 * 生成感測器狀態報告
 */
export function generateSensorStatusReport(devices: SensorDevice[]): string {
  const connected = devices.filter((d) => d.isConnected);
  const disconnected = devices.filter((d) => !d.isConnected);

  let report = `📊 感測器狀態\n\n`;
  
  if (connected.length > 0) {
    report += `✅ 已連接 (${connected.length}):\n`;
    connected.forEach((d) => {
      const battery = d.batteryLevel !== undefined ? ` 🔋 ${d.batteryLevel}%` : "";
      report += `  • ${d.name}${battery}\n`;
    });
  }

  if (disconnected.length > 0) {
    report += `\n❌ 未連接 (${disconnected.length}):\n`;
    disconnected.forEach((d) => {
      report += `  • ${d.name}\n`;
    });
  }

  return report;
}
