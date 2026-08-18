import { NativeModules, Platform } from "react-native";

import type { RidePipSnapshot } from "@/lib/ride-pip-snapshot";

type BikeRidePipNativeModule = {
  isSupported(): Promise<boolean>;
  setRideSnapshot(snapshot: RidePipSnapshot): void;
  close(): void;
};

const nativeBikeRidePip = NativeModules.BikeRidePip as BikeRidePipNativeModule | undefined;

export function isAndroidRidePipBridgeAvailable(): boolean {
  return Platform.OS === "android" && Boolean(nativeBikeRidePip);
}

export async function isAndroidRidePipSupported(): Promise<boolean> {
  if (!isAndroidRidePipBridgeAvailable()) return false;
  try {
    return await nativeBikeRidePip!.isSupported();
  } catch {
    return false;
  }
}

export function updateAndroidRidePipSnapshot(snapshot: RidePipSnapshot): void {
  if (!isAndroidRidePipBridgeAvailable()) return;
  try {
    nativeBikeRidePip!.setRideSnapshot(snapshot);
  } catch {
    // PiP is optional. A missing bridge in Expo Go or an unsupported device must not interrupt a ride.
  }
}

export function closeAndroidRidePip(): void {
  if (!isAndroidRidePipBridgeAvailable()) return;
  try {
    nativeBikeRidePip!.close();
  } catch {
    // Closing the optional PiP window cannot change the ride lifecycle.
  }
}
