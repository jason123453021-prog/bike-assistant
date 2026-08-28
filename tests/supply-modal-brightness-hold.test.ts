import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const managerSource = readFileSync(
  resolve(process.cwd(), "lib/power-saving/smart-power-saving-system.ts"),
  "utf8",
).replace(/\s+/g, " ");
const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
).replace(/\s+/g, " ");

describe("supply modal brightness hold", () => {
  it("keeps a named brightness hold while a supply confirmation is pending", () => {
    expect(managerSource).toContain(
      "private brightnessHolds = new Set<string>()",
    );
    expect(managerSource).toContain("async holdBrightness(key: string)");
    expect(managerSource).toContain("this.brightnessHolds.add(key)");
    expect(managerSource).toContain("this.brightnessHolds.size > 0");
  });

  it("only restarts the dim timer after the final brightness hold is released", () => {
    expect(managerSource).toContain("releaseBrightnessHold(key: string)");
    expect(managerSource).toContain(
      "if (this.rideSessionActive && this.brightnessHolds.size === 0) this.resetInactivityTimer()",
    );
  });

  it("holds the screen for energy, water, custom, and interval supply confirmations", () => {
    expect(mapSource).toContain(
      "const hasPendingSupplyModal = settings.supplyReminderEnabled",
    );
    expect(mapSource).toContain("calorieAlert");
    expect(mapSource).toContain("waterAlert");
    expect(mapSource).toContain("activeSupplyAlerts.length > 0");
    expect(mapSource).toContain(
      "Object.values(intervalSupplyAlerts).some(Boolean)",
    );
    expect(mapSource).toContain("manager.holdBrightness(holdKey)");
    expect(mapSource).toContain("manager.releaseBrightnessHold(holdKey)");
  });
});
