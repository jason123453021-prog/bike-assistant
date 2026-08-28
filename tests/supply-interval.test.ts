import { describe, expect, it } from "vitest";
import { getDueSupplyIntervals, type SupplyIntervalTracker } from "../lib/supply-interval";

const tracker: SupplyIntervalTracker = {
  "energy-time": 0,
  "energy-distance": 0,
  "water-time": 0,
  "water-distance": 0,
};

describe("getDueSupplyIntervals", () => {
  it("能量與補水可使用不同的時間或距離規則，並在各自到期時觸發", () => {
    const config = {
      energy: { timeEnabled: true, timeMinutes: 30, distanceEnabled: true, distanceKm: 12 },
      water: { timeEnabled: true, timeMinutes: 15, distanceEnabled: true, distanceKm: 8 },
    };
    expect(getDueSupplyIntervals(config, tracker, 1800, 12.1, {})).toEqual([
      "energy-time",
      "energy-distance",
      "water-time",
      "water-distance",
    ]);
  });

  it("不會重複觸發仍在等待確認的同一規則，但不阻擋另一種補給", () => {
    const config = {
      energy: { timeEnabled: true, timeMinutes: 30, distanceEnabled: false, distanceKm: 0 },
      water: { timeEnabled: true, timeMinutes: 20, distanceEnabled: false, distanceKm: 0 },
    };
    expect(getDueSupplyIntervals(config, tracker, 2000, 0, { "energy-time": true })).toEqual(["water-time"]);
  });

  it("兩組規則皆關閉時不觸發任何提醒", () => {
    const config = {
      energy: { timeEnabled: false, timeMinutes: 1, distanceEnabled: false, distanceKm: 1 },
      water: { timeEnabled: false, timeMinutes: 1, distanceEnabled: false, distanceKm: 1 },
    };
    expect(getDueSupplyIntervals(config, tracker, 600, 10, {})).toEqual([]);
  });
});
