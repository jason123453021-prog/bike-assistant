import { describe, expect, it } from "vitest";
import {
  DEFAULT_NAVIGATION_FIELD_ORDER,
  DEFAULT_NAVIGATION_PRIMARY_FIELDS,
  migrateLegacyNavigationDashboardDefaults,
} from "../lib/navigation-dashboard-defaults";
import {
  DEFAULT_TOUCH_GUARD_UNLOCK_HOLD_MS,
  hasReliableRideMovement,
  shouldScheduleTouchGuardRelock,
  shouldZeroLiveRideReadings,
  TOUCH_GUARD_AUTO_RELOCK_MS,
  TOUCH_GUARD_UNLOCK_HOLD_PRESETS,
} from "../lib/live-ride-readings";
import { migrateTouchGuardUnlockHoldMs } from "../lib/settings-context";

describe("live ride navigation experience", () => {
  it("defaults the sixth dashboard slot to total ascent instead of average speed", () => {
    expect(DEFAULT_NAVIGATION_PRIMARY_FIELDS).toEqual([
      "showElapsed",
      "showSpeed",
      "showDistance",
      "showGrade",
      "showPower",
      "showTotalAscent",
    ]);
    expect(DEFAULT_NAVIGATION_FIELD_ORDER.indexOf("showTotalAscent")).toBe(5);
    expect(DEFAULT_NAVIGATION_FIELD_ORDER.indexOf("showAvgSpeed")).toBeGreaterThan(5);
  });

  it("migrates only the former average-speed dashboard default", () => {
    const legacy = migrateLegacyNavigationDashboardDefaults(
      { showAvgSpeed: true, showTotalAscent: false },
      [
        "showElapsed",
        "showSpeed",
        "showDistance",
        "showGrade",
        "showPower",
        "showAvgSpeed",
        "showCalories",
        "showPausedTime",
        "showTotalAscent",
      ],
    );

    expect(legacy.fields.showAvgSpeed).toBe(false);
    expect(legacy.fields.showTotalAscent).toBe(true);
    expect(legacy.order.slice(0, 6)).toEqual(DEFAULT_NAVIGATION_PRIMARY_FIELDS);

    const custom = migrateLegacyNavigationDashboardDefaults(
      { showAvgSpeed: true, showTotalAscent: false },
      ["showSpeed", "showElapsed", "showDistance", "showAvgSpeed"],
    );
    expect(custom.fields.showAvgSpeed).toBe(true);
    expect(custom.fields.showTotalAscent).toBe(false);
  });

  it("zeros live readings for stopped traffic and indoor GPS drift without treating genuine movement as stopped", () => {
    const stationaryRedLight = shouldZeroLiveRideReadings({
      rawSpeedKmh: 1.2,
      displacementM: 4,
      accuracyM: 6,
      motionStill: true,
      pauseThresholdKmh: 3,
      driftThresholdM: 5,
    });
    const stationaryIndoors = shouldZeroLiveRideReadings({
      rawSpeedKmh: 1.2,
      displacementM: 8,
      accuracyM: 18,
      motionStill: true,
      pauseThresholdKmh: 3,
      driftThresholdM: 3,
    });
    const genuineMovement = shouldZeroLiveRideReadings({
      rawSpeedKmh: 18,
      displacementM: 15,
      accuracyM: 5,
      motionStill: false,
      pauseThresholdKmh: 3,
      driftThresholdM: 3,
    });

    expect(stationaryRedLight).toBe(true);
    expect(stationaryIndoors).toBe(true);
    expect(genuineMovement).toBe(false);
  });

  it("keeps counting a real ride when a handlebar-mounted phone briefly reports zero speed", () => {
    expect(hasReliableRideMovement({ speedKmh: 0, distanceM: 16, accuracyM: 5 })).toBe(true);
    expect(shouldZeroLiveRideReadings({
      rawSpeedKmh: 0,
      displacementM: 16,
      accuracyM: 5,
      motionStill: true,
      pauseThresholdKmh: 1.5,
      driftThresholdM: 8,
    })).toBe(false);
    expect(hasReliableRideMovement({ speedKmh: 1, distanceM: 4, accuracyM: 18 })).toBe(false);
  });

  it("uses a 400 ms hold and schedules a 3 second safety relock only during an active guarded ride", () => {
    expect(DEFAULT_TOUCH_GUARD_UNLOCK_HOLD_MS).toBe(400);
    expect(TOUCH_GUARD_AUTO_RELOCK_MS).toBe(3_000);
    expect(shouldScheduleTouchGuardRelock(true, true)).toBe(true);
    expect(shouldScheduleTouchGuardRelock(false, true)).toBe(false);
    expect(shouldScheduleTouchGuardRelock(true, false)).toBe(false);
  });

  it("migrates legacy values and limits current settings to the three available quick choices", () => {
    expect(TOUCH_GUARD_UNLOCK_HOLD_PRESETS).toEqual([400, 800, 1200]);
    expect(migrateTouchGuardUnlockHoldMs(1200)).toBe(400);
    expect(migrateTouchGuardUnlockHoldMs("1200")).toBe(400);
    expect(migrateTouchGuardUnlockHoldMs(undefined)).toBe(400);
    expect(migrateTouchGuardUnlockHoldMs(800)).toBe(800);
    expect(migrateTouchGuardUnlockHoldMs(1200, 2)).toBe(1200);
    expect(migrateTouchGuardUnlockHoldMs("1200", "2")).toBe(1200);
    expect(migrateTouchGuardUnlockHoldMs(100, 2)).toBe(400);
    expect(migrateTouchGuardUnlockHoldMs(1000, 2)).toBe(800);
    expect(migrateTouchGuardUnlockHoldMs(9000, 2)).toBe(1200);
  });
});
