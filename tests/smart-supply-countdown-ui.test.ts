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
  });

  it("uses a native modal over the map and omits amount guidance", () => {
    expect(modalSource).toContain("<Modal");
    expect(modalSource).toContain("hardwareAccelerated");
    expect(modalSource).toContain("請補給能量");
    expect(modalSource).toContain("請補給水分");
    expect(modalSource).not.toContain("recommendedMl");
    expect(modalSource).not.toContain("recommendedEnergyKcal");
    expect(modalSource).not.toContain("recommendedCarbohydrateG");
  });
});
