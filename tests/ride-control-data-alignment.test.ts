import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  acceptLiveElevationDelta,
  createLiveElevationFilterState,
  LIVE_ELEVATION_DEADBAND_M,
  LIVE_ELEVATION_SMOOTHING_WINDOW,
} from "../lib/live-elevation-filter";
import { createSupplyPlan } from "../lib/smart-supply-plan";

const projectRoot = resolve(__dirname, "..");
const mapSource = readFileSync(
  resolve(projectRoot, "app/(tabs)/map.tsx"),
  "utf8",
);
const rideContextSource = readFileSync(
  resolve(projectRoot, "lib/ride-context.tsx"),
  "utf8",
);
const powerSavingSource = readFileSync(
  resolve(projectRoot, "lib/power-saving/smart-power-saving-system.ts"),
  "utf8",
);
const immersiveSource = readFileSync(
  resolve(projectRoot, "lib/ride-immersive-mode.ts"),
  "utf8",
);

const supplyInput = {
  mode: "smart" as const,
  calorieThresholdKcal: 300,
  waterThresholdMl: 500,
  elapsedSec: 45 * 60,
  riderWeightKg: 70,
  ftpW: 240,
  intensityFactor: 0.55,
  sweatRatePerHour: 450,
  environmentLoad: 0.1,
  weatherAvailable: true,
  temperatureC: 27,
  humidityPct: 88,
  weatherCode: 0,
};

describe("騎乘控制與資料對齊", () => {
  it("補水倒數維持純溫濕度映射，排除騎乘強度、汗率、時長與舊環境負荷", () => {
    const easy = createSupplyPlan(supplyInput);
    const hard = createSupplyPlan({
      ...supplyInput,
      elapsedSec: 5 * 60 * 60,
      intensityFactor: 1.2,
      sweatRatePerHour: 1_800,
      environmentLoad: 1,
      weatherCode: 95,
    });

    expect(easy.waterCountdownSec).toBe(hard.waterCountdownSec);
    expect(easy.waterCountdownSec).toBeLessThanOrEqual(15 * 60);
    expect(easy.waterCountdownSec).toBeGreaterThanOrEqual(10 * 60);
  });

  it("以較短平滑窗與 10 m GPS 海拔門檻濾除垂直雜訊", () => {
    expect(LIVE_ELEVATION_SMOOTHING_WINDOW).toBe(7);
    expect(LIVE_ELEVATION_DEADBAND_M).toBe(10);

    const state = createLiveElevationFilterState();
    acceptLiveElevationDelta(state, 100, 0);
    for (const noisyAltitude of [101, 99, 102, 98, 101, 100, 102]) {
      expect(acceptLiveElevationDelta(state, noisyAltitude, 12).ascentM).toBe(
        0,
      );
    }
  });

  it("在騎乘前景啟用可滑出的沉浸式系統列，並在離開時恢復系統列", () => {
    expect(immersiveSource).toContain("setBehaviorAsync");
    expect(immersiveSource).toContain('"overlay-swipe"');
    expect(immersiveSource).toContain("setVisibilityAsync");
    expect(immersiveSource).toContain('"hidden"');
    expect(mapSource).toContain("setRideImmersiveMode(shouldUseImmersiveMode)");
  });

  it("省電喚醒撤銷 Android activity 亮度覆寫，交還系統與自動亮度控制", () => {
    expect(powerSavingSource).toContain("useSystemBrightnessAsync");
    expect(powerSavingSource).toContain("await useSystemBrightnessAsync()");
    expect(powerSavingSource).toContain("await getSystemBrightnessAsync()");
  });

  it("觸控鎖以指標、取消事件與安全逾時清除幽靈長按，且騎乘開始依設定安排上鎖", () => {
    expect(mapSource).toContain("touchGuardPointerActiveRef");
    expect(mapSource).toContain("touchGuardHoldSafetyTimerRef");
    expect(mapSource).toContain("onTouchCancel={resetTouchGuardHoldProgress}");
    expect(mapSource).toContain("settings.touchGuardAutoRelockSec * 1000");
  });

  it("釘選導航開始時立即沿用定位模式回到最新 GPS，儲存活動保留即時已接受爬升", () => {
    expect(mapSource).toContain(
      "requestAnimationFrame(() => recenterForLocationMode())",
    );
    expect(rideContextSource).toContain("route: state.route");
    expect(rideContextSource).toContain(
      "totalAscent: activityStats.totalAscentM",
    );
    expect(rideContextSource).toContain(
      "totalDescent: activityStats.totalDescentM",
    );
  });
});
