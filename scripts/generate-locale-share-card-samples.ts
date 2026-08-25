import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  LOCALE_RESOURCES,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../lib/i18n/i18n";
import type { RideRecord } from "../lib/ride-context";
import { createRideShareCardSvg } from "../lib/ride-share-card-svg";

const outputDirectory = resolve(
  process.argv[2] ?? "build/share-card-long-title-validation",
);

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

const record: RideRecord = {
  id: "share-card-locale-validation",
  date: new Date("2026-08-25T09:00:00+08:00").getTime(),
  name: "",
  duration: 7200,
  movingTime: 6600,
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
  personalBests: [],
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

mkdirSync(outputDirectory, { recursive: true });
for (const locale of SUPPORTED_LOCALES) {
  const svg = createRideShareCardSvg(
    { ...record, name: longActivityNames[locale] },
    { locale, t: (key) => translationFor(locale, key) },
  );
  writeFileSync(
    resolve(outputDirectory, `share-card-long-title-${locale}.svg`),
    svg,
    "utf8",
  );
}

console.log(
  `Generated ${SUPPORTED_LOCALES.length} localized share-card SVG files in ${outputDirectory}`,
);
