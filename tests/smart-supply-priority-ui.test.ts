import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const settingsSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/settings.tsx"),
  "utf8",
);
const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
).replace(/\s+/g, " ");
const settingsContextSource = readFileSync(
  resolve(process.cwd(), "lib/settings-context.tsx"),
  "utf8",
);
const backgroundSource = readFileSync(
  resolve(process.cwd(), "lib/background-location.ts"),
  "utf8",
);

describe("smart supply priority", () => {
  it("turns off only the matching fixed interval reminders when each smart channel is enabled", () => {
    expect(settingsSource).toContain('label="智慧能量補給"');
    expect(settingsSource).toContain('label="智慧補水"');
    expect(settingsSource).toContain("smartEnergySupplyEnabled: enabled");
    expect(settingsSource).toContain("smartWaterSupplyEnabled: enabled");
    expect(settingsSource).toContain("supplyEnergyTimeIntervalEnabled: false");
    expect(settingsSource).toContain(
      "supplyEnergyDistanceIntervalEnabled: false",
    );
    expect(settingsSource).toContain("supplyWaterTimeIntervalEnabled: false");
    expect(settingsSource).toContain(
      "supplyWaterDistanceIntervalEnabled: false",
    );
  });

  it("uses the same dynamic plan for dashboard calorie and hydration thresholds", () => {
    expect(mapSource).toContain(
      "const dashboardSupplyPlan = activeSupplyPlan ?? fallbackSupplyPlan",
    );
    expect(mapSource).toContain("dashboardSupplyPlan.calorieTriggerKcal");
    expect(mapSource).toContain("dashboardSupplyPlan.waterTriggerMl");
    expect(mapSource).toContain(
      "timeEnabled: smartEnergySupplyEnabled ? false : settings.supplyEnergyTimeIntervalEnabled",
    );
    expect(mapSource).toContain(
      "timeEnabled: smartWaterSupplyEnabled ? false : settings.supplyWaterTimeIntervalEnabled",
    );
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

  it("explains independent smart channels and removes threshold editors", () => {
    expect(settingsSource).toContain("能量與補水皆採智慧倒數");
    expect(settingsSource).toContain("僅能量採智慧倒數");
    expect(settingsSource).toContain("僅補水採智慧倒數");
    expect(settingsSource).not.toContain("能量門檻基準");
    expect(settingsSource).not.toContain("汗液流失提醒閾值");
  });
});
