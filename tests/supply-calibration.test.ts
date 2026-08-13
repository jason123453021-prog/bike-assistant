import { describe, expect, it } from "vitest";
import { calibrateSweatRate, resetSweatCalibration } from "../lib/supply-calibration";

describe("calibrateSweatRate", () => {
  it("依使用者明確確認的補水量保守調整汗率倍率", () => {
    const result = calibrateSweatRate({
      estimatedSweatMl: 800,
      confirmedFluidMl: 1000,
      currentMultiplier: 1,
      completedCalibrations: 2,
    });
    expect(result.applied).toBe(true);
    expect(result.nextMultiplier).toBeGreaterThan(1);
    expect(result.nextMultiplier).toBeLessThanOrEqual(1.25);
    expect(result.nextCount).toBe(3);
  });

  it("對過短或補水量不足的騎乘不改動模型", () => {
    expect(calibrateSweatRate({
      estimatedSweatMl: 200,
      confirmedFluidMl: 100,
      currentMultiplier: 1.1,
      completedCalibrations: 4,
    })).toMatchObject({ applied: false, nextMultiplier: 1.1, nextCount: 4 });
  });

  it("可將本機校正恢復為中性基準", () => {
    expect(resetSweatCalibration()).toEqual({ nextMultiplier: 1, nextCount: 0 });
  });
});
