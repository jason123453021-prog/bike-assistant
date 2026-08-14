import type { LocationPoint } from "./ride-context";

export type ReplaySpeed = 1 | 2 | 4;

/**
 * 將長路線收斂為有限但均勻的回放影格，保留起訖點並避免每次回放都向地圖橋接傳送完整軌跡。
 */
export function buildReplayFrames(route: LocationPoint[], maxFrames = 280): LocationPoint[] {
  if (route.length <= maxFrames) return route.slice();
  const frames: LocationPoint[] = [];
  const stride = (route.length - 1) / (maxFrames - 1);
  for (let frame = 0; frame < maxFrames; frame += 1) {
    frames.push(route[Math.min(route.length - 1, Math.round(frame * stride))]);
  }
  return frames;
}

/** 將高倍率限制在可安全處理的更新頻率，維持實機地圖動畫平順。 */
export function replayFrameDelayMs(speed: ReplaySpeed): number {
  return speed === 4 ? 48 : speed === 2 ? 86 : 172;
}
