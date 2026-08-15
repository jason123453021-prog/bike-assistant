import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const modalSource = readFileSync(resolve(process.cwd(), "components/supply-modal.tsx"), "utf8");

describe("smart supply countdown UI", () => {
  it("shows countdown status and restarts only after explicit confirmation", () => {
    expect(mapSource).toContain("能量倒數");
    expect(mapSource).toContain("補水倒數");
    expect(mapSource).toContain("restartSmartSupplyCountdown");
    expect(mapSource).toContain('settings.supplyCalculationMode === "smart"');
    expect(mapSource).toContain('settings.supplyCalculationMode !== "smart" && autoDismissSeconds');
    expect(mapSource).toContain('settings.supplyCalculationMode === "smart" && (kind === "calorie" || kind === "water")');
    expect(mapSource).toContain("pendingCalorieRef.current ? {");
    expect(mapSource).toContain("pendingWaterRef.current ? {");
  });

  it("uses a native modal over the map and omits amount guidance", () => {
    expect(modalSource).toContain("<Modal");
    expect(modalSource).toContain("hardwareAccelerated");
    expect(modalSource).toContain("請補給能量");
    expect(modalSource).toContain("請補給水分");
    expect(modalSource).not.toContain("recommendedMl");
    expect(modalSource).not.toContain("recommendedEnergyKcal");
    expect(modalSource).not.toContain("recommendedCarbohydrateG");
    expect(modalSource).toContain("allowSnooze = true");
    expect(modalSource).toContain("{allowSnooze && (");
    expect(mapSource).toContain('allowSnooze={settings.supplyCalculationMode !== "smart" || (!calorieAlert && !waterAlert)}');
  });

  it("restores background or lock-screen overdue reminders on foreground without requiring new GPS points", () => {
    expect(mapSource).toContain("const smartCalorieDue = bgState.supplyCalculationMode === \"smart\"");
    expect(mapSource).toContain("const smartWaterDue = bgState.supplyCalculationMode === \"smart\"");
    expect(mapSource).toContain("bgState.calorieReminderSent || smartCalorieDue || pendingCalorieRef.current");
    expect(mapSource).toContain("bgState.waterReminderSent || smartWaterDue || pendingWaterRef.current");
    expect(mapSource).toContain("updateBackgroundSmartSupplyCountdown");
    expect(mapSource).toContain("setBackgroundSupplyReminderPending");
  });
});
