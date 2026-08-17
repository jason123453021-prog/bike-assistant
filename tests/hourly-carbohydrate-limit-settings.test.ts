import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const settingsSource = readFileSync(resolve(root, "lib/settings-context.tsx"), "utf8");
const settingsScreenSource = readFileSync(resolve(root, "app/(tabs)/settings.tsx"), "utf8");
const backgroundSource = readFileSync(resolve(root, "lib/background-location.ts"), "utf8");

describe("hourly carbohydrate limit setting integration", () => {
  it("persists scientific/manual mode and a bounded manual backup value", () => {
    expect(settingsSource).toContain('energyCarbohydrateHourlyLimitMode: "science" | "manual"');
    expect(settingsSource).toContain('energyCarbohydrateHourlyLimitMode: "science"');
    expect(settingsSource).toContain("energyCarbohydrateHourlyLimitG: 60");
    expect(settingsSource).toContain("Math.min(90, Math.max(20, Number(saved.energyCarbohydrateHourlyLimitG)" );
  });

  it("renders both the scientific switch and a safe manual input range", () => {
    expect(settingsScreenSource).toContain("每小時碳水採科學建議");
    expect(settingsScreenSource).toContain("每小時碳水上限");
    expect(settingsScreenSource).toContain("Math.min(90, Math.max(20, Math.round(num)))");
    expect(settingsScreenSource).toContain("目前依 ${settings.weight} kg 推導為 ${effectiveCarbohydrateHourlyLimitG} g/h");
  });

  it("sends the limit through the background rider profile for lock-screen continuity", () => {
    expect(backgroundSource).toContain("energyCarbohydrateHourlyLimitMode?: \"science\" | \"manual\"");
    expect(backgroundSource).toContain("energyCarbohydrateHourlyLimitG?: number");
    expect(backgroundSource).toContain("updateBackgroundRiderProfile");
  });
});
