import { Encoder, Profile } from "@garmin/fitsdk";
import type { LocationPoint, RideRecord } from "./ride-context";

function safeDate(timestamp: number, fallback: number): Date {
  const value = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
  return new Date(value);
}

function finite(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function validRoute(route: LocationPoint[]): LocationPoint[] {
  return route.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
}

/**
 * 建立可由標準 FIT 工具讀取的 Cycling activity 檔。
 * 僅使用 Garmin 官方 JavaScript SDK；不包含原生橋接、雲端轉檔或 C++ 模組。
 */
export function createFitBytes(record: RideRecord): Uint8Array | null {
  const route = validRoute(record.route);
  if (route.length < 2) return null;

  const encoder = new Encoder();
  const startTime = safeDate(route[0].timestamp, record.date);
  const endTime = safeDate(route.at(-1)?.timestamp ?? record.date + record.duration * 1_000, record.date + record.duration * 1_000);
  const totalTimerTime = Math.max(0, record.movingTime ?? record.duration - record.totalPausedSec);

  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: "activity",
    manufacturer: "development",
    product: 1,
    serialNumber: 0,
    timeCreated: startTime,
  } as any);
  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: startTime,
    event: "timer",
    eventType: "start",
  } as any);

  let distanceM = 0;
  route.forEach((point, index) => {
    const previous = route[Math.max(0, index - 1)];
    if (index > 0) {
      const latRadians = (point.latitude - previous.latitude) * Math.PI / 180;
      const lonRadians = (point.longitude - previous.longitude) * Math.PI / 180;
      const latitude = previous.latitude * Math.PI / 180;
      const nextLatitude = point.latitude * Math.PI / 180;
      const haversine = Math.sin(latRadians / 2) ** 2 + Math.cos(latitude) * Math.cos(nextLatitude) * Math.sin(lonRadians / 2) ** 2;
      distanceM += 2 * 6_371_000 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }
    const fields: Record<string, unknown> = {
      timestamp: safeDate(point.timestamp, startTime.getTime() + index * 1_000),
      positionLat: point.latitude,
      positionLong: point.longitude,
      distance: Math.min(record.distance, distanceM),
    };
    const altitude = finite(point.altitude);
    const speed = finite(point.speed);
    const power = finite(point.power);
    const heartRate = finite(point.heartRate);
    const cadence = finite(point.cadence);
    if (altitude !== undefined) fields.altitude = altitude;
    if (speed !== undefined) fields.speed = speed;
    if (power !== undefined) fields.power = Math.round(power);
    if (heartRate !== undefined) fields.heartRate = Math.round(heartRate);
    if (cadence !== undefined) fields.cadence = Math.round(cadence);
    encoder.onMesg(Profile.MesgNum.RECORD, fields);
  });

  const totals = {
    timestamp: endTime,
    startTime,
    totalElapsedTime: Math.max(0, record.duration),
    totalTimerTime,
    totalDistance: record.distance,
    totalAscent: Math.round(record.totalAscent),
    totalDescent: Math.round(record.totalDescent ?? 0),
    avgSpeed: record.avgSpeed / 3.6,
    maxSpeed: record.maxSpeed / 3.6,
    avgPower: Math.round(record.avgPower),
    maxPower: Math.round(record.maxPower),
    totalCalories: Math.round(record.calories),
    sport: "cycling",
  };
  const recordedLaps = record.laps ?? [];
  const lapPayloads = recordedLaps.length > 0
    ? recordedLaps.map((lap, index) => ({
        timestamp: new Date(startTime.getTime() + lap.endedAtElapsedSec * 1_000),
        startTime: new Date(startTime.getTime() + lap.startedAtElapsedSec * 1_000),
        totalElapsedTime: lap.movingTimeSec,
        totalTimerTime: lap.movingTimeSec,
        totalDistance: lap.distanceM,
        totalAscent: Math.round(lap.ascentM),
        totalDescent: Math.round(lap.descentM),
        avgSpeed: lap.averageSpeedKmh === undefined ? undefined : lap.averageSpeedKmh / 3.6,
        maxSpeed: lap.maxSpeedKmh === undefined ? undefined : lap.maxSpeedKmh / 3.6,
        avgPower: lap.averagePowerW,
        messageIndex: index,
      }))
    : [{ ...totals, messageIndex: 0 }];
  lapPayloads.forEach((lap) => {
    encoder.onMesg(Profile.MesgNum.LAP, { ...lap, event: "lap", eventType: "stop" } as any);
  });
  encoder.onMesg(Profile.MesgNum.SESSION, { ...totals, event: "session", eventType: "stop", subSport: "generic" } as any);
  encoder.onMesg(Profile.MesgNum.EVENT, { timestamp: endTime, event: "timer", eventType: "stopAll" } as any);
  encoder.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: endTime,
    totalTimerTime,
    numSessions: 1,
    type: "manual",
    event: "activity",
    eventType: "stop",
  } as any);
  return encoder.close();
}

export function fitFilename(record: RideRecord): string {
  const date = new Date(record.date);
  const safeName = (record.name || "bike-ride").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").replace(/^-+|-+$/g, "") || "bike-ride";
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  return `${safeName}-${stamp}.fit`;
}
