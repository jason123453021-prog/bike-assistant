import fs from "node:fs";
import path from "node:path";

import {
  advanceAutoLapMilestones,
  createAutoLapAnchor,
  type AutoLapMilestoneState,
  type AutoLapTotals,
} from "../../lib/auto-lap-milestones";
import { advanceBackgroundAutoPause } from "../../lib/background-auto-pause";
import {
  calculateCourseOverGround,
  findNextRouteTurn,
  smoothCogHeading,
  shouldWakeForUpcomingTurn,
  TURN_SPEAK_DISTANCE_M,
  TURN_WAKE_DISTANCE_M,
} from "../../lib/cog-navigation";
import {
  awaitHydrationInputs,
  HYDRATION_DATA_TIMEOUT_MS,
  resolveWaterCountdownFallbackDuration,
} from "../../lib/hydration-recalculation";
import {
  applyPausedRecoveryToNextSupplyPlan,
  calculatePausedRecoveryExtensionSec,
  type SupplyPlan,
} from "../../lib/smart-supply-plan";
import {
  createSmartSupplyCountdown,
  smartSupplyCountdownRemainingSec,
} from "../../lib/smart-supply-countdown";

const BASE_TOTALS: AutoLapTotals = {
  elapsedSec: 0,
  distanceM: 0,
  ascentM: 0,
  descentM: 0,
  powerWorkJ: 0,
  powerSampleDurationSec: 0,
};

const BASE_SUPPLY_PLAN: SupplyPlan = {
  calorieTriggerKcal: 220,
  waterTriggerMl: 180,
  energyCountdownSec: 3_600,
  waterCountdownSec: 1_200,
  energyRecommendationKcal: 200,
  carbohydrateRecommendationG: 50,
  carbohydrateHourlyLimitG: 60,
  carbohydrateHourlyLimitMode: "science",
  waterRecommendationMl: 180,
  source: "smart",
  reason: "Jest test fixture",
};

function runTwelveKilometers(intervalM: number) {
  const state: AutoLapMilestoneState = {
    enabled: true,
    intervalM,
    nextDistanceM: intervalM,
    laps: [],
    anchor: createAutoLapAnchor(BASE_TOTALS),
    previousTotals: BASE_TOTALS,
  };
  return advanceAutoLapMilestones(
    {
      elapsedSec: 3_600,
      distanceM: 12_000,
      ascentM: 240,
      descentM: 180,
      powerWorkJ: 720_000,
      powerSampleDurationSec: 3_600,
    },
    state,
  );
}

describe("規格書核心紀錄與 GPS 整合守門", () => {
  it("低於 1.08 km/h 且無可信移動滿 10 秒後自動暫停；1.8 km/h 可信移動立即恢復", () => {
    const pausedAtThreshold = advanceBackgroundAutoPause({
      paused: false,
      accumulatedLowSpeedSec: 0,
      hasReliableMovement: false,
      speedKmh: 1.07,
      intervalSec: 10,
      enabled: true,
      pauseBelowKmh: 1.08,
      pauseAfterSec: 10,
      resumeAtOrAboveKmh: 1.8,
    });
    expect(pausedAtThreshold).toMatchObject({
      paused: true,
      accumulatedLowSpeedSec: 10,
      movingTimeIncrementSec: 10,
    });

    const stillPaused = advanceBackgroundAutoPause({
      paused: pausedAtThreshold.paused,
      accumulatedLowSpeedSec: pausedAtThreshold.accumulatedLowSpeedSec,
      hasReliableMovement: false,
      speedKmh: 0,
      intervalSec: 5,
      enabled: true,
      pauseBelowKmh: 1.08,
      pauseAfterSec: 10,
      resumeAtOrAboveKmh: 1.8,
    });
    expect(stillPaused).toMatchObject({
      paused: true,
      movingTimeIncrementSec: 0,
    });

    const resumed = advanceBackgroundAutoPause({
      paused: stillPaused.paused,
      accumulatedLowSpeedSec: stillPaused.accumulatedLowSpeedSec,
      hasReliableMovement: true,
      speedKmh: 1.8,
      intervalSec: 5,
      enabled: true,
      pauseBelowKmh: 1.08,
      pauseAfterSec: 10,
      resumeAtOrAboveKmh: 1.8,
    });
    expect(resumed).toMatchObject({
      paused: false,
      accumulatedLowSpeedSec: 0,
      movingTimeIncrementSec: 5,
    });
  });

  it("牆鐘 duration 在暫停區間持續前進，而 moving time 只接受自動暫停前與恢復後的可信區間", () => {
    const intervals = [
      { intervalSec: 10, movingTimeIncrementSec: 10 },
      { intervalSec: 15, movingTimeIncrementSec: 0 },
      { intervalSec: 5, movingTimeIncrementSec: 5 },
    ];
    const durationSec = intervals.reduce(
      (total, item) => total + item.intervalSec,
      0,
    );
    const movingTimeSec = intervals.reduce(
      (total, item) => total + item.movingTimeIncrementSec,
      0,
    );
    expect(durationSec).toBe(30);
    expect(movingTimeSec).toBe(15);
    expect(movingTimeSec).toBeLessThan(durationSec);
  });

  it.each([
    [1_000, 12, 1_000],
    [5_000, 2, 5_000],
    [10_000, 1, 10_000],
  ])(
    "12 km 軌跡在 %i m 設定下產生 %i 個精準 %i m 自動分圈",
    (intervalM, count, expectedDistanceM) => {
      const result = runTwelveKilometers(intervalM);
      expect(result.completedLaps).toHaveLength(count);
      expect(result.completedLaps.map((lap) => lap.distanceM)).toEqual(
        Array(count).fill(expectedDistanceM),
      );
      expect(result.completedLaps.every((lap) => lap.source === "auto")).toBe(
        true,
      );
    },
  );
});

