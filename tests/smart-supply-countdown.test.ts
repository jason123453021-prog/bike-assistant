import { describe, expect, it } from "vitest";
import { createSupplyPlan } from "../lib/smart-supply-plan";
import {
  createSmartSupplyCountdown,
  isSmartSupplyCountdownDue,
  restartSmartSupplyCountdown,
  smartSupplyCountdownRemainingSec,
} from "../lib/smart-supply-countdown";

const plan = createSupplyPlan({
  mode: "smart",
  elapsedSec: 60 * 60,
  riderWeightKg: 70,
  ftpW: 250,
  intensityFactor: 0.8,
  sweatRatePerHour: 800,
  environmentLoad: 0.35,
  weatherAvailable: true,
});

describe("smart supply countdown", () => {
  it("在開始後以個別且鎖定的真實時間倒數安排下一次提醒", () => {
    const startedAtMs = 1_000_000;
    const countdown = createSmartSupplyCountdown(plan, 120, startedAtMs);
    expect(smartSupplyCountdownRemainingSec(countdown, "calorie", startedAtMs)).toBe(plan.energyCountdownSec);
    expect(smartSupplyCountdownRemainingSec(countdown, "water", startedAtMs)).toBe(plan.waterCountdownSec);
    expect(isSmartSupplyCountdownDue(countdown, "water", countdown.waterDueAtMs)).toBe(true);
    expect(plan.waterCountdownSec).toBeGreaterThanOrEqual(10 * 60);
    expect(plan.waterCountdownSec).toBeLessThanOrEqual(30 * 60);
    expect(plan.energyCountdownSec).toBeGreaterThanOrEqual(20 * 60);
    expect(plan.energyCountdownSec).toBeLessThanOrEqual(75 * 60);
  });

  it("暫停騎乘碼表仍依真實時間遞減，且未確認前保持原到期時間", () => {
    const startedAtMs = 1_000_000;
    const countdown = createSmartSupplyCountdown(plan, 0, startedAtMs);
    expect(smartSupplyCountdownRemainingSec(countdown, "water", startedAtMs + 120_000)).toBe(plan.waterCountdownSec - 120);
    expect(isSmartSupplyCountdownDue(countdown, "water", countdown.waterDueAtMs)).toBe(true);

    const restarted = restartSmartSupplyCountdown(countdown, "water", { ...plan, waterCountdownSec: 10 * 60 }, 900, startedAtMs + 900_000);
    expect(restarted.waterStartedElapsedSec).toBe(900);
    expect(restarted.waterDueElapsedSec).toBe(900 + 10 * 60);
    expect(restarted.waterStartedAtMs).toBe(startedAtMs + 900_000);
    expect(restarted.waterDueAtMs).toBe(startedAtMs + 1_500_000);
    expect(restarted.calorieStartedElapsedSec).toBe(0);
  });

  it("牆鐘時間跨過 GPS 中斷後歸零，且確認補水不改寫能量本輪到期點", () => {
    const startedAtMs = 2_000_000;
    const countdown = createSmartSupplyCountdown(plan, 30, startedAtMs);
    const calorieDueAtMs = countdown.calorieDueAtMs;
    const afterIndoorPauseMs = startedAtMs + 45_000;
    expect(smartSupplyCountdownRemainingSec(countdown, "calorie", afterIndoorPauseMs))
      .toBe(plan.energyCountdownSec - 45);
    expect(smartSupplyCountdownRemainingSec(countdown, "water", countdown.waterDueAtMs + 1)).toBe(0);
    expect(isSmartSupplyCountdownDue(countdown, "water", countdown.waterDueAtMs + 1)).toBe(true);

    const restartedWater = restartSmartSupplyCountdown(countdown, "water", { ...plan, waterCountdownSec: 12 * 60 }, 30, afterIndoorPauseMs);
    expect(restartedWater.calorieDueAtMs).toBe(calorieDueAtMs);
    expect(restartedWater.waterDueAtMs).toBe(afterIndoorPauseMs + 12 * 60 * 1_000);
  });
});
