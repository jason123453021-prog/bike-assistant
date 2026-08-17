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
  it("在開始後以個別能量與補水倒數安排下一次提醒", () => {
    const countdown = createSmartSupplyCountdown(plan, 120);
    expect(smartSupplyCountdownRemainingSec(countdown, "calorie", 120)).toBe(plan.energyCountdownSec);
    expect(smartSupplyCountdownRemainingSec(countdown, "water", 120)).toBe(plan.waterCountdownSec);
    expect(isSmartSupplyCountdownDue(countdown, "water", countdown.waterDueElapsedSec)).toBe(true);
    expect(plan.waterCountdownSec).toBeGreaterThanOrEqual(10 * 60);
    expect(plan.waterCountdownSec).toBeLessThanOrEqual(15 * 60);
    expect(plan.energyCountdownSec).toBeGreaterThanOrEqual(20 * 60);
    expect(plan.energyCountdownSec).toBeLessThanOrEqual(75 * 60);
  });

  it("未確認前保持原到期時間，只有確認後才重設對應類別的倒數起點", () => {
    const countdown = createSmartSupplyCountdown(plan, 0);
    expect(smartSupplyCountdownRemainingSec(countdown, "water", 120)).toBe(plan.waterCountdownSec - 120);
    expect(isSmartSupplyCountdownDue(countdown, "water", countdown.waterDueElapsedSec)).toBe(true);

    const restarted = restartSmartSupplyCountdown(countdown, "water", { ...plan, waterCountdownSec: 10 * 60 }, 900);
    expect(restarted.waterStartedElapsedSec).toBe(900);
    expect(restarted.waterDueElapsedSec).toBe(900 + 10 * 60);
    expect(restarted.calorieStartedElapsedSec).toBe(0);
  });
});
