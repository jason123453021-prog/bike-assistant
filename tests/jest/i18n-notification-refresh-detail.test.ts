import fs from "node:fs";
import path from "node:path";

import i18n from "../../lib/i18n/i18n";
import { SUPPORTED_LOCALES } from "../../lib/i18n/i18n";
import { createLocalizedSupplyNotificationContent } from "../../lib/supply-notification-localization";
import { buildSupplyNotificationRefreshPlan } from "../../lib/supply-notification-reschedule";
import type { BackgroundState } from "../../lib/background-location";

const rootDir = path.resolve(__dirname, "../..");

function state(overrides: Partial<BackgroundState> = {}): BackgroundState {
  return {
    isRiding: true,
    supplyReminderEnabled: true,
    supplyCalculationMode: "smart",
    smartEnergySupplyEnabled: true,
    smartWaterSupplyEnabled: true,
    calorieReminderSent: false,
    waterReminderSent: false,
    smartCalorieCountdownDueAtMs: 90_000,
    smartWaterCountdownDueAtMs: 120_000,
    intervalEnergyTimeReminderSent: false,
    intervalEnergyDistanceReminderSent: false,
    intervalWaterTimeReminderSent: false,
    intervalWaterDistanceReminderSent: false,
    totalDistanceM: 0,
    calories: 0,
    sweatLossMl: 0,
    lastLat: 0,
    lastLon: 0,
    lastTimestamp: 0,
    calorieThreshold: 1,
    waterThreshold: 1,
    rideStartedAt: 0,
    supplyEnergyTimeIntervalEnabled: false,
    supplyEnergyTimeIntervalMinutes: 30,
    supplyEnergyDistanceIntervalEnabled: false,
    supplyEnergyDistanceIntervalKm: 10,
    supplyWaterTimeIntervalEnabled: false,
    supplyWaterTimeIntervalMinutes: 15,
    supplyWaterDistanceIntervalEnabled: false,
    supplyWaterDistanceIntervalKm: 5,
    intervalLastEnergyTimeSec: 0,
    intervalLastEnergyDistanceKm: 0,
    intervalLastWaterTimeSec: 0,
    intervalLastWaterDistanceKm: 0,
    ...overrides,
  };
}

describe("語言切換通知重排與活動詳情次要字串守門", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-TW");
  });

  it("重排計畫會保留既有 dueAt 與待確認旗標，而不是重設倒數", () => {
    const plan = buildSupplyNotificationRefreshPlan(
      state({
        calorieReminderSent: true,
        intervalWaterDistanceReminderSent: true,
      }),
      10_000,
    );
    expect(plan.scheduled).toEqual([{ kind: "water", dueAtMs: 120_000 }]);
    expect(plan.immediate).toEqual(["calorie", "interval-water-distance"]);
  });

  it("停用提醒或結束騎乘時不重建任何通知", () => {
    expect(
      buildSupplyNotificationRefreshPlan(
        state({ supplyReminderEnabled: false }),
        10_000,
      ),
    ).toEqual({ scheduled: [], immediate: [] });
    expect(
      buildSupplyNotificationRefreshPlan(state({ isRiding: false }), 10_000),
    ).toEqual({ scheduled: [], immediate: [] });
  });

  it("指定 locale 的通知內容與 interval 提示會跟隨語言，不依賴背景預設語言", async () => {
    await i18n.changeLanguage("zh-TW");
    expect(
      createLocalizedSupplyNotificationContent(
        "interval-energy-time",
        { intervalValue: 30 },
        "en-US",
      ).body,
    ).toBe("30 minutes completed. Please refuel.");
    expect(
      createLocalizedSupplyNotificationContent(
        "interval-water-distance",
        { intervalValue: 5 },
        "zh-TW",
      ).body,
    ).toBe("已累積騎乘 5 公里，請補充水分。");
  });

  it("全部支援語言都可建立背景補給與補水通知內容，不顯示遺漏的翻譯 key", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const energy = createLocalizedSupplyNotificationContent(
        "interval-energy-time",
        { intervalValue: 30 },
        locale,
      );
      const water = createLocalizedSupplyNotificationContent(
        "interval-water-distance",
        { intervalValue: 5 },
        locale,
      );

      for (const content of [energy, water]) {
        expect(content.title).toMatch(/^.{3,}/u);
        expect(content.body).toMatch(/^.{3,}/u);
        expect(content.title).not.toMatch(/^notifications\./);
        expect(content.body).not.toMatch(/^notifications\./);
      }
    }
  });

  it("語言 Provider、背景通知與活動詳情皆使用可追溯的語系化入口", () => {
    const provider = fs.readFileSync(
      path.join(rootDir, "lib/i18n/language-provider.tsx"),
      "utf8",
    );
    const feedback = fs.readFileSync(
      path.join(rootDir, "lib/feedback-service.ts"),
      "utf8",
    );
    const background = fs.readFileSync(
      path.join(rootDir, "lib/background-location.ts"),
      "utf8",
    );
    const detail = fs.readFileSync(
      path.join(rootDir, "app/ride-detail.tsx"),
      "utf8",
    );
    const deviceValidation = fs.readFileSync(
      path.join(
        rootDir,
        "references/android-notification-device-validation-2026-08-25.md",
      ),
      "utf8",
    );
    expect(provider).toContain(
      "rescheduleLocalizedSupplyNotifications(nextLanguage)",
    );
    expect(feedback).toContain("buildSupplyNotificationRefreshPlan");
    expect(background).toContain("notificationLocale");
    for (const key of [
      "activityAnalysis",
      "perKilometerSplits",
      "elevationBandDistribution",
      "exportStandardFit",
      "advancedTraining",
    ]) {
      expect(detail).toContain(`t(\"detail.${key}\")`);
    }
    for (const requiredStep of [
      "release APK",
      "點擊通知本體",
      "已補給",
      "切換 App 語言",
    ]) {
      expect(deviceValidation).toContain(requiredStep);
    }
  });
});
