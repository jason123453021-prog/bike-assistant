import { describe, expect, it } from "vitest";
import { getDueSupplyIntervals } from "../lib/supply-interval";

const tracker = { lastTimeSec: 0, lastDistanceKm: 0 };

describe("getDueSupplyIntervals", () => {
  it("可在使用者選擇的時間或距離到達時各自觸發", () => {
    const config = { enabled: true, timeEnabled: true, timeMinutes: 30, distanceEnabled: true, distanceKm: 12 };
    expect(getDueSupplyIntervals(config, tracker, 1800, 12.1, {})).toEqual(["time", "distance"]);
  });

  it("不會重複觸發仍在等待確認的同一間隔提醒", () => {
    const config = { enabled: true, timeEnabled: true, timeMinutes: 30, distanceEnabled: false, distanceKm: 0 };
    expect(getDueSupplyIntervals(config, tracker, 2000, 0, { time: true })).toEqual([]);
  });

  it("總開關關閉時不觸發任何提醒", () => {
    const config = { enabled: false, timeEnabled: true, timeMinutes: 1, distanceEnabled: true, distanceKm: 1 };
    expect(getDueSupplyIntervals(config, tracker, 600, 10, {})).toEqual([]);
  });
});
