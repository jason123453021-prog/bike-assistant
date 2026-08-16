import type { GovernedSportType, SportModelProfile } from "./model-governance";

export const MODEL_UPDATE_SCHEMA_VERSION = 1;
export const MODEL_UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const MODEL_UPDATE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

export interface RemoteModelPayload {
  schemaVersion: typeof MODEL_UPDATE_SCHEMA_VERSION;
  issuedAt: string;
  model: {
    version: string;
    sourceIds: string[];
    profiles: Record<GovernedSportType, SportModelProfile>;
  };
}

export interface RemoteModelManifest extends RemoteModelPayload {
  payloadSha256: string;
}

const SPORT_TYPES: GovernedSportType[] = ["cycling", "running", "hiking", "trail_running"];
const VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isSportModelProfile(value: unknown): value is SportModelProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as SportModelProfile;
  return typeof profile.label === "string"
    && profile.label.length > 0
    && isFiniteInRange(profile.tracking?.gpsDistanceIntervalM, 0.25, 20)
    && isFiniteInRange(profile.tracking?.stationaryDriftThresholdM, 0.05, 10)
    && (profile.tracking?.autoPauseMode === "automatic" || profile.tracking?.autoPauseMode === "suggest")
    && isFiniteInRange(profile.tracking?.autoPauseSpeedBelowKmh, 0.1, 8)
    && isFiniteInRange(profile.tracking?.autoPauseStillForSeconds, 5, 600)
    && typeof profile.tracking?.requiresStillness === "boolean"
    && isFiniteInRange(profile.calorieMetMultiplier, 0.75, 1.3)
    && isFiniteInRange(profile.supply?.carbohydrateRateMultiplier, 0.75, 1.3)
    && isFiniteInRange(profile.supply?.hydrationRateMultiplier, 0.75, 1.3);
}

export function serializeModelPayload(payload: RemoteModelPayload): string {
  return JSON.stringify({
    schemaVersion: payload.schemaVersion,
    issuedAt: payload.issuedAt,
    model: {
      version: payload.model.version,
      sourceIds: payload.model.sourceIds,
      profiles: {
        cycling: payload.model.profiles.cycling,
        running: payload.model.profiles.running,
        hiking: payload.model.profiles.hiking,
        trail_running: payload.model.profiles.trail_running,
      },
    },
  });
}

export function isModelVersionNewer(candidate: string, current: string): boolean {
  if (!VERSION_PATTERN.test(candidate) || !VERSION_PATTERN.test(current)) return false;
  const candidateParts = candidate.split(".").map(Number);
  const currentParts = current.split(".").map(Number);
  for (let index = 0; index < Math.max(candidateParts.length, currentParts.length); index += 1) {
    const difference = (candidateParts[index] ?? 0) - (currentParts[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

export function isValidRemoteModelManifest(
  value: unknown,
  now = Date.now(),
  trustedSourceIds?: readonly string[],
): value is RemoteModelManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as RemoteModelManifest;
  const issuedAt = Date.parse(manifest.issuedAt);
  if (manifest.schemaVersion !== MODEL_UPDATE_SCHEMA_VERSION
    || !Number.isFinite(issuedAt)
    || issuedAt > now + 5 * 60 * 1000
    || now - issuedAt > MODEL_UPDATE_MAX_AGE_MS
    || !SHA256_PATTERN.test(manifest.payloadSha256)
    || !VERSION_PATTERN.test(manifest.model?.version)
    || !Array.isArray(manifest.model?.sourceIds)
    || manifest.model.sourceIds.length === 0) return false;

  const sourcesMatch = !trustedSourceIds || (
    manifest.model.sourceIds.length === trustedSourceIds.length
    && manifest.model.sourceIds.every((sourceId) => trustedSourceIds.includes(sourceId))
  );
  return sourcesMatch && SPORT_TYPES.every((sportType) => isSportModelProfile(manifest.model.profiles?.[sportType]));
}
