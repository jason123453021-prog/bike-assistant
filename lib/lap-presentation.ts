import type { RideLap } from "./ride-context";
import { formatPaceFromKmh, type SportType } from "./sport-metrics";

export interface LapPresentationMetric {
  id: "distance" | "average-speed" | "average-power" | "pace" | "cadence" | "ascent";
  label: string;
  value: string;
}

function formatDistance(distanceM: number): string {
  return `${(Math.max(0, distanceM) / 1_000).toFixed(2)} km`;
}

function formatAscent(ascentM: number): string {
  return `${Math.round(Math.max(0, ascentM))} m`;
}

/**
 * 單一、可測試的 Lap 顯示模型。它只呈現實際可得的感測資料，絕不補造跑步步頻。
 */
export function getLapPresentationMetrics(sportType: SportType, lap: RideLap): LapPresentationMetric[] {
  const distance: LapPresentationMetric = { id: "distance", label: "距離", value: formatDistance(lap.distanceM) };
  const ascent: LapPresentationMetric = { id: "ascent", label: "爬升", value: formatAscent(lap.ascentM) };

  if (sportType === "running" || sportType === "trail_running") {
    const metrics: LapPresentationMetric[] = [
      distance,
      { id: "pace", label: "平均配速", value: `${formatPaceFromKmh(lap.averageSpeedKmh ?? 0)} /km` },
    ];
    // 僅在定位／感測器真的有步頻樣本時呈現；沒有硬體資料便不顯示此欄位。
    if (lap.averageCadenceRpm !== undefined) {
      metrics.push({ id: "cadence", label: "平均步頻", value: `${Math.round(lap.averageCadenceRpm)} spm` });
    }
    if (sportType === "trail_running") metrics.push(ascent);
    return metrics;
  }

  if (sportType === "hiking") {
    return [ascent, distance];
  }

  return [
    distance,
    {
      id: "average-speed",
      label: "平均速度",
      value: lap.averageSpeedKmh === undefined ? "資料不足" : `${lap.averageSpeedKmh.toFixed(1)} km/h`,
    },
    {
      id: "average-power",
      label: "平均功率",
      value: lap.averagePowerW === undefined ? "資料不足" : `${Math.round(lap.averagePowerW)} W`,
    },
    ascent,
  ];
}

export function formatLapMetricsInline(sportType: SportType, lap: RideLap): string {
  return getLapPresentationMetrics(sportType, lap)
    .map((metric) => `${metric.label} ${metric.value}`)
    .join(" · ");
}
