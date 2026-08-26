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

describe("智慧補給暫停相容規則", () => {
  it("不再將 20 秒紅燈加入下一輪能量倒數", () => {
    expect(calculatePausedRecoveryExtensionSec(20)).toBe(0);
    const nextPlan = applyPausedRecoveryToNextSupplyPlan(basePlan, 20);
    expect(nextPlan.energyCountdownSec).toBe(basePlan.energyCountdownSec);
    expect(nextPlan.waterCountdownSec).toBe(basePlan.waterCountdownSec);
    expect(basePlan.energyCountdownSec).toBe(30 * 60);
  });

  it("不再將長暫停加入下一輪能量倒數", () => {
    expect(calculatePausedRecoveryExtensionSec(10 * 60)).toBe(0);
    const nextPlan = applyPausedRecoveryToNextSupplyPlan(basePlan, 10 * 60);
    expect(nextPlan.energyCountdownSec).toBe(basePlan.energyCountdownSec);
    expect(nextPlan.waterCountdownSec).toBe(15 * 60);
  });

  it("相容呼叫不會改變既有計畫的能量或補水倒數", () => {
    const nearUpperBound: SupplyPlan = {
      ...basePlan,
      waterCountdownSec: 30 * 60,
      energyCountdownSec: 75 * 60,
    };
    const nextPlan = applyPausedRecoveryToNextSupplyPlan(
      nearUpperBound,
      60 * 60,
    );
    expect(calculatePausedRecoveryExtensionSec(60 * 60)).toBe(0);
    expect(nextPlan.waterCountdownSec).toBe(30 * 60);
    expect(nextPlan.energyCountdownSec).toBe(75 * 60);
  });
});
