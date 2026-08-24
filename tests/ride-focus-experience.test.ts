import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const mapSource = source("app/(tabs)/map.tsx");
const settingsSource = source("app/(tabs)/settings.tsx");
const settingsContextSource = source("lib/settings-context.tsx");
const feedbackSource = source("lib/feedback-service.ts");
const backgroundSource = source("lib/background-location.ts");
const routeSnapshotSource = source("lib/route-estimate-snapshot.ts");
const powerSavingSource = source("lib/power-saving/smart-power-saving-system.ts");

describe("rider-focus experience guards", () => {
  it("suppresses frequent foreground riding banners and sounds", () => {
    expect(feedbackSource).toContain("shouldShowAlert: false");
    expect(feedbackSource).toContain("shouldPlaySound: false");
    expect(feedbackSource).toContain("避免頂端橫幅與提示音干擾騎乘專注");
    expect(mapSource).not.toContain("showRidingNotification(speedKmh");
  });

  it("uses configurable automatic relock after guard unlock", () => {
    expect(settingsContextSource).toContain("touchGuardAutoRelockSec: number");
    expect(settingsContextSource).toContain("touchGuardAutoRelockSec: 3");
    expect(settingsSource).toContain("解鎖後自動重新鎖定");
    expect(mapSource).toContain("settings.touchGuardAutoRelockSec * 1000");
  });

  it("keeps supply countdowns in real time while stationary and buffers pause recovery only for the next round", () => {
    expect(backgroundSource).toContain("smartCalorieCountdownPausedTotalMs");
    expect(backgroundSource).toContain("isReliablyMovingForSupply");
    expect(backgroundSource).toContain("supplyNowMs >= (state.smartCalorieCountdownDueAtMs");
    expect(backgroundSource).toContain("calculatePausedRecoveryExtensionSec");
    expect(mapSource).toContain("currentCountdown ?? createSmartSupplyCountdown");
    expect(mapSource).toContain("setInterval(() => setSmartSupplyCountdownNowMs(Date.now()), 1_000)");
    expect(mapSource).toContain("applyPausedRecoveryToNextSupplyPlan");
    expect(mapSource).not.toContain("refreshSmartSupplyCountdown");
  });

  it("uses a shared carbohydrate serving setting for live and route supply plans", () => {
    expect(settingsSource).toContain("單包能量補給碳水");
    expect(settingsContextSource).toContain("energyServingCarbohydrateG: number");
    expect(mapSource).toContain("energyServingCarbohydrateG: settings.energyServingCarbohydrateG");
    expect(routeSnapshotSource).toContain("energyServingCarbohydrateG: input.energyServingCarbohydrateG");
  });

  it("keeps user-controlled map orientation, delayed recentering, and screen brightness wake-up guarded", () => {
    expect(mapSource).toContain("settings.autoRecenterSec * 1000");
    expect(mapSource).toContain("movementSinceCamera >= 8");
    expect(mapSource).toContain("onMapRotateEnd={() => scheduleAutoRecenter()}");
    expect(powerSavingSource).toContain("brightnessSession");
    expect(powerSavingSource).toContain("session !== this.brightnessSession");
  });
});
