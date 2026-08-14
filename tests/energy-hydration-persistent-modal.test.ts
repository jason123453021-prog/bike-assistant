import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const modalSource = readFileSync(resolve(process.cwd(), "components/supply-modal.tsx"), "utf8");
const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");

describe("energy and hydration persistent reminders", () => {
  it("renders one focused modal that supports independent energy, water, and simultaneous alerts", () => {
    expect(modalSource).toContain("const visible = calorieAlert || waterAlert");
    expect(modalSource).toContain("const bothAlert = calorieAlert && waterAlert");
    expect(modalSource).toContain("已補充能量");
    expect(modalSource).toContain("已補充水分");
  });

  it("re-displays pending energy or water alerts and resets only after the matching confirmation", () => {
    expect(mapSource).toContain("const caloriePending = pendingCalorieRef.current");
    expect(mapSource).toContain("const waterPending = pendingWaterRef.current");
    expect(mapSource).toContain("if (caloriePending) setCalorieAlert(true)");
    expect(mapSource).toContain("if (waterPending) setWaterAlert(true)");
    expect(mapSource).toContain("pendingCalorieRef.current = false");
    expect(mapSource).toContain("pendingWaterRef.current = false");
    expect(mapSource).toContain("calorieReminderSentRef.current = false");
    expect(mapSource).toContain("waterReminderSentRef.current = false");
  });
});
