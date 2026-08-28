import type { AppStateStatus } from "react-native";

/**
 * Android 撥出／接聽電話時，騎乘頁通常會進入 inactive 或 background。
 * 在未使用額外通話讀取權限的前提下，將非 active 狀態視為必須讓出音訊焦點，
 * 但不改變 GPS 追蹤與本機通知。
 */
export function shouldSuppressRideAudioForSystemInterruption(appState: AppStateStatus): boolean {
  return appState !== "active";
}
