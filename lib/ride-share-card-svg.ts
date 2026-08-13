import type { RideRecord } from "@/lib/ride-context";

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
  const points = routePoints(record);
  const movingTime = Math.max(0, record.duration - (record.totalPausedSec ?? 0));
  const movingSpeed = movingTime > 0 ? (record.distance / 1000) / (movingTime / 3600) : 0;
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
  <defs><linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#102F32"/><stop offset="100%" stop-color="#07151A"/></linearGradient><pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M 64 0 L 0 0 0 64" fill="none" stroke="#6B8790" stroke-opacity="0.17" stroke-width="1"/></pattern></defs>
  <rect width="1080" height="1920" fill="#101114"/><rect width="1080" height="700" fill="url(#hero)"/><rect width="1080" height="700" fill="url(#grid)"/>
  <text x="72" y="78" fill="#D9FFEC" font-size="26" font-weight="700" font-family="sans-serif">單車助手 · 本機騎乘</text>${routeGraphic}
  <rect x="0" y="650" width="1080" height="1270" rx="42" fill="#101114"/>
  <text x="70" y="744" fill="#00E676" font-size="24" font-weight="700" font-family="sans-serif">騎乘摘要</text><text x="70" y="812" fill="#FFFFFF" font-size="54" font-weight="800" font-family="sans-serif">${routeName}</text><text x="70" y="858" fill="#A4ADB9" font-size="25" font-family="sans-serif">${formatDate(record.date)}</text>
  ${bests ? `<rect x="70" y="894" width="940" height="78" rx="18" fill="#3A2B12"/><text x="105" y="944" fill="#FFD166" font-size="25" font-weight="700" font-family="sans-serif">本機個人紀錄 · ${escapeXml(bests)}</text>` : ""}
  ${metric(260, 1050, "距離", (record.distance / 1000).toFixed(2), "公里")}${metric(820, 1050, "爬升海拔", `${Math.round(record.totalAscent)}`, "公尺")}${metric(260, 1230, "移動時間", formatDuration(movingTime), "")}${metric(820, 1230, "平均功率", `${Math.round(record.avgPower)}`, "瓦")}${metric(260, 1410, "平均速度", movingSpeed.toFixed(1), "公里／小時")}${metric(820, 1410, "卡路里", `${Math.round(record.calories)}`, "卡")}
  <line x1="540" y1="1015" x2="540" y2="1460" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/><line x1="120" y1="1140" x2="960" y2="1140" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/><line x1="120" y1="1320" x2="960" y2="1320" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/>
  <text x="540" y="1815" fill="#6E7783" font-size="22" font-family="sans-serif" text-anchor="middle">由單車助手在此裝置離線產生</text>
</svg>`;
}

export function createRideShareCardFilename(record: RideRecord): string {
  const safeName = (record.name || "ride").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `bike-ride-${safeName || "ride"}-${record.id}.svg`;
}
