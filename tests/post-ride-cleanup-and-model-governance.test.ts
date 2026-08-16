import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL_GOVERNANCE, SPORT_MODEL_PROFILES } from "../lib/model-governance";
import { shouldZeroLiveRideReadings } from "../lib/live-ride-readings";
import { createSupplyPlan } from "../lib/smart-supply-plan";
import { SPORT_TRACKING_POLICIES } from "../lib/sport-metrics";

const projectRoot = resolve(__dirname, "..");

describe("post-ride cleanup and local model governance", () => {
  it("keeps the governed academic sources and version policy with the local model", () => {
    expect(MODEL_GOVERNANCE.version).toMatch(/^2026\.08\.16$/);
    expect(MODEL_GOVERNANCE.sources.map((source) => source.id)).toEqual(expect.arrayContaining([
      "adult-compendium-2024",
      "minetti-2002",
      "martin-1998",
      "acsm-fluid-replacement",
      "endurance-carbohydrates-2023",
    ]));
  });

  it("uses sport-specific GPS and pause thresholds without treating slow hiking movement as still", () => {
    expect(SPORT_TRACKING_POLICIES.hiking.autoPause.mode).toBe("suggest");
    expect(SPORT_TRACKING_POLICIES.hiking.autoPause.speedBelowKmh).toBeLessThan(0.5);
    expect(SPORT_TRACKING_POLICIES.trail_running.autoPause.speedBelowKmh).toBeLessThan(SPORT_TRACKING_POLICIES.running.autoPause.speedBelowKmh);
    expect(SPORT_MODEL_PROFILES.hiking.tracking.stationaryDriftThresholdM).toBeLessThan(SPORT_MODEL_PROFILES.running.tracking.stationaryDriftThresholdM);
    expect(shouldZeroLiveRideReadings({
      rawSpeedKmh: 0.6,
      displacementM: 1,
      accuracyM: 5,
      motionStill: true,
      pauseThresholdKmh: SPORT_TRACKING_POLICIES.hiking.autoPause.speedBelowKmh,
      driftThresholdM: SPORT_TRACKING_POLICIES.hiking.stationaryDriftThresholdM,
    })).toBe(false);
  });

  it("applies the same governed sport profile to smart supply planning", () => {
    const base = {
      mode: "smart" as const,
      elapsedSec: 3 * 60 * 60,
      riderWeightKg: 70,
      ftpW: 220,
      intensityFactor: 0.8,
      sweatRatePerHour: 850,
      environmentLoad: 0.4,
      weatherAvailable: true,
    };
    const cycling = createSupplyPlan({ ...base, sportType: "cycling" });
    const hiking = createSupplyPlan({ ...base, sportType: "hiking" });
    const trailRunning = createSupplyPlan({ ...base, sportType: "trail_running" });

    expect(hiking.carbohydrateRecommendationG).toBeLessThan(cycling.carbohydrateRecommendationG);
    expect(hiking.waterRecommendationMl).toBeLessThan(cycling.waterRecommendationMl);
    expect(trailRunning.carbohydrateRecommendationG).toBeGreaterThan(cycling.carbohydrateRecommendationG);
    expect(trailRunning.waterRecommendationMl).toBeGreaterThan(cycling.waterRecommendationMl);
  });

  it("clears smart notifications and resets only local ride state after successful record storage", () => {
    const feedback = readFileSync(resolve(projectRoot, "lib/feedback-service.ts"), "utf8");
    const map = readFileSync(resolve(projectRoot, "app/(tabs)/map.tsx"), "utf8");

    expect(feedback).toContain("export async function clearAllSmartSupplyDueNotifications()");
    expect(map).toContain("await clearAllSmartSupplyDueNotifications();");
    expect(map).toContain("setLiveTrail([]);");
    expect(map).toContain('dispatch({ type: "RESET" });');
    expect(map).toContain("if (savedRecordId) {");
  });
});
