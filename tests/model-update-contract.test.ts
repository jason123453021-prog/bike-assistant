import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MODEL_UPDATE_INTERVAL_MS,
  MODEL_UPDATE_SCHEMA_VERSION,
  isModelVersionNewer,
  isValidRemoteModelManifest,
  serializeModelPayload,
  type RemoteModelPayload,
} from "../lib/model-update-contract";
import { MODEL_GOVERNANCE, SPORT_MODEL_PROFILES } from "../lib/model-governance";

function createPayload(version = "2026.08.17"): RemoteModelPayload {
  return {
    schemaVersion: MODEL_UPDATE_SCHEMA_VERSION,
    issuedAt: "2026-08-16T00:00:00.000Z",
    model: {
      version,
      sourceIds: MODEL_GOVERNANCE.sources.map((source) => source.id),
      profiles: SPORT_MODEL_PROFILES,
    },
  };
}

describe("weekly verified model update", () => {
  it("uses a deterministic payload for matching server and device SHA-256 verification", () => {
    const payload = createPayload();
    const payloadSha256 = createHash("sha256").update(serializeModelPayload(payload), "utf8").digest("hex");
    expect(serializeModelPayload(payload)).toBe(serializeModelPayload({ ...payload, model: { ...payload.model } }));
    expect(isValidRemoteModelManifest(
      { ...payload, payloadSha256 },
      Date.parse("2026-08-16T01:00:00.000Z"),
      MODEL_GOVERNANCE.sources.map((source) => source.id),
    )).toBe(true);
  });

  it("rejects stale, malformed, and out-of-range model packages before they can be applied", () => {
    const payload = createPayload();
    const hash = createHash("sha256").update(serializeModelPayload(payload), "utf8").digest("hex");
    const now = Date.parse("2026-08-16T01:00:00.000Z");
    expect(isValidRemoteModelManifest({ ...payload, payloadSha256: hash }, now)).toBe(true);
    expect(isValidRemoteModelManifest({ ...payload, issuedAt: "2025-01-01T00:00:00.000Z", payloadSha256: hash }, now)).toBe(false);
    expect(isValidRemoteModelManifest({ ...payload, payloadSha256: "invalid" }, now)).toBe(false);
    expect(isValidRemoteModelManifest({
      ...payload,
      model: { ...payload.model, sourceIds: ["unreviewed-source"] },
      payloadSha256: hash,
    }, now, MODEL_GOVERNANCE.sources.map((source) => source.id))).toBe(false);
    expect(isValidRemoteModelManifest({
      ...payload,
      model: { ...payload.model, profiles: { ...payload.model.profiles, hiking: { ...payload.model.profiles.hiking, calorieMetMultiplier: 5 } } },
      payloadSha256: hash,
    }, now)).toBe(false);
  });

  it("permits only strictly newer semantic date versions and applies a seven-day throttle", () => {
    expect(isModelVersionNewer("2026.08.17", "2026.08.16")).toBe(true);
    expect(isModelVersionNewer("2026.08.16", "2026.08.16")).toBe(false);
    expect(isModelVersionNewer("2026.08.15", "2026.08.16")).toBe(false);
    expect(MODEL_UPDATE_INTERVAL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("starts checking only from the root launch flow and never from the ride-start flow", () => {
    const projectRoot = resolve(__dirname, "..");
    const layout = readFileSync(resolve(projectRoot, "app/_layout.tsx"), "utf8");
    const map = readFileSync(resolve(projectRoot, "app/(tabs)/map.tsx"), "utf8");
    const service = readFileSync(resolve(projectRoot, "lib/model-update-service.ts"), "utf8");

    expect(layout).toContain("void checkModelUpdateOnAppLaunch();");
    expect(map).not.toContain("checkModelUpdateOnAppLaunch");
    expect(service).toContain("MODEL_UPDATE_INTERVAL_MS");
    expect(service).toContain("REQUEST_TIMEOUT_MS = 5_000");
  });
});
