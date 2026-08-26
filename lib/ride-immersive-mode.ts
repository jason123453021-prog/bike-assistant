import { Platform } from "react-native";

import { reportRecoverableIssue } from "./release-safe-log";

type NavigationBarModule = {
  setBehaviorAsync?: (
    behavior: "overlay-swipe" | "inset-swipe",
  ) => Promise<void>;
  setVisibilityAsync?: (visibility: "hidden" | "visible") => Promise<void>;
};

let navigationBar: NavigationBarModule | null = null;

try {
  navigationBar = require("expo-navigation-bar") as NavigationBarModule;
} catch {
  // Web、Expo Go 或舊 binary 沒有 native module 時維持可用。
}

/**
 * 騎乘中的 Android 以可滑出的沉浸式列降低誤觸；離開騎乘或回到背景時立即恢復系統列。
 * Android 手勢導航本來可能沒有可隱藏的三鍵列，該情境會由系統自然忽略本呼叫。
 */
export async function setRideImmersiveMode(active: boolean): Promise<void> {
  if (Platform.OS !== "android" || !navigationBar) return;
  try {
    await navigationBar.setBehaviorAsync?.(
      active ? "overlay-swipe" : "inset-swipe",
    );
    await navigationBar.setVisibilityAsync?.(active ? "hidden" : "visible");
  } catch (error) {
    reportRecoverableIssue(
      "[RideImmersiveMode] Unable to update navigation bar",
      error,
    );
  }
}
