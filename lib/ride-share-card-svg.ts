import type { RideRecord } from "./ride-context";
import { buildActivityStatistics } from "./activity-statistics";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const FONT_STACK = "Arial, Noto Sans TC, sans-serif";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(timestamp: number, locale: string): string {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" })} ${date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remain = total % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}` : `${minutes}:${String(remain).padStart(2, "0")}`;
}

function truncateTitle(value: string, maximum = 18): string {
  return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;
}

function sportLabel(record: RideRecord, t: (key: string) => string): string {
  switch (record.sportType) {
    case "running": return t("sports.running");
    case "trail_running": return t("sports.trailRunning");
    case "hiking": return t("sports.hiking");
    default: return t("sports.cycling");
  }
}

/** 將 GPS 軌跡以中緯度校正並等比例 fit 至地圖安全範圍。 */
function routePoints(record: RideRecord): string {
  if (record.route.length < 2) return "";
  const lats = record.route.map((point) => point.latitude);
  const lons = record.route.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  const lonScale = Math.max(0.1, Math.cos((centerLat * Math.PI) / 180));
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lonSpan = Math.max((maxLon - minLon) * lonScale, 0.0001);
  const drawScale = Math.min(900 / lonSpan, 570 / latSpan);
  return record.route.map((point) => {
    const x = 540 + (point.longitude - centerLon) * lonScale * drawScale;
    const y = 450 - (point.latitude - centerLat) * drawScale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function metricCell({
  x,
  y,
  label,
  value,
  unit,
  primary = false,
  unavailable = false,
}: {
  x: number;
  y: number;
  label: string;
  value: string;
  unit: string;
  primary?: boolean;
  unavailable?: boolean;
}): string {
  const valueColor = unavailable ? "#7E8B99" : "#F8FBFD";
  const valueSize = primary ? 62 : 50;
  return `<text x="${x}" y="${y}" fill="#93A2B2" font-size="24" font-weight="700" font-family="${FONT_STACK}" text-anchor="middle" letter-spacing="1">${escapeXml(label)}</text>
    <text x="${x}" y="${y + 66}" fill="${valueColor}" font-size="${valueSize}" font-weight="800" font-family="${FONT_STACK}" text-anchor="middle">${escapeXml(value)}</text>
    <text x="${x}" y="${y + 102}" fill="#93A2B2" font-size="21" font-family="${FONT_STACK}" text-anchor="middle">${escapeXml(unit)}</text>`;
}

const DEFAULT_SHARE_COPY: Record<string, string> = { "share.noGps": "此活動沒有可繪製的 GPS 軌跡", "share.distance": "距離", "share.movingTime": "移動時間", "share.elevation": "總爬升", "share.averageSpeed": "平均速度", "share.averagePower": "平均功率", "share.calories": "卡路里", "share.kilometers": "公里", "share.meters": "公尺", "share.watts": "瓦", "share.kilocalories": "大卡", "share.gpsMoving": "GPS 移動", "share.unavailable": "資料不足", "share.activitySummary": "活動摘要", "share.gpsRecord": "GPS 記錄", "share.movingTimeMethod": "移動時間依可信 GPS 位置、距離與速度計算", "share.createdOffline": "由單車助手在此裝置離線產生", "share.untitledRide": "未命名騎乘", "sports.cycling": "自行車", "sports.running": "跑步", "sports.trailRunning": "越野跑", "sports.hiking": "健行" };

export function createRideShareCardSvg(record: RideRecord, options?: { t?: (key: string) => string; locale?: string }): string {
  const t = options?.t ?? ((key: string) => DEFAULT_SHARE_COPY[key] ?? key);
  const locale = options?.locale ?? "zh-TW";
  const points = routePoints(record);
  const hasPowerEvidence = record.powerSource !== "unavailable" && (
    record.avgPower > 0 || record.maxPower > 0 || (record.powerHistory?.some((power) => power > 0) ?? false)
  );
  const movingTimeSec = record.movingTime ?? Math.max(0, record.duration - (record.totalPausedSec ?? 0));
  const stats = buildActivityStatistics({
    distanceM: record.distance,
    movingTimeSec,
    pausedTimeSec: record.totalPausedSec ?? 0,
    totalAscentM: record.totalAscent,
    totalDescentM: record.totalDescent ?? 0,
    maxSpeedKmh: record.maxSpeed,
    maxPowerW: record.maxPower,
    powerWorkJ: (record.totalWorkKj ?? 0) * 1000,
    powerSampleDurationSec: hasPowerEvidence ? movingTimeSec : 0,
    caloriesKcal: record.calories,
    powerSource: record.powerSource ?? "unavailable",
    caloriesSource: record.caloriesSource ?? "unavailable",
  });
  const routeName = truncateTitle(record.name?.trim() || t("share.untitledRide"));
  const routeTokens = points ? points.split(" ") : [];
  const firstPoint = routeTokens[0]?.split(",");
  const middlePoint = routeTokens[Math.floor(routeTokens.length / 2)]?.split(",");
  const lastPoint = routeTokens.at(-1)?.split(",");
  const averagePowerAvailable = stats.averagePowerW !== undefined;
  const routeGraphic = points
    ? `<polyline points="${points}" fill="none" stroke="#06251F" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
       <polyline points="${points}" fill="none" stroke="#24E28C" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
       <circle cx="${middlePoint?.[0]}" cy="${middlePoint?.[1]}" r="10" fill="#D7FFE9" stroke="#24E28C" stroke-width="6"/>
       <circle cx="${firstPoint?.[0]}" cy="${firstPoint?.[1]}" r="20" fill="#21D57D" stroke="#F7FFFB" stroke-width="8"/>
       <circle cx="${lastPoint?.[0]}" cy="${lastPoint?.[1]}" r="20" fill="#FF7849" stroke="#FFF7F2" stroke-width="8"/>`
    : `<g><circle cx="540" cy="415" r="64" fill="#14212A" stroke="#2C4352" stroke-width="2"/>
       <path d="M540 372 L564 420 L540 408 L516 420 Z" fill="#6B7F8D"/>
       <text x="540" y="525" fill="#B3C0CB" font-size="28" font-family="${FONT_STACK}" text-anchor="middle">${escapeXml(t("share.noGps"))}</text></g>`;

  const primaryMetrics = [
    metricCell({ x: 180, y: 1234, label: t("share.distance"), value: (stats.distanceM / 1000).toFixed(2), unit: t("share.kilometers"), primary: true }),
    metricCell({ x: 540, y: 1234, label: t("share.movingTime"), value: formatDuration(stats.movingTimeSec), unit: t("share.gpsMoving"), primary: true }),
    metricCell({ x: 900, y: 1234, label: t("share.elevation"), value: `${Math.round(stats.totalAscentM)}`, unit: t("share.meters"), primary: true }),
  ].join("");
  const secondaryMetrics = [
    metricCell({ x: 180, y: 1512, label: t("share.averageSpeed"), value: stats.averageSpeedKmh.toFixed(1), unit: "km/h" }),
    metricCell({ x: 540, y: 1512, label: t("share.averagePower"), value: averagePowerAvailable ? `${Math.round(stats.averagePowerW!)}` : "--", unit: averagePowerAvailable ? t("share.watts") : t("share.unavailable"), unavailable: !averagePowerAvailable }),
    metricCell({ x: 900, y: 1512, label: t("share.calories"), value: Math.round(stats.caloriesKcal).toLocaleString(locale), unit: t("share.kilocalories") }),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="mapSurface" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#112D34"/><stop offset="100%" stop-color="#08141C"/></linearGradient>
    <linearGradient id="panelSurface" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#131E28"/><stop offset="100%" stop-color="#0B121A"/></linearGradient>
    <pattern id="mapGrid" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="#9BD5D1" stroke-opacity="0.12" stroke-width="1"/></pattern>
    <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>
  <rect width="1080" height="1920" fill="#0A1118"/>
  <rect x="0" y="0" width="1080" height="980" fill="url(#mapSurface)"/>
  <rect x="0" y="0" width="1080" height="980" fill="url(#mapGrid)"/>
  <rect x="64" y="54" width="310" height="50" rx="25" fill="#10232A" stroke="#2A4A50" stroke-width="2"/>
  <text x="94" y="87" fill="#BFFFE0" font-size="22" font-weight="800" font-family="${FONT_STACK}" letter-spacing="2">BIKE ASSISTANT</text>
  <text x="1012" y="84" fill="#C2CDD6" font-size="22" font-weight="700" font-family="${FONT_STACK}" text-anchor="end">${escapeXml(sportLabel(record, t))} · ${escapeXml(t("share.gpsRecord"))}</text>
  ${points ? `<polyline points="${points}" fill="none" stroke="#20D984" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" opacity="0.16" filter="url(#routeGlow)"/>` : ""}
  ${routeGraphic}
  <rect x="0" y="906" width="1080" height="1014" rx="48" fill="url(#panelSurface)"/>
  <rect x="64" y="952" width="116" height="38" rx="19" fill="#123C30"/>
  <text x="122" y="978" fill="#63F5AA" font-size="19" font-weight="800" font-family="${FONT_STACK}" text-anchor="middle" letter-spacing="1">${escapeXml(t("share.activitySummary"))}</text>
  <text x="64" y="1066" fill="#F8FBFD" font-size="56" font-weight="800" font-family="${FONT_STACK}">${escapeXml(routeName)}</text>
  <text x="64" y="1112" fill="#93A2B2" font-size="25" font-family="${FONT_STACK}">${formatDate(record.date, locale)}</text>
  <line x1="64" y1="1164" x2="1016" y2="1164" stroke="#DCE8EE" stroke-opacity="0.14" stroke-width="2"/>
  ${primaryMetrics}
  <line x1="360" y1="1210" x2="360" y2="1366" stroke="#DCE8EE" stroke-opacity="0.12" stroke-width="2"/>
  <line x1="720" y1="1210" x2="720" y2="1366" stroke="#DCE8EE" stroke-opacity="0.12" stroke-width="2"/>
  <line x1="64" y1="1412" x2="1016" y2="1412" stroke="#DCE8EE" stroke-opacity="0.14" stroke-width="2"/>
  ${secondaryMetrics}
  <line x1="360" y1="1488" x2="360" y2="1644" stroke="#DCE8EE" stroke-opacity="0.12" stroke-width="2"/>
  <line x1="720" y1="1488" x2="720" y2="1644" stroke="#DCE8EE" stroke-opacity="0.12" stroke-width="2"/>
  <rect x="64" y="1748" width="952" height="96" rx="24" fill="#0E1A22" stroke="#203642" stroke-width="2"/>
  <circle cx="112" cy="1796" r="10" fill="#26E38C"/>
  <text x="140" y="1804" fill="#C9D6DE" font-size="22" font-family="${FONT_STACK}">${escapeXml(t("share.movingTimeMethod"))}</text>
  <text x="540" y="1890" fill="#6D7D8A" font-size="20" font-family="${FONT_STACK}" text-anchor="middle">${escapeXml(t("share.createdOffline"))}</text>
</svg>`;
}

export function createRideShareCardFilename(record: RideRecord): string {
  const safeName = (record.name || "ride").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `bike-ride-${safeName || "ride"}-${record.id}.svg`;
}
