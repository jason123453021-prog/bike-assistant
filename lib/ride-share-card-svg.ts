import type { RideRecord } from "./ride-context";
import { buildActivityStatistics } from "./activity-statistics";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remain = total % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}` : `${minutes}:${String(remain).padStart(2, "0")}`;
}

function routePoints(record: RideRecord): string {
  if (record.route.length < 2) return "";
  const lats = record.route.map((point) => point.latitude);
  const lons = record.route.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lonRange = Math.max(maxLon - minLon, 0.0001);
  return record.route.map((point) => {
    const x = 92 + ((point.longitude - minLon) / lonRange) * 896;
    const y = 90 + (1 - (point.latitude - minLat) / latRange) * 560;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function metric(x: number, y: number, label: string, value: string, unit: string): string {
  return `<text x="${x}" y="${y}" fill="#A4ADB9" font-size="28" font-family="sans-serif" text-anchor="middle">${escapeXml(label)}</text>
    <text x="${x}" y="${y + 58}" fill="#FFFFFF" font-size="49" font-weight="700" font-family="sans-serif" text-anchor="middle">${escapeXml(value)}</text>
    <text x="${x}" y="${y + 90}" fill="#A4ADB9" font-size="22" font-family="sans-serif" text-anchor="middle">${escapeXml(unit)}</text>`;
}

export function createRideShareCardSvg(record: RideRecord): string {
  const hasPhotos = record.mediaItems && record.mediaItems.length > 0;
  const photoUri = hasPhotos ? record.mediaItems![0] : "";
  const hasPreviewPhoto = hasPhotos && !/\.(mp4|mov|m4v|webm)(\?|$)/i.test(photoUri);
  const points = routePoints(record);
  const hasPowerEvidence = record.powerSource !== "unavailable" && (record.avgPower > 0 || record.maxPower > 0 || (record.powerHistory?.some((power) => power > 0) ?? false));
  const stats = buildActivityStatistics({
    distanceM: record.distance,
    movingTimeSec: record.movingTime ?? Math.max(0, record.duration - (record.totalPausedSec ?? 0)),
    pausedTimeSec: record.totalPausedSec ?? 0,
    totalAscentM: record.totalAscent,
    totalDescentM: record.totalDescent ?? 0,
    maxSpeedKmh: record.maxSpeed,
    maxPowerW: record.maxPower,
    powerWorkJ: (record.totalWorkKj ?? 0) * 1000,
    powerSampleDurationSec: hasPowerEvidence ? (record.movingTime ?? Math.max(0, record.duration - (record.totalPausedSec ?? 0))) : 0,
    caloriesKcal: record.calories,
    powerSource: record.powerSource ?? "unavailable",
    caloriesSource: record.caloriesSource ?? "unavailable",
  });
  const movingTime = stats.movingTimeSec;
  const movingSpeed = stats.averageSpeedKmh;
  const bests = record.personalBests?.map((best) => best.label).join("、") ?? "";
  const routeName = escapeXml(record.name || "未命名騎乘");
  const splitPoints = points.split(" ");
  const firstPoint = splitPoints[0]?.split(",");
  const lastPoint = splitPoints.at(-1)?.split(",");
  const routeGraphic = points
    ? `<polyline points="${points}" fill="none" stroke="#FF6A22" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
       <circle cx="${firstPoint?.[0]}" cy="${firstPoint?.[1]}" r="18" fill="#21E58B" stroke="#FFFFFF" stroke-width="7"/>
       <circle cx="${lastPoint?.[0]}" cy="${lastPoint?.[1]}" r="18" fill="#FF5B5B" stroke="#FFFFFF" stroke-width="7"/>`
    : `<text x="540" y="380" fill="#A4ADB9" font-size="30" font-family="sans-serif" text-anchor="middle">此記錄沒有可繪製的 GPS 軌跡</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs><linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#102F32"/><stop offset="100%" stop-color="#07151A"/></linearGradient><pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M 64 0 L 0 0 0 64" fill="none" stroke="#6B8790" stroke-opacity="0.17" stroke-width="1"/></pattern><clipPath id="mediaClip"><rect x="88" y="886" width="238" height="168" rx="14"/></clipPath></defs>
  <rect width="1080" height="1920" fill="#101114"/><rect width="1080" height="700" fill="url(#hero)"/><rect width="1080" height="700" fill="url(#grid)"/>
  <text x="72" y="78" fill="#D9FFEC" font-size="26" font-weight="700" font-family="sans-serif">單車助手 · 騎乘動態</text>${routeGraphic}
  <rect x="0" y="650" width="1080" height="1270" rx="42" fill="#101114"/>
  <text x="70" y="724" fill="#00E676" font-size="24" font-weight="700" font-family="sans-serif">活動摘要</text><text x="70" y="792" fill="#FFFFFF" font-size="50" font-weight="800" font-family="sans-serif">${routeName}</text><text x="70" y="836" fill="#A4ADB9" font-size="24" font-family="sans-serif">${formatDate(record.date)}</text>
  ${hasPhotos ? `<rect x="70" y="865" width="940" height="210" rx="20" fill="#1E222A"/>${hasPreviewPhoto ? `<image href="${escapeXml(photoUri)}" x="88" y="886" width="238" height="168" preserveAspectRatio="xMidYMid slice" clip-path="url(#mediaClip)"/>` : `<rect x="88" y="886" width="238" height="168" rx="14" fill="#123126"/><text x="207" y="965" fill="#9CFFB5" font-size="40" font-family="sans-serif" text-anchor="middle">▶</text><text x="207" y="1007" fill="#D9FFEC" font-size="18" font-family="sans-serif" text-anchor="middle">活動影片</text>`}<text x="360" y="915" fill="#00E676" font-size="20" font-weight="700" font-family="sans-serif">活動媒體</text><text x="360" y="960" fill="#FFFFFF" font-size="28" font-weight="700" font-family="sans-serif">${hasPreviewPhoto ? "首張活動照片" : "已附加本機影片"}</text><text x="360" y="1002" fill="#A4ADB9" font-size="21" font-family="sans-serif">共 ${record.mediaItems!.length} 項本機媒體</text>` : ""}
  ${metric(260, hasPhotos ? 1140 : 960, "距離", (stats.distanceM / 1000).toFixed(2), "公里")}${metric(820, hasPhotos ? 1140 : 960, "爬升海拔", `${Math.round(stats.totalAscentM)}`, "公尺")}${metric(260, hasPhotos ? 1320 : 1140, "移動時間", formatDuration(movingTime), "")}${metric(820, hasPhotos ? 1320 : 1140, "平均功率", stats.averagePowerW === undefined ? "--" : `${Math.round(stats.averagePowerW)}`, stats.averagePowerW === undefined ? "資料不足" : "瓦")}${metric(260, hasPhotos ? 1500 : 1320, "平均速度", movingSpeed.toFixed(1), "公里／小時")}${metric(820, hasPhotos ? 1500 : 1320, "卡路里", `${Math.round(stats.caloriesKcal)}`, "卡")}
  <line x1="540" y1="${hasPhotos ? 1100 : 920}" x2="540" y2="${hasPhotos ? 1550 : 1370}" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/><line x1="120" y1="${hasPhotos ? 1230 : 1050}" x2="960" y2="${hasPhotos ? 1230 : 1050}" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/><line x1="120" y1="${hasPhotos ? 1410 : 1230}" x2="960" y2="${hasPhotos ? 1410 : 1230}" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/>
  <text x="540" y="1815" fill="#6E7783" font-size="22" font-family="sans-serif" text-anchor="middle">由單車助手在此裝置離線產生</text>
</svg>`;
}

export function createRideShareCardFilename(record: RideRecord): string {
  const safeName = (record.name || "ride").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `bike-ride-${safeName || "ride"}-${record.id}.svg`;
}
