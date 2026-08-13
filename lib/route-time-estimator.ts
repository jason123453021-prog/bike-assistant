import { calculatePower, calcAirDensity, haversineDistance } from "./power-calc";
import type { GpxRoute } from "./gpx-parser";
import { getHeadwindMs } from "./weather-service";

export interface RouteTimeEstimate {
  estimatedDurationSeconds: number;
  lowerDurationSeconds: number;
  upperDurationSeconds: number;
  movingAverageKmh: number;
  targetPowerW: number;
  intensityFactor: number;
  averageHeadwindMs: number;
  confidence: "low" | "medium" | "high";
  factors: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function selectSustainableIntensity(route: GpxRoute): number {
  const roughHours = Math.max(0.75, route.totalDistance / 22000 + route.totalAscent / 900);
  if (roughHours <= 1.25) return 0.82;
  if (roughHours <= 2.5) return 0.76;
  if (roughHours <= 4.5) return 0.70;
  return 0.64;
}

function solveSpeedForPower(
  targetPowerW: number,
  gradePct: number,
  riderWeightKg: number,
  bikeWeightKg: number,
  airDensityKgM3: number,
  headwindMs: number,
): number {
  let low = 1.4;
  let high = gradePct < -2 ? 15.5 : 13.5;
  for (let i = 0; i < 22; i += 1) {
    const middle = (low + high) / 2;
    const required = calculatePower({
      speedMs: middle,
      gradePct,
      windSpeedMs: headwindMs,
      riderMassKg: riderWeightKg,
      bikeMassKg: bikeWeightKg,
      airDensityKgM3,
    });
    if (required <= targetPowerW) low = middle;
    else high = middle;
  }
  return low;
}

/**
 * 根據 GPX 逐段坡度與可長時間維持的 FTP 比例估算「移動時間」。
 * 不納入休息、紅綠燈、路況或實際風，因此以保守區間呈現。
 */
export function estimateRouteCompletionTime(input: {
  route: GpxRoute;
  ftpW: number;
  riderWeightKg: number;
  bikeWeightKg?: number;
  temperatureC?: number;
  humidityPct?: number;
  windSpeedKmh?: number;
  windDirection?: number;
}): RouteTimeEstimate {
  const { route } = input;
  const riderWeightKg = clamp(input.riderWeightKg, 35, 180);
  const bikeWeightKg = clamp(input.bikeWeightKg ?? 10, 5, 35);
  const intensityFactor = selectSustainableIntensity(route);
  const targetPowerW = Math.round(clamp(input.ftpW, 80, 600) * intensityFactor);
  const airDensityKgM3 = calcAirDensity(input.temperatureC ?? 20, input.humidityPct ?? 60);

  let movingSeconds = 0;
  let weightedHeadwindMs = 0;
  for (let index = 1; index < route.points.length; index += 1) {
    const previous = route.points[index - 1];
    const point = route.points[index];
    const distanceM = haversineDistance(previous.lat, previous.lon, point.lat, point.lon);
    if (!Number.isFinite(distanceM) || distanceM < 1 || distanceM > 5000) continue;
    const gradePct = clamp(((point.ele - previous.ele) / distanceM) * 100, -18, 18);
    const headingDeg = (Math.atan2(
      Math.sin((point.lon - previous.lon) * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180),
      Math.cos(previous.lat * Math.PI / 180) * Math.sin(point.lat * Math.PI / 180) -
      Math.sin(previous.lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) * Math.cos((point.lon - previous.lon) * Math.PI / 180),
    ) * 180 / Math.PI + 360) % 360;
    const headwindMs = input.windSpeedKmh && input.windDirection !== undefined
      ? getHeadwindMs(headingDeg, input.windDirection, input.windSpeedKmh)
      : 0;
    const speedMs = solveSpeedForPower(targetPowerW, gradePct, riderWeightKg, bikeWeightKg, airDensityKgM3, headwindMs);
    movingSeconds += distanceM / speedMs;
    weightedHeadwindMs += headwindMs * distanceM;
  }

  const estimatedDurationSeconds = Math.max(60, Math.round(movingSeconds || route.estimatedDuration));
  const elevationDataAvailable = route.points.some((point) => Math.abs(point.ele) > 0);
  const uncertainty = elevationDataAvailable ? 0.13 : 0.2;
  const confidence: RouteTimeEstimate["confidence"] = elevationDataAvailable && route.points.length >= 25 ? "medium" : "low";
  return {
    estimatedDurationSeconds,
    lowerDurationSeconds: Math.round(estimatedDurationSeconds * (1 - uncertainty)),
    upperDurationSeconds: Math.round(estimatedDurationSeconds * (1 + uncertainty)),
    movingAverageKmh: Number(((route.totalDistance / estimatedDurationSeconds) * 3.6).toFixed(1)),
    targetPowerW,
    intensityFactor,
    averageHeadwindMs: route.totalDistance > 0 ? weightedHeadwindMs / route.totalDistance : 0,
    confidence,
    factors: [
      `App 自動 FTP ${Math.round(input.ftpW)} W`,
      `總重 ${(riderWeightKg + bikeWeightKg).toFixed(1)} kg`,
      "GPX 逐段距離與坡度",
      input.windSpeedKmh ? `起點風速 ${Math.round(input.windSpeedKmh)} km/h／逐段風向修正` : "預設無風與一般公路阻力",
    ],
  };
}
