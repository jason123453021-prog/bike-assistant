export type PersonalBestMetric = "distance" | "ascent" | "averageSpeed";

export interface PersonalBest {
  metric: PersonalBestMetric;
  label: string;
  value: number;
  unit: string;
  previousValue?: number;
}

export interface RideForPersonalBests {
  distance: number;
  totalAscent: number;
  avgSpeed: number;
  duration: number;
}

const METRICS: Array<{
  metric: PersonalBestMetric;
  label: string;
  unit: string;
  minimum: (ride: RideForPersonalBests) => boolean;
  valueOf: (ride: RideForPersonalBests) => number;
}> = [
  {
    metric: "distance",
    label: "最長距離",
    unit: "km",
    minimum: (ride) => ride.distance >= 1000,
    valueOf: (ride) => ride.distance / 1000,
  },
  {
    metric: "ascent",
    label: "最高總爬升",
    unit: "m",
    minimum: (ride) => ride.totalAscent >= 20,
    valueOf: (ride) => ride.totalAscent,
  },
  {
    metric: "averageSpeed",
    label: "最佳均速",
    unit: "km/h",
    minimum: (ride) => ride.distance >= 5000 && ride.duration >= 15 * 60,
    valueOf: (ride) => ride.avgSpeed,
  },
];

/**
 * 僅以已保存在裝置內的歷史騎乘比較個人最佳紀錄。
 * 均速紀錄設有距離與時間門檻，避免短時間 GPS 尖峰造成誤判。
 */
export function calculatePersonalBests(
  currentRide: RideForPersonalBests,
  historicalRides: RideForPersonalBests[],
): PersonalBest[] {
  return METRICS.flatMap((definition) => {
    if (!definition.minimum(currentRide)) return [];

    const currentValue = definition.valueOf(currentRide);
    const eligibleHistory = historicalRides.filter(definition.minimum);
    const previousValue = eligibleHistory.length
      ? Math.max(...eligibleHistory.map(definition.valueOf))
      : undefined;

    if (previousValue !== undefined && currentValue <= previousValue) return [];

    return [{
      metric: definition.metric,
      label: definition.label,
      value: currentValue,
      unit: definition.unit,
      previousValue,
    }];
  });
}
