/**
 * 車頭朝前視角鎖定管理
 * 
 * 功能：
 * 1. 指南針方向與移動向量融合
 * 2. 靜止防抖過濾（速度 < 1 km/h）
 * 3. 地圖旋轉角度與用戶位置中心鎖定
 */

import { LocationObject } from 'expo-location';

export interface HeadingLockState {
  enabled: boolean;
  currentHeading: number; // 0-360 度
  mapRotation: number; // 地圖旋轉角度
  userLatitude: number;
  userLongitude: number;
  lastUpdateTime: number;
}

export interface HeadingLockConfig {
  enableStabilization: boolean; // 啟用穩定化濾波
  stabilizationThreshold: number; // 速度閾值（km/h），低於此值使用指南針權重
  compassWeight: number; // 指南針權重（0-1）
  movementWeight: number; // 移動向量權重（0-1）
  filterSamples: number; // 濾波樣本數
}

const DEFAULT_CONFIG: HeadingLockConfig = {
  enableStabilization: true,
  stabilizationThreshold: 1, // 1 km/h
  compassWeight: 0.7,
  movementWeight: 0.3,
  filterSamples: 5,
};

let headingBuffer: number[] = [];
let lastLocation: LocationObject | null = null;

/**
 * 計算移動向量方向（0-360 度）
 */
function calculateMovementHeading(from: LocationObject, to: LocationObject): number {
  const dLat = to.coords.latitude - from.coords.latitude;
  const dLon = to.coords.longitude - from.coords.longitude;

  let heading = Math.atan2(dLon, dLat) * (180 / Math.PI);

  // 轉換為 0-360 範圍
  if (heading < 0) {
    heading += 360;
  }

  return heading;
}

/**
 * 計算兩點間距離（單位：m）
 */
function calculateDistance(from: LocationObject, to: LocationObject): number {
  const R = 6371000; // 地球半徑（m）
  const dLat = ((to.coords.latitude - from.coords.latitude) * Math.PI) / 180;
  const dLon = ((to.coords.longitude - from.coords.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.coords.latitude * Math.PI) / 180) *
      Math.cos((to.coords.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 融合指南針方向與移動向量
 */
function fuseHeadings(
  compassHeading: number,
  movementHeading: number | null,
  speed: number,
  config: HeadingLockConfig
): number {
  // 如果速度太低，優先使用指南針
  if (speed < config.stabilizationThreshold || movementHeading === null) {
    return compassHeading;
  }

  // 融合兩個方向
  const fusedHeading =
    compassHeading * config.compassWeight + movementHeading * config.movementWeight;

  return fusedHeading % 360;
}

/**
 * 應用濾波器平滑方向變化
 */
function applyHeadingFilter(newHeading: number, config: HeadingLockConfig): number {
  headingBuffer.push(newHeading);

  // 保持緩衝區大小
  if (headingBuffer.length > config.filterSamples) {
    headingBuffer.shift();
  }

  // 計算平均值（考慮角度環繞）
  if (headingBuffer.length === 0) {
    return newHeading;
  }

  let sinSum = 0;
  let cosSum = 0;

  for (const heading of headingBuffer) {
    const rad = (heading * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }

  const avgRad = Math.atan2(sinSum / headingBuffer.length, cosSum / headingBuffer.length);
  let avgHeading = (avgRad * 180) / Math.PI;

  if (avgHeading < 0) {
    avgHeading += 360;
  }

  return avgHeading;
}

/**
 * 更新車頭朝前狀態
 */
export function updateHeadingLockState(
  location: LocationObject,
  compassHeading: number,
  config: HeadingLockConfig = DEFAULT_CONFIG
): HeadingLockState {
  const speed = (location.coords.speed || 0) * 3.6; // 轉換為 km/h

  // 計算移動向量方向
  let movementHeading: number | null = null;
  if (lastLocation) {
    const distance = calculateDistance(lastLocation, location);
    // 只有距離足夠大時才計算移動方向
    if (distance > 5) {
      movementHeading = calculateMovementHeading(lastLocation, location);
    }
  }

  // 融合方向
  let heading = fuseHeadings(compassHeading, movementHeading, speed, config);

  // 應用濾波器
  if (config.enableStabilization) {
    heading = applyHeadingFilter(heading, config);
  }

  // 更新最後位置
  lastLocation = location;

  return {
    enabled: true,
    currentHeading: heading,
    mapRotation: heading,
    userLatitude: location.coords.latitude,
    userLongitude: location.coords.longitude,
    lastUpdateTime: Date.now(),
  };
}

/**
 * 重置濾波緩衝區
 */
export function resetHeadingFilter(): void {
  headingBuffer = [];
  lastLocation = null;
}

/**
 * 計算地圖中心點（用於保持用戶在中心）
 */
export function calculateMapCenter(
  userLat: number,
  userLon: number,
  mapZoom: number
): { latitude: number; longitude: number } {
  // 簡化版：直接返回用戶位置
  // 實際應用中可能需要考慮地圖邊界和螢幕尺寸
  return {
    latitude: userLat,
    longitude: userLon,
  };
}

/**
 * 驗證方向變化是否過大（用於異常檢測）
 */
export function isHeadingAnomalous(
  previousHeading: number,
  currentHeading: number,
  threshold: number = 45 // 度
): boolean {
  let diff = Math.abs(currentHeading - previousHeading);

  // 處理 360 度環繞
  if (diff > 180) {
    diff = 360 - diff;
  }

  return diff > threshold;
}
