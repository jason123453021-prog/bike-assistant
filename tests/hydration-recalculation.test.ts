import { describe, expect, it } from "vitest";

import {
  awaitHydrationInputs,
  resolveWaterCountdownFallbackDuration,
} from "../lib/hydration-recalculation";

const weather = {
  temperature: 26,
  humidity: 88,
  windSpeed: 4,
  windDirection: 90,
  precipitationProb: 0,
  weatherCode: 3,
  description: "陰天",
  forecast: [],
};

describe("補水下一輪資料等待與離線降級", () => {
  it("以 Promise.all 等候天氣與感測快照皆可用後才回傳完整資料", async () => {
    const result = await awaitHydrationInputs({
      weatherPromise: Promise.resolve(weather),
      sensorPromise: Promise.resolve({ elapsedSec: 7_200, powerW: 220, speedKmh: 28, sweatRatePerHour: 900, headingDeg: 90 }),
      timeoutMs: 100,
    });

    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      expect(result.weather.humidity).toBe(88);
      expect(result.sensors.powerW).toBe(220);
    }
  });

  it("逾時或資料不足時不阻塞，延用前輪；首輪沒有前值時採 10 分鐘", async () => {
    const result = await awaitHydrationInputs({
      weatherPromise: new Promise(() => {}),
      sensorPromise: Promise.resolve({ elapsedSec: 0, powerW: 0, speedKmh: 0, sweatRatePerHour: 550 }),
      timeoutMs: 1,
    });

    expect(result.status).toBe("timeout");
    expect(resolveWaterCountdownFallbackDuration(18 * 60)).toBe(18 * 60);
    expect(resolveWaterCountdownFallbackDuration(undefined)).toBe(10 * 60);
  });
});
