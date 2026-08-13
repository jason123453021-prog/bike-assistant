export type ActivityChartAxisBasis = "time" | "distance";

export interface ActivityChartAxisPoint {
  timestamp: number;
  distanceKm?: number;
}

export interface ActivityChartAxis {
  basis: ActivityChartAxisBasis;
  ratios: number[];
  startLabel: string;
  endLabel: string;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 以真實時間戳或累積距離建立圖表 X 軸，資料不足時才安全回退為採樣序。 */
export function buildActivityChartAxis(points: ActivityChartAxisPoint[], basis: ActivityChartAxisBasis): ActivityChartAxis {
  if (points.length === 0) return { basis, ratios: [], startLabel: basis === "time" ? "0:00" : "0.0 km", endLabel: basis === "time" ? "0:00" : "0.0 km" };
  const fallback = points.map((_, index) => index);
  const candidate = basis === "time"
    ? points.map((point) => point.timestamp)
    : points.map((point) => point.distanceKm ?? Number.NaN);
  const valid = candidate.every((value) => Number.isFinite(value));
  const values = valid ? candidate : fallback;
  const first = values[0];
  const last = values[values.length - 1];
  const range = last - first;
  const ratios = range > 0 ? values.map((value) => (value - first) / range) : fallback.map((_, index) => index / Math.max(1, points.length - 1));
  const elapsedSeconds = basis === "time" && valid ? Math.max(0, (last - first) / 1000) : 0;
  return {
    basis,
    ratios,
    startLabel: basis === "time" ? "0:00" : "0.0 km",
    endLabel: basis === "time" ? formatElapsed(elapsedSeconds) : `${Math.max(0, last - first).toFixed(1)} km`,
  };
}
