import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldRestoreBackgroundSupplyReminder } from "../lib/background-supply-recovery";

describe("background supply reminder recovery", () => {
  it("restores a newly persisted background reminder when no foreground modal is pending", () => {
    expect(shouldRestoreBackgroundSupplyReminder({
      persistedPending: true,
      countdownDue: false,
      pendingInForeground: false,
    })).toBe(true);
  });

  it("restores a smart countdown that elapsed while the app was in the background", () => {
    expect(shouldRestoreBackgroundSupplyReminder({
      persistedPending: false,
      countdownDue: true,
      pendingInForeground: false,
    })).toBe(true);
  });

  it("does not reopen a reminder already pending or confirmed in the foreground", () => {
    expect(shouldRestoreBackgroundSupplyReminder({
      persistedPending: true,
      countdownDue: true,
      pendingInForeground: true,
    })).toBe(false);
  });

  it("routes modal and notification confirmation through bulk supply notification cleanup", () => {
    const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
    expect(mapSource.match(/void clearAllSupplyNotifications\(\);/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
