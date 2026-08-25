import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  createRideShareCardFilename,
  createRideShareCardSvg,
} from "../lib/ride-share-card-svg";
import type { RideRecord } from "../lib/ride-context";
import {
  LOCALE_RESOURCES,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../lib/i18n/i18n";

const record = {
  id: "share-001",
  date: new Date("2026-08-13T07:30:00+08:00").getTime(),
  name: "晨騎 <測試>",
  duration: 7200,
  distance: 45200,
  avgSpeed: 22.6,
  maxSpeed: 46.2,
  totalAscent: 620,
  calories: 1560,
  avgPower: 142,
  maxPower: 618,
  powerZones: [1, 2, 3, 4, 5],
  powerHistory: [],
  totalSweatMl: 850,
  refillCount: 2,
  totalPausedSec: 600,
  route: [
    {
      latitude: 25.0478,
      longitude: 121.5319,
      altitude: 12,
      speed: 4.2,
      timestamp: 1,
    },
    {
      latitude: 25.055,
      longitude: 121.545,
      altitude: 18,
      speed: 5.4,
      timestamp: 2,
    },
  ],
  personalBests: [
    { metric: "distance", label: "最長距離", value: 45.2, unit: "km" },
  ],
} as RideRecord;

const longActivityNames: Record<SupportedLocale, string> = {
  "zh-TW": "北海岸逆風長距離爬升與濱海公路耐力騎乘紀錄暨全天候補給策略驗證",
  "zh-CN": "北海岸逆风长距离爬升与滨海公路耐力骑行记录暨全天候补给策略验证",
  "en-US":
    "Coastal Headwind Endurance Ride Across Mountain Passes and Harbor Roads",
  "ja-JP":
    "海岸線と山岳峠を越える向かい風の長距離エンデュランスライドと補給戦略の記録",
  "ko-KR":
    "해안 역풍과 산악 고개를 넘는 장거리 지구력 라이딩 및 종일 보급 전략 검증 기록",
  "es-ES":
    "Ruta de resistencia con viento en contra por puertos de montaña y costa",
  "pt-BR":
    "Pedal de resistência com vento contra por montanhas e estradas costeiras",
  "fr-FR":
    "Sortie d’endurance face au vent entre cols montagneux et routes côtières",
  "de-DE":
    "Donaudampfschifffahrtsgesellschaftskapitänin bei Gegenwind entlang der Küstenberge",
  "it-IT":
    "Lunga uscita di resistenza controvento tra passi montani e strade costiere",
  "nl-NL":
    "Lange duurtraining met tegenwind over bergpassen, kustwegen en een volledige voedingsstrategie",
  "ru-RU":
    "Многодневнаявелосипеднаяпоездкачерезгорныемаршрутыиприбрежныедороги",
  "ar-SA": "رحلة دراجات طويلة ضد الرياح عبر الجبال والطرق الساحلية الممتدة",
};

function translationFor(locale: SupportedLocale, key: string): string {
  const resolved = key
    .split(".")
    .reduce<unknown>(
      (value, segment) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      LOCALE_RESOURCES[locale],
    );
  return typeof resolved === "string" ? resolved : key;
}

describe("local ride share card", () => {
  it("creates a self-contained SVG with route and core activity metrics", () => {
    const svg = createRideShareCardSvg(record);
    expect(svg).toContain("<svg");
    expect(svg).toContain("polyline");
    expect(svg).toContain("45.20");
    expect(svg).toContain("晨騎 &lt;測試&gt;");
    expect(svg).toContain("活動摘要");
    expect(svg).toContain("移動時間");
    expect(svg).toContain("GPS 移動");
    expect(svg).toContain("爬升");
    expect(svg.indexOf("距離")).toBeLessThan(svg.indexOf("平均速度"));
  });

  it("creates a safe local SVG filename", () => {
    expect(createRideShareCardFilename(record)).toMatch(
      /^(?:share-card|分享卡片)-晨騎-測試-\d{4}-\d{2}-\d{2}\.svg$/,
    );
  });

  it("marks unavailable power as insufficient data instead of presenting an invented 0 W", () => {
    const svg = createRideShareCardSvg({
      ...record,
      avgPower: 0,
      maxPower: 0,
      powerSource: "unavailable",
      powerHistory: [],
    });

    expect(svg).toContain("資料不足");
    expect(svg).toContain(">--<");
  });

  it("移動時間為零時維持安全統計，且路線採用等比例 fit bounds 不拉伸", () => {
    const svg = createRideShareCardSvg({
      ...record,
      movingTime: 0,
      totalPausedSec: record.duration,
      avgPower: 9999,
      maxPower: 9999,
      powerSource: "estimated",
    });
    const source = readFileSync("lib/ride-share-card-svg.ts", "utf8");
    expect(svg).not.toContain("Infinity");
    expect(svg).toContain("資料不足");
    expect(source).toContain(
      "const drawScale = Math.min(900 / lonSpan, 570 / latSpan);",
    );
  });

  it("GPS 軌跡不足時顯示明確空狀態，且分享預覽直接使用輸出 SVG", () => {
    const svg = createRideShareCardSvg({ ...record, route: [] });
    const modalSource = readFileSync("components/share-card-modal.tsx", "utf8");
    expect(svg).toContain("此活動沒有可繪製的 GPS 軌跡");
    expect(svg).not.toContain('<polyline points=""');
    expect(modalSource).toContain("shareCardPreviewHtml");
    expect(modalSource).toContain("預覽與實際匯出的 PNG 使用同一張 SVG");
    expect(modalSource).not.toContain('backgroundColor: "#667eea"');
  });

  it("長德文、俄文與阿拉伯文活動標題會縮放或分行，不以省略號截斷", () => {
    const names = [
      "Donaudampfschifffahrtsgesellschaftskapitänin bei Gegenwind",
      "Многодневнаявелосипеднаяпоездкачерезгорныемаршруты",
      "جولة دراجات طويلة عبر الجبال والطرق الساحلية",
    ];

    for (const name of names) {
      const svg = createRideShareCardSvg(
        { ...record, name },
        { locale: "de-DE" },
      );
      expect(svg).toContain("<tspan");
      expect(svg).not.toContain("…");
      expect(svg).toMatch(/font-size="(?:3[4-9]|4\d|5\d(?:\.\d)?)"/);
    }
  });

  it("全部支援語言的真實長活動名稱均以 tspan 換行並保留完整統計圖卡結構", () => {
    expect(Object.keys(longActivityNames)).toHaveLength(
      SUPPORTED_LOCALES.length,
    );

    for (const locale of SUPPORTED_LOCALES) {
      const svg = createRideShareCardSvg(
        { ...record, name: longActivityNames[locale] },
        { locale, t: (key) => translationFor(locale, key) },
      );
      const titleTspans =
        svg
          .slice(
            svg.indexOf('<text x="64" y="1066"'),
            svg.indexOf("</text>", svg.indexOf('<text x="64" y="1066"')),
          )
          .match(/<tspan /g) ?? [];

      expect(
        titleTspans.length,
        `${locale}: ${longActivityNames[locale]}`,
      ).toBeGreaterThan(1);
      expect(svg).not.toContain("…");
      expect(svg).not.toContain("undefined");
      expect(svg).toContain('x1="64" y1="');
      expect(svg).toContain('x="540" y="1890"');
    }
  });
});
