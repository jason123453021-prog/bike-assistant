import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";

import {
  MODEL_UPDATE_INTERVAL_MS,
  isModelVersionNewer,
  isValidRemoteModelManifest,
  serializeModelPayload,
  type RemoteModelManifest,
} from "./model-update-contract";
import {
  MODEL_GOVERNANCE,
  applyVerifiedSportModelProfiles,
  getActiveModelVersion,
} from "./model-governance";

const MODEL_UPDATE_CACHE_KEY = "@bike_assistant/model-update/verified-manifest";
const MODEL_UPDATE_LAST_CHECK_KEY = "@bike_assistant/model-update/last-check-at";
const REQUEST_TIMEOUT_MS = 5_000;

export type ModelUpdateCheckResult = "throttled" | "offline-fallback" | "unchanged" | "updated" | "rejected";

function getManifestUrl(): string | null {
  const candidate = Constants.expoConfig?.extra?.modelUpdateManifestUrl;
  return typeof candidate === "string" && candidate.startsWith("https://") ? candidate : null;
}

async function verifyManifestIntegrity(manifest: RemoteModelManifest): Promise<boolean> {
  const actualHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    serializeModelPayload(manifest),
  );
  return actualHash.toLowerCase() === manifest.payloadSha256.toLowerCase();
}

function isAcceptedManifest(manifest: RemoteModelManifest): boolean {
  return isValidRemoteModelManifest(
    manifest,
    Date.now(),
    MODEL_GOVERNANCE.sources.map((source) => source.id),
  );
}

async function applyManifestIfNewer(manifest: RemoteModelManifest): Promise<boolean> {
  if (!isAcceptedManifest(manifest) || !await verifyManifestIntegrity(manifest)) return false;
  if (!isModelVersionNewer(manifest.model.version, getActiveModelVersion())) return false;
  applyVerifiedSportModelProfiles(manifest.model.version, manifest.model.profiles);
  return true;
}

/** 在任何網路請求前先恢復已驗證快取，確保離線時啟動不會使用未驗證資料。 */
export async function hydrateVerifiedModelCache(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(MODEL_UPDATE_CACHE_KEY);
    if (!stored) return false;
    return await applyManifestIfNewer(JSON.parse(stored) as RemoteModelManifest);
  } catch {
    return false;
  }
}

/**
 * 僅由 App 啟動流程呼叫；每七天最多發起一次，騎乘中絕不呼叫。
 * 所有失敗皆安靜回退至內建／已驗證快取版本，避免干擾使用者或騎乘耗電。
 */
export async function checkModelUpdateOnAppLaunch(now = Date.now()): Promise<ModelUpdateCheckResult> {
  await hydrateVerifiedModelCache();
  const manifestUrl = getManifestUrl();
  if (!manifestUrl) return "offline-fallback";

  try {
    const lastCheckAt = Number(await AsyncStorage.getItem(MODEL_UPDATE_LAST_CHECK_KEY) ?? 0);
    if (Number.isFinite(lastCheckAt) && now - lastCheckAt < MODEL_UPDATE_INTERVAL_MS) return "throttled";
    await AsyncStorage.setItem(MODEL_UPDATE_LAST_CHECK_KEY, String(now));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(manifestUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) return "offline-fallback";
      const manifest = await response.json() as RemoteModelManifest;
      if (!isAcceptedManifest(manifest) || !await verifyManifestIntegrity(manifest)) return "rejected";
      if (!isModelVersionNewer(manifest.model.version, getActiveModelVersion())) return "unchanged";
      await AsyncStorage.setItem(MODEL_UPDATE_CACHE_KEY, JSON.stringify(manifest));
      applyVerifiedSportModelProfiles(manifest.model.version, manifest.model.profiles);
      return "updated";
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return "offline-fallback";
  }
}

export const MODEL_UPDATE_METADATA = {
  intervalMs: MODEL_UPDATE_INTERVAL_MS,
  builtInVersion: MODEL_GOVERNANCE.version,
  cacheKey: MODEL_UPDATE_CACHE_KEY,
} as const;
