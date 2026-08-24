import fs from "node:fs";
import path from "node:path";

import i18n, {
  normalizeLocaleTag,
  resolveLanguagePreference,
  SUPPORTED_LOCALES,
} from "../../lib/i18n/i18n";
import { formatCourseNavigationPrompt } from "../../lib/i18n/course-navigation";
import { buildSportDashboardMetrics } from "../../lib/sport-metrics";

const rootDir = path.resolve(__dirname, "../..");

const cyclingMetricParams = {
  sportType: "cycling" as const,
  speedKmh: 31.2,
  averageSpeedKmh: 28.4,
  distanceM: 12_450,
  elapsedSec: 2_430,
  altitudeM: 60,
  totalAscentM: 245,
  gradePct: 2.1,
};

describe("Local-First i18n 守門", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-TW");
  });

  it("提供指定的 12 種 ISO 語系並將未知系統語系安全回退為英文", () => {
    expect(SUPPORTED_LOCALES).toEqual([
      "zh-TW", "zh-CN", "en-US", "ja-JP", "ko-KR", "es-ES",
      "pt-BR", "fr-FR", "de-DE", "it-IT", "nl-NL", "ru-RU",
    ]);
    expect(normalizeLocaleTag("zh_Hant_TW")).toBe("zh-TW");
    expect(normalizeLocaleTag("ja")).toBe("ja-JP");
    expect(normalizeLocaleTag("sv-SE")).toBe("en-US");
    expect(resolveLanguagePreference("system", ["ja-JP", "en-US"])).toBe("ja-JP");
  });

  it("切換至日本語時，儀表、導航與騎乘摘要均輸出日本語術語", async () => {
    await i18n.changeLanguage("ja-JP");
    const dashboard = buildSportDashboardMetrics(cyclingMetricParams, i18n.t.bind(i18n));

    expect(dashboard.map((metric) => metric.label)).toEqual(["速度", "平均速度", "距離", "経過時間"]);
    expect(formatCourseNavigationPrompt(i18n.t.bind(i18n), "left", 45)).toBe("まもなく曲がります：左折");
    expect(i18n.t("summary.rideSummary")).toBe("ライド概要");
    expect(i18n.t("summary.movingTime")).toBe("移動時間");
  });

  it("切換至 English (US) 時，儀表、導航與騎乘摘要均即時替換為英文", async () => {
    await i18n.changeLanguage("en-US");
    const dashboard = buildSportDashboardMetrics(cyclingMetricParams, i18n.t.bind(i18n));

    expect(dashboard.map((metric) => metric.label)).toEqual(["Speed", "Avg Speed", "Distance", "Elapsed Time"]);
    expect(formatCourseNavigationPrompt(i18n.t.bind(i18n), "right", 150)).toBe("150 m · Turn right");
    expect(i18n.t("summary.rideSummary")).toBe("Ride Summary");
    expect(i18n.t("summary.saveAndFinish")).toBe("Save & Finish");
  });

  it("保留英文 fallback，且核心儀表、導航提示與摘要元件確實接入翻譯 hook", async () => {
    await i18n.changeLanguage("ja-JP");
    expect(i18n.options.saveMissing).toBe(false);
    expect(i18n.options.fallbackLng).toEqual(expect.arrayContaining(["en-US"]));
    expect(i18n.t("dashboard.missingKey", { defaultValue: "English fallback" })).toBe("English fallback");

    const mapSource = fs.readFileSync(path.join(rootDir, "app/(tabs)/map.tsx"), "utf8");
    const summarySource = fs.readFileSync(path.join(rootDir, "components/ride-summary-modal.tsx"), "utf8");
    expect(mapSource).toContain("useTranslation");
    expect(mapSource).toContain("formatCourseNavigationPrompt(t");
    expect(summarySource).toContain("useTranslation");
    expect(summarySource).toContain('t("summary.rideSummary")');
    expect(summarySource).toContain('t("summary.saveAndFinish")');
  });
});
