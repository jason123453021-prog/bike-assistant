import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const feedbackSource = readFileSync(resolve(process.cwd(), "lib/feedback-service.ts"), "utf8");
const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");

describe("smart supply speech reminders", () => {
  it("formats offline energy and hydration announcements with exact recommendations and reasons", () => {
    expect(feedbackSource).toContain("formatSmartSupplyReminder");
    expect(feedbackSource).toContain("plan.energyRecommendationKcal");
    expect(feedbackSource).toContain("plan.carbohydrateRecommendationG");
    expect(feedbackSource).toContain("plan.waterRecommendationMl");
    expect(feedbackSource).toContain("原因：${plan.reason}");
    expect(feedbackSource).toContain("speakSmartSupplyReminder");
  });

  it("uses smart speech for initial, repeated, and recovered pending reminders while respecting ttsEnabled", () => {
    expect(mapSource).toContain('settings.supplyCalculationMode === "smart" && recommendation');
    expect(mapSource).toContain("speakSmartSupplyReminder(type, recommendation, settings.ttsEnabled)");
    expect(mapSource).toContain("speakPlannedSupplyReminder(type, recommendation)");
    expect(mapSource).toContain("pendingSupplyPlansRef.current[type] = recommendation");
    expect(mapSource).toContain('speakPlannedSupplyReminder("calorie", pendingSupplyPlansRef.current.calorie)');
    expect(mapSource).toContain('speakPlannedSupplyReminder("water", pendingSupplyPlansRef.current.water)');
  });
});
