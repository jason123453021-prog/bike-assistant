import { describe, expect, it } from "vitest";
import { createSupplyPlan } from "../lib/smart-supply-plan";
import {
  createSmartSupplyCountdown,
  isSmartSupplyCountdownDue,
  refreshSmartSupplyCountdown,
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
  });

  it("未確認前只更新到期時間，確認後才重設對應類別的倒數起點", () => {
    const countdown = createSmartSupplyCountdown(plan, 0);
    const refreshed = refreshSmartSupplyCountdown(countdown, { ...plan, waterCountdownSec: 10 * 60 });
    expect(refreshed.waterStartedElapsedSec).toBe(0);
    expect(refreshed.waterDueElapsedSec).toBe(10 * 60);

    const restarted = restartSmartSupplyCountdown(refreshed, "water", plan, 900);
    expect(restarted.waterStartedElapsedSec).toBe(900);
    expect(restarted.waterDueElapsedSec).toBe(900 + plan.waterCountdownSec);
    expect(restarted.calorieStartedElapsedSec).toBe(0);
  });
});