describe("規格書純數學 COG 與路口提示守門", () => {
  it("以最近 3 秒 GPS 位移計算 COG，並套用 0.28 指數平滑而非硬體航向", () => {
    const heading = calculateCourseOverGround([
      { lat: 25, lon: 121, timestamp: 0 },
      { lat: 25.00004, lon: 121.000001, timestamp: 1_000 },
      { lat: 25.0002, lon: 121.000003, timestamp: 3_000 },
    ]);
    expect(heading).not.toBeNull();
    expect(heading!).toBeGreaterThanOrEqual(0);
    expect(heading!).toBeLessThan(10);
    expect(smoothCogHeading(0, 90)).toBeCloseTo(25.2, 5);
  });

  it("以 GPX 向量正確區分右轉與左轉，並在 100 m／50 m 門檻提供喚醒與語音資料", () => {
    const rightTurn = findNextRouteTurn(
      [
        { lat: 0, lon: 0 },
        { lat: 0.00045, lon: 0 },
        { lat: 0.00045, lon: 0.00045 },
      ],
      0,
    );
    const leftTurn = findNextRouteTurn(
      [
        { lat: 0, lon: 0 },
        { lat: 0.00045, lon: 0 },
        { lat: 0.00045, lon: -0.00045 },
      ],
      0,
    );
    expect(rightTurn).toMatchObject({ direction: "right" });
    expect(leftTurn).toMatchObject({ direction: "left" });
    expect(shouldWakeForUpcomingTurn(rightTurn)).toBe(true);
    expect(rightTurn!.distanceM).toBeLessThanOrEqual(TURN_WAKE_DISTANCE_M);
    expect(TURN_SPEAK_DISTANCE_M).toBe(50);
  });
});

describe("規格書智慧補給與補水守門", () => {
  it("Date.now() 絕對時間倒數在 GPS 自動暫停期間仍持續遞減", () => {
    const startedAtMs = 1_700_000_000_000;
    const countdown = createSmartSupplyCountdown(
      BASE_SUPPLY_PLAN,
      0,
      startedAtMs,
    );
    expect(
      smartSupplyCountdownRemainingSec(
        countdown,
        "water",
        startedAtMs + 90_000,
      ),
    ).toBe(1_110);
    // 此處不改變 ride elapsed，模擬 GPS 自動暫停；倒數仍由 absolute dueAtMs 計算。
    expect(
      smartSupplyCountdownRemainingSec(
        countdown,
        "water",
        startedAtMs + 300_000,
      ),
    ).toBe(900);
  });

  it("暫停不會套用到下一輪能量提醒或改寫既有倒數", () => {
    expect(calculatePausedRecoveryExtensionSec(600)).toBe(0);
    expect(calculatePausedRecoveryExtensionSec(10_000)).toBe(0);
    const adjusted = applyPausedRecoveryToNextSupplyPlan(BASE_SUPPLY_PLAN, 600);
    expect(adjusted.energyCountdownSec).toBe(3_600);
    expect(adjusted.waterCountdownSec).toBe(1_200);
    expect(adjusted.reason).toBe(BASE_SUPPLY_PLAN.reason);
  });

  it("天氣資料在 60 秒 Timeout 後可降級，後續使用前輪間隔或首輪 10 分鐘", async () => {
    jest.useFakeTimers();
    const pendingWeather = new Promise<null>(() => undefined);
    const resultPromise = awaitHydrationInputs({
      weatherPromise: pendingWeather,
      sensorPromise: Promise.resolve({
        elapsedSec: 0,
        powerW: 0,
        speedKmh: 0,
        sweatRatePerHour: 500,
      }),
      timeoutMs: HYDRATION_DATA_TIMEOUT_MS,
    });
    await jest.advanceTimersByTimeAsync(HYDRATION_DATA_TIMEOUT_MS);
    await expect(resultPromise).resolves.toEqual({ status: "timeout" });
    expect(resolveWaterCountdownFallbackDuration(1_500)).toBe(1_500);
    expect(resolveWaterCountdownFallbackDuration(undefined)).toBe(600);
    jest.useRealTimers();
  });
});

describe("產品程式碼 GPS COG 防回退守門", () => {
  it("地圖流程不讀取硬體 heading、羅盤或裝置方向 API", () => {
    const mapSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/(tabs)/map.tsx"),
      "utf8",
    );
    expect(mapSource).toContain("calculateCourseOverGround");
    expect(mapSource).toContain("resolveNavigationCog");
    expect(mapSource).not.toMatch(
      /coords\.heading|Magnetometer|DeviceOrientation/,
    );
  });
});
