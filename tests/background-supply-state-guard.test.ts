import { describe, expect, it } from "vitest";
import {
  getSupplyReminderMutationVersion,
  preserveLatestSupplyReminderMutation,
  type BackgroundSupplyStateGuard,
} from "../lib/background-supply-state-guard";

function createSupplyState(overrides: Partial<BackgroundSupplyStateGuard> = {}): BackgroundSupplyStateGuard {
  return {
    supplyReminderMutationVersion: 4,
    calorieReminderSent: true,
    waterReminderSent: false,
    smartCalorieCountdownStartedElapsedSec: 50,
    smartWaterCountdownStartedElapsedSec: 20,
    smartCalorieCountdownDurationSec: 1_800,
    smartWaterCountdownDurationSec: 900,
    calories: 250,
    sweatLossMl: 400,
    intervalLastEnergyTimeSec: 0,
    intervalLastEnergyDistanceKm: 0,
    intervalLastWaterTimeSec: 0,
    intervalLastWaterDistanceKm: 0,
    intervalEnergyTimeReminderSent: false,
    intervalEnergyDistanceReminderSent: false,
    intervalWaterTimeReminderSent: false,
    intervalWaterDistanceReminderSent: false,
    ...overrides,
  };
}

describe("背景補給狀態競爭保護", () => {
  it("前景已確認補給時，舊背景批次不得以待確認旗標重新覆寫它", () => {
    const backgroundBatch = createSupplyState({ calorieReminderSent: true, smartCalorieCountdownStartedElapsedSec: 50 });
    const latestConfirmation = createSupplyState({
      supplyReminderMutationVersion: 5,
      calorieReminderSent: false,
      smartCalorieCountdownStartedElapsedSec: 180,
      calories: 0,
    });

    const merged = preserveLatestSupplyReminderMutation(backgroundBatch, latestConfirmation, 4);

    expect(merged.calorieReminderSent).toBe(false);
    expect(merged.smartCalorieCountdownStartedElapsedSec).toBe(180);
    expect(merged.calories).toBe(0);
    expect(merged.supplyReminderMutationVersion).toBe(5);
  });

  it("若沒有較新的前景確認，背景批次保留它自己的更新", () => {
    const backgroundBatch = createSupplyState({ calories: 320 });
    const latestState = createSupplyState({ calories: 250 });

    expect(preserveLatestSupplyReminderMutation(backgroundBatch, latestState, 4)).toBe(backgroundBatch);
  });

  it("將遺留或損壞的版本值安全視為零", () => {
    expect(getSupplyReminderMutationVersion({ supplyReminderMutationVersion: undefined })).toBe(0);
    expect(getSupplyReminderMutationVersion({ supplyReminderMutationVersion: Number.NaN })).toBe(0);
  });
});
