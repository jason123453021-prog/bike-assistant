import fs from "node:fs";
import path from "node:path";

import i18n, { SUPPORTED_LOCALES } from "../../lib/i18n/i18n";

const projectRoot = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("儀表板、設定與路線分析全語系守門", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-TW");
  });

  it("所有支援語系均具備核心儀表板、定位、設定、路線天氣與權限文案", async () => {
    const keys = [
      "dashboard.rideTime",
      "dashboard.energyCountdown",
      "map.freeHeading",
      "settings.rideDashboard",
      "settings.autoPauseDescription",
      "routes.airDensity",
      "routes.title",
      "routes.weatherFallback",
      "routes.forecastTitle",
      "routes.calorieAnalysis",
      "routes.gradientDistribution",
      "routes.ridingTipHigh",
      "routes.weatherThunderstorm",
      "permissions.title",
    ];

    for (const locale of SUPPORTED_LOCALES) {
      await i18n.changeLanguage(locale);
      for (const key of keys) {
        expect(i18n.t(key)).not.toBe(key);
      }
    }
  });

  it("切換英文、日文與 Arabic 後輸出各自的核心術語", async () => {
    await i18n.changeLanguage("en-US");
    expect(i18n.t("dashboard.rideTime")).toBe("Ride Time");
    expect(i18n.t("settings.rideDashboard")).toBe("Riding & Dashboard");
    expect(i18n.t("routes.airDensity", { temperature: 26 })).toBe(
      "Weather-linked air density (26°C)",
    );

    await i18n.changeLanguage("ja-JP");
    expect(i18n.t("dashboard.energyCountdown")).toBe("補給カウントダウン");
    expect(i18n.t("settings.title")).toBe("設定");
    expect(i18n.t("settingsDetail.fieldRideTime")).toBe("ライド時間");
    expect(i18n.t("settingsDetail.fieldSpeed")).toBe("速度");
    expect(i18n.t("settingsDetail.fieldDistance")).toBe("距離");
    expect(i18n.t("settingsDetail.fieldGrade")).toBe("勾配");
    expect(i18n.t("settingsDetail.fieldPower")).toBe("パワー");
    expect(i18n.t("settingsDetail.panel")).toBe("パネル");
    expect(i18n.t("settingsDetail.expand")).toBe("展開");
    expect(i18n.t("settingsActions.systemDataTitle")).toBe("システムとデータ");
    expect(i18n.t("settingsActions.openHistoryBackupLabel")).toBe(
      "GPX トラックをエクスポート / バックアップ",
    );
    expect(i18n.t("settingsActions.resetAllLabel")).toBe(
      "すべての設定をリセット",
    );
    expect(i18n.t("routes.title")).toMatch(/[\u3040-\u30ff\u4e00-\u9fff]/);
    expect(i18n.t("routes.weatherFallback", { temp: 25 })).toMatch(/25°C/);

    await i18n.changeLanguage("ko-KR");
    const koreanFallback = i18n.t("routes.weatherFallback", { temp: 25 });
    expect(koreanFallback).toMatch(/[\uac00-\ud7af]/);
    expect(koreanFallback).not.toMatch(/[\u3040-\u30ff]/);
    expect(i18n.t("settingsDetail.panel")).toBe("패널");
    expect(i18n.t("settingsDetail.expand")).toBe("확장");
    expect(i18n.t("settingsActions.systemDataTitle")).toBe("시스템 및 데이터");

    await i18n.changeLanguage("ar-SA");
    expect(i18n.t("map.freeHeading")).toBe("حر");
    expect(i18n.t("permissions.title")).toBe("التحضير للركوب في الخلفية");
  });

  it("核心畫面不再把使用者點名的標籤與動態天氣模板寫死在 JSX", () => {
    const mapSource = readSource("app/(tabs)/map.tsx");
    const settingsSource = readSource("app/(tabs)/settings.tsx");
    const routeSource = readSource("app/(tabs)/navigate.tsx");
    const readinessSource = readSource(
      "components/ride-permission-readiness.tsx",
    );

    expect(mapSource).toContain('t("dashboard.rideTime")');
    expect(mapSource).toContain('t("dashboard.energyCountdown")');
    expect(mapSource).toContain('t("dashboard.hydrationCountdown")');
    expect(mapSource).toContain('t("dashboard.maxPower")');
    expect(mapSource).toContain('t("dashboard.start")');
    expect(mapSource).toContain('t("map.freeHeading")');
    expect(mapSource).not.toContain('label="騎乘時間"');
    expect(mapSource).not.toContain('label="最大功率"');

    expect(settingsSource).toContain('t("settings.rideDashboard")');
    expect(settingsSource).toContain('t("settings.autoLapDistance")');
    expect(settingsSource).toContain('t("settings.autoPauseDescription")');
    expect(settingsSource).not.toContain('title="騎乘與儀表板設定"');

    expect(routeSource).toContain('t("routes.airDensity"');
    expect(routeSource).toContain('t("routes.weatherDescription"');
    expect(routeSource).toContain('t("routes.weatherFallback", { temp: 25 })');
    expect(routeSource).toContain('t("routes.forecastTitle")');
    expect(routeSource).toContain('t("routes.calorieAnalysis")');
    expect(routeSource).toContain('t("routes.gradientDistribution")');
    expect(routeSource).toContain('t("routes.ridingTips")');
    expect(routeSource).toContain("getRouteWeatherDescriptionKey");
    expect(routeSource).not.toContain("天氣連動空氣密度（");
    expect(routeSource).not.toContain('label="預估水分流失"');
    expect(routeSource).not.toContain("起點天氣與風向預報");
    expect(readinessSource).toContain("useTranslation");
    expect(readinessSource).toContain("permissions.title");
  });

  it("自由定位模式在深淺主題均使用實心高對比背景與陰影層次", () => {
    const mapSource = readSource("app/(tabs)/map.tsx");

    expect(mapSource).toContain(
      'backgroundColor: colorScheme === "dark" ? "#2C2C2E" : "#FFFFFF"',
    );
    expect(mapSource).toContain(
      'color: colorScheme === "dark" ? "#F9FAFB" : "#374151"',
    );
    expect(mapSource).toContain("styles.freeHeadingToolBtn");
    expect(mapSource).toContain("shadowOpacity: 0.28");
    expect(mapSource).toContain("shadowRadius: 4");
    expect(mapSource).toContain("elevation: 5");
  });
});
