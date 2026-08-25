import fs from "node:fs";
import path from "node:path";

import i18n, { findMissingTranslationKeys, LOCALE_RESOURCES, SUPPORTED_LOCALES } from "../../lib/i18n/i18n";
import { generateShareCard, generateShareText } from "../../lib/garmin-card-generator";
import { createRideShareCardSvg } from "../../lib/ride-share-card-svg";
import type { RideRecord } from "../../lib/ride-context";

const rootDir = path.resolve(__dirname, "../..");
const ride = {
  id: "i18n-share",
  name: "Harbor Sunrise",
  date: Date.UTC(2026, 7, 25, 6, 30),
  distance: 12450,
  duration: 2400,
  movingTime: 2200,
  totalAscent: 245,
  totalDescent: 130,
  avgSpeed: 24.3,
  maxSpeed: 44.2,
  calories: 610,
  avgPower: 182,
  maxPower: 540,
  powerZones: [1, 2, 3, 4, 5],
  route: [],
  powerSource: "estimated",
  caloriesSource: "mixed-estimate",
} as unknown as RideRecord;

describe("全域 i18n 同步、活動詳情與分享守門", () => {
  afterEach(async () => { await i18n.changeLanguage("zh-TW"); });

  it("所有註冊 locale 都以英文資源補齊完整 key，沒有空值或未解析 fallback", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(findMissingTranslationKeys(LOCALE_RESOURCES["en-US"], LOCALE_RESOURCES[locale])).toEqual([]);
    }
  });

  it("快速連續切換後，i18next 的解析語言與最後選擇一致", async () => {
    await i18n.changeLanguage("ja-JP");
    await i18n.changeLanguage("en-US");
    expect(i18n.resolvedLanguage).toBe("en-US");
    expect(i18n.t("share.title")).toBe("Share Card");
  });

  it("文字分享與 SVG 圖卡會採用目前注入語系的標籤和日期格式", () => {
    const englishCard = generateShareCard(ride, { locale: "en-US", t: i18n.getFixedT("en-US") });
    const text = generateShareText(englishCard, i18n.getFixedT("en-US"));
    const svg = createRideShareCardSvg(ride, { locale: "en-US", t: i18n.getFixedT("en-US") });
    expect(text).toContain("Distance");
    expect(svg).toContain("Activity Summary");
    expect(svg).toContain("Moving Time");
    expect(svg).not.toContain("活動摘要");
  });

  it("活動詳情與分享 Modal 均訂閱翻譯 hook，且分享 SVG 接收 locale 與 translator", () => {
    const detail = fs.readFileSync(path.join(rootDir, "app/ride-detail.tsx"), "utf8");
    const modal = fs.readFileSync(path.join(rootDir, "components/share-card-modal.tsx"), "utf8");
    const svg = fs.readFileSync(path.join(rootDir, "lib/ride-share-card-svg.ts"), "utf8");
    expect(detail).toContain("useTranslation");
    expect(detail).toContain('t("detail.title")');
    expect(modal).toContain("useTranslation");
    expect(modal).toContain("activeLanguage");
    expect(svg).toContain("options?: { t?:");
  });
});
