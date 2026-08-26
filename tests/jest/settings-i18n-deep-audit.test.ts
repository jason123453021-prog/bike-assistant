import fs from "node:fs";
import path from "node:path";

import { LOCALE_RESOURCES, SUPPORTED_LOCALES } from "../../lib/i18n/i18n";

const projectRoot = path.resolve(__dirname, "../..");
const settingsSource = fs.readFileSync(
  path.join(projectRoot, "app/(tabs)/settings.tsx"),
  "utf8",
);

function getPath(resource: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, resource);
}

describe("設定頁深度 i18n 守門", () => {
  const requiredSettingsDetailKeys = [
    "personalProfile",
    "birthday",
    "autoMetrics",
    "backgroundGpsAccuracy",
    "gpsPowerSaving",
    "gpsStandard",
    "gpsHighAccuracy",
    "enableSupplyReminders",
    "smartEnergy",
    "smartHydration",
    "servingCarbohydrate",
    "scienceCarbohydrateHint",
    "repeatReminder",
    "customSupply",
    "feedback",
    "appearanceTheme",
    "smartPowerSaving",
    "touchGuard",
    "simplifiedNavigation",
    "mapInteraction",
    "idleRecenterHint",
    "navigationDashboardFields",
    "compactFields",
    "dragDashboardFields",
    "appVersion",
  ];

  it("十三種支援語系均能解析完整設定頁詳細鍵集", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const resource = LOCALE_RESOURCES[locale] as Record<string, unknown>;
      for (const key of requiredSettingsDetailKeys) {
        expect(getPath(resource, `settingsDetail.${key}`)).toEqual(
          expect.any(String),
        );
      }
    }
  });

  it("使用者列出的設定標籤與說明不再以繁中硬編碼輸出", () => {
    const deprecatedVisibleLiterals = [
      'title="個人資料"',
      'title="背景 GPS 精度"',
      'title="補給提醒"',
      'label="啟用補給與補水提醒"',
      'label="智慧能量補給"',
      'label="智慧補水"',
      'title="回饋設定"',
      'title="智慧省電模式"',
      'title="騎乘防誤觸"',
      'title="精簡導航模式"',
      'title="地圖互動"',
      'title="導航儀表板欄位"',
      'title="精簡模式欄位"',
      '單車助手 v{',
      '拖曳右側☰',
    ];

    for (const literal of deprecatedVisibleLiterals) {
      expect(settingsSource).not.toContain(literal);
    }
    expect(settingsSource).toContain('t("settingsDetail.idleRecenterHint")');
    expect(settingsSource).toContain('t("settingsDetail.dragDashboardFields"');
    expect(settingsSource).toContain('t("settingsDetail.fieldDirection")');
  });

  it("補給、個人資料與秒數動態文字使用 i18next 插值而非字串拼接", () => {
    expect(settingsSource).toContain('t("settingsDetail.scienceCarbohydrateHint", {');
    expect(settingsSource).toContain('t("settingsDetail.autoMetrics", {');
    expect(settingsSource).toContain('t("settingsDetail.repeatHint", {');
    expect(settingsSource).toContain('t("settingsDetail.supplyTimeSummary", {');
    expect(settingsSource).toContain('t("settingsDetail.appVersion", {');
    expect(settingsSource).not.toMatch(
      /目前依\s*\+|每\s*\+\s*settings\.supplyReminderRepeatSec|單車助手 v\s*\+/,
    );
  });
});
