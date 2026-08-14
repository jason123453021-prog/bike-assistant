import { describe, expect, it } from "vitest";
import { deriveAutomaticSweatCalibration, type AutomaticSweatCalibrationRide } from "../lib/supply-calibration";

const automaticRide = (id: string, date: number, totalSweatMl = 1_300): AutomaticSweatCalibrationRide => ({
  id,
  date,
  duration: 75 * 60,
  movingTime: 72 * 60,
  totalSweatMl,
  avgPower: 220,
  avgSpeed: 26,
  totalAscent: 420,
  averageGrade: 4.5,
  calculationProfile: {
    riderWeightKg: 70,
    ftpW: 240,
    environment: {
      averageTemperatureC: 29,
      averageHumidityPct: 72,
      averageHeadwindMs: 2,
    },
  },
  supplyConfirmations: [{ type: "water", source: "smart", recommendedWaterMl: 200 }],
});

describe("deriveAutomaticSweatCalibration", () => {
  it("依多次本機有效騎乘與已確認智慧補水保守調整汗率倍率", () => {
    const result = deriveAutomaticSweatCalibration({
      rides: [automaticRide("ride-3", 3), automaticRide("ride-2", 2), automaticRide("ride-1", 1)],
      currentMultiplier: 1,
      completedCalibrations: 2,
    });
    expect(result.applied).toBe(true);
    expect(result.nextMultiplier).toBeGreaterThan(1);
    expect(result.nextMultiplier).toBeLessThanOrEqual(1.25);
    expect(result.nextCount).toBe(3);
  });

  it("對資料不足或同一筆活動重複處理時不改動模型", () => {
    expect(deriveAutomaticSweatCalibration({
      rides: [automaticRide("ride-2", 2), automaticRide("ride-1", 1)],
      currentMultiplier: 1.1,
      completedCalibrations: 4,
    })).toMatchObject({ applied: false, nextMultiplier: 1.1, nextCount: 4 });

    expect(deriveAutomaticSweatCalibration({
      rides: [automaticRide("ride-3", 3), automaticRide("ride-2", 2), automaticRide("ride-1", 1)],
      currentMultiplier: 1.1,
      completedCalibrations: 4,
      lastProcessedRideId: "ride-3",
    })).toMatchObject({ applied: false, nextMultiplier: 1.1, nextCount: 4 });
  });
});
