import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const settingsSource = readFileSync(resolve(process.cwd(), "app/(tabs)/settings.tsx"), "utf8");
const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const settingsContextSource = readFileSync(resolve(process.cwd(), "lib/settings-context.tsx"), "utf8");
const backgroundSource = readFileSync(resolve(process.cwd(), "lib/background-location.ts"), "utf8");

describe("smart supply priority", () => {
  it("turns off fixed interval reminders and disables their control when smart mode is enabled", () => {
    expect(settingsSource).toContain('supplyCalculationMode: "smart"');
    expect(settingsSource).toContain("supplyEnergyTimeIntervalEnabled: false");
    expect(settingsSource).toContain("supplyEnergyDistanceIntervalEnabled: false");
    expect(settingsSource).toContain("supplyWaterTimeIntervalEnabled: false");
    expect(settingsSource).toContain("supplyWaterDistanceIntervalEnabled: false");
  });

  it("uses the same dynamic plan for dashboard calorie and hydration thresholds", () => {
    expect(mapSource).toContain("const dashboardSupplyPlan = activeSupplyPlan ?? fallbackSupplyPlan");
    expect(mapSource).toContain("dashboardSupplyPlan.calorieTriggerKcal");
    expect(mapSource).toContain("dashboardSupplyPlan.waterTriggerMl");
    expect(mapSource).toContain('settings.supplyCalculationMode === "smart" ? false : settings.supplyEnergyTimeIntervalEnabled');
    expect(mapSource).toContain('settings.supplyCalculationMode === "smart" ? false : settings.supplyWaterTimeIntervalEnabled');
  });

  it("migrates the previous shared interval rule and keeps four distinct rules in foreground and background", () => {
    expect(settingsContextSource).toContain("hasIndependentIntervalSettings");
    expect(settingsContextSource).toContain("legacyIntervalActive");
    expect(settingsContextSource).toContain("supplyEnergyTimeIntervalMinutes");
    expect(settingsContextSource).toContain("supplyWaterDistanceIntervalKm");
    expect(backgroundSource).toContain('kind: "energy-time"');
    expect(backgroundSource).toContain('kind: "energy-distance"');
    expect(backgroundSource).toContain('kind: "water-time"');
    expect(backgroundSource).toContain('kind: "water-distance"');
    expect(mapSource).toContain('id: "supply-interval-energy-time"');
    expect(mapSource).toContain('id: "supply-interval-water-distance"');
  });

  it("explains that smart mode does not read manual thresholds and removes threshold editors", () => {
    expect(settingsSource).toContain("智慧計畫完全由 FTP");
    expect(settingsSource).toContain("下一次補水與補能量的倒數");
    expect(settingsSource).toContain("按下已補給後");
    expect(settingsSource).not.toContain("能量門檻基準");
    expect(settingsSource).not.toContain("汗液流失提醒閾值");
  });
});
