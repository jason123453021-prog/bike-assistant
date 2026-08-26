import { describe, expect, it } from "vitest";
import {
  applyPausedRecoveryToNextSupplyPlan,
  calculatePausedRecoveryExtensionSec,
  type SupplyPlan,
} from "../lib/smart-supply-plan";

const basePlan: SupplyPlan = {
  calorieTriggerKcal: 220,
  waterTriggerMl: 180,
  energyCountdownSec: 30 * 60,
  waterCountdownSec: 15 * 60,
  energyRecommendationKcal: 160,
  carbohydrateRecommendationG: 40,
  carbohydrateHourlyLimitG: 60,
  carbohydrateHourlyLimitMode: "science",
  waterRecommendationMl: 180,
  source: "smart",
  reason: "測試計畫",
};

describe("智慧補給暫停恢復權重", () => {
  it("將 20 秒紅燈只轉成能量提醒的近乎可忽略 8 秒延長", () => {
    expect(calculatePausedRecoveryExtensionSec(20)).toBe(8);
    const nextPlan = applyPausedRecoveryToNextSupplyPlan(basePlan, 20);
    expect(nextPlan.energyCountdownSec).toBe(basePlan.energyCountdownSec + 8);
    expect(nextPlan.waterCountdownSec).toBe(basePlan.waterCountdownSec);
    expect(basePlan.energyCountdownSec).toBe(30 * 60);
  });

  it("將 10 分鐘便利商店休息只轉成能量提醒的 4 分鐘延長", () => {
    expect(calculatePausedRecoveryExtensionSec(10 * 60)).toBe(4 * 60);
    const nextPlan = applyPausedRecoveryToNextSupplyPlan(basePlan, 10 * 60);
    expect(nextPlan.energyCountdownSec).toBe(34 * 60);
    expect(nextPlan.waterCountdownSec).toBe(15 * 60);
  });

  it("對異常長休息設上限，並維持補水 10–30 分鐘安全區間", () => {
    const nearUpperBound: SupplyPlan = {
      ...basePlan,
      waterCountdownSec: 30 * 60,
      energyCountdownSec: 75 * 60,
    };
    const nextPlan = applyPausedRecoveryToNextSupplyPlan(
      nearUpperBound,
      60 * 60,
    );
    expect(calculatePausedRecoveryExtensionSec(60 * 60)).toBe(5 * 60);
    expect(nextPlan.waterCountdownSec).toBe(30 * 60);
    expect(nextPlan.energyCountdownSec).toBe(75 * 60);
  });
});
