import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { parseGpx } from "@/lib/gpx-parser";
import type { RideRecord } from "@/lib/ride-context";

const BIKE_RECORDS_KEY = "@bike_records";

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
  sourceType: "gpx" | "json";
}

function createRecordFromGpx(content: string, fileName: string): RideRecord {
  const route = parseGpx(content);
  if (!route) throw new Error("無法解析 GPX 路線。");
  const points = route.points.map((point, index) => ({
    latitude: point.lat,
    longitude: point.lon,
    altitude: point.ele,
    speed: null,
    timestamp: point.time ? Date.parse(point.time) : Date.now() + index * 1000,
  }));
  const maxElevation = points.length ? Math.max(...points.map((point) => point.altitude ?? 0)) : 0;
  const duration = Math.max(0, route.estimatedDuration);
  return {
    id: `imported-gpx-${Date.now()}`,
    date: Date.now(),
    name: route.name || fileName.replace(/\.gpx$/i, "") || "匯入 GPX 騎乘",
    duration,
    distance: route.totalDistance,
    avgSpeed: duration > 0 ? route.totalDistance / 1000 / (duration / 3600) : 0,
    maxSpeed: 0,
    totalAscent: route.totalAscent,
    totalDescent: route.totalDescent,
    maxElevation,
    calories: route.estimatedCalories,
    avgPower: 0,
    maxPower: 0,
    powerZones: [0, 0, 0, 0, 0],
    powerHistory: [],
    route: points,
    totalSweatMl: 0,
    refillCount: 0,
    totalPausedSec: 0,
  };
}

function normalizeJsonRecords(value: unknown): RideRecord[] {
  const candidate = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { records?: unknown[] }).records)
      ? (value as { records: unknown[] }).records
      : [value];
  return candidate.filter((record): record is RideRecord => {
    if (!record || typeof record !== "object") return false;
    const value = record as Partial<RideRecord>;
    return typeof value.distance === "number" && Array.isArray(value.route);
  }).map((record) => ({
    ...record,
    id: record.id || `imported-json-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: record.date || Date.now(),
    name: record.name || "匯入騎乘紀錄",
    duration: record.duration || 0,
    avgSpeed: record.avgSpeed || 0,
    maxSpeed: record.maxSpeed || 0,
    totalAscent: record.totalAscent || 0,
    calories: record.calories || 0,
    avgPower: record.avgPower || 0,
    maxPower: record.maxPower || 0,
    powerZones: record.powerZones || [0, 0, 0, 0, 0],
    powerHistory: record.powerHistory || [],
    totalSweatMl: record.totalSweatMl || 0,
    refillCount: record.refillCount || 0,
    totalPausedSec: record.totalPausedSec || 0,
  }));
}

export async function importLocalRideFile(uri: string, fileName: string): Promise<ImportResult> {
  const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  const isGpx = /\.gpx$/i.test(fileName) || /<gpx[\s>]/i.test(content);
  const incoming = isGpx ? [createRecordFromGpx(content, fileName)] : normalizeJsonRecords(JSON.parse(content));
  if (!incoming.length) throw new Error("檔案內沒有可匯入的騎乘紀錄。");

  const currentRaw = await AsyncStorage.getItem(BIKE_RECORDS_KEY);
  const current = currentRaw ? (JSON.parse(currentRaw) as RideRecord[]) : [];
  const knownIds = new Set(current.map((record) => record.id));
  const unique = incoming.filter((record) => !knownIds.has(record.id));
  await AsyncStorage.setItem(BIKE_RECORDS_KEY, JSON.stringify([...unique, ...current]));

  return {
    importedCount: unique.length,
    skippedCount: incoming.length - unique.length,
    sourceType: isGpx ? "gpx" : "json",
  };
}
