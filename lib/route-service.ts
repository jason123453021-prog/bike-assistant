/**
 * route-service.ts
 *
 * 提供自行車路由計算功能，支援兩種路由引擎：
 *
 * 1. Brouter（自行車道優先模式）
 *    - 端點：https://brouter.de/brouter
 *    - Profile：trekking（對 highway=cycleway 有最高路權）
 *    - 回傳格式：GeoJSON FeatureCollection
 *
 * 2. OSRM（一般道路模式）
 *    - 端點：https://router.project-osrm.org
 *    - Profile：cycling（一般自行車路由）
 *    - 回傳格式：OSRM JSON + polyline6 幾何
 *
 * 注意：兩個公開端點均有流量限制，僅供開發/示範用途。
 */

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface TurnStep {
  /** 轉彎指令（中文） */
  instruction: string;
  /** 距下一個轉彎點的距離（公尺） */
  distanceM: number;
  /** 轉彎點座標 */
  location: RouteCoordinate;
}

export interface RouteResult {
  /** 路徑座標點陣列（沿道路） */
  coordinates: RouteCoordinate[];
  /** 路徑總距離（公尺） */
  distanceM: number;
  /** 預估騎乘時間（秒） */
  durationSec: number;
  /** 轉彎指令陣列 */
  steps: TurnStep[];
}

// ── Brouter 設定 ──────────────────────────────────────────────
const BROUTER_HOST = "https://brouter.de/brouter";
// trekking profile：對自行車道（highway=cycleway）有最高路權，
// 同時也接受 highway=footway bicycle=yes，適合台灣自行車道環境
const BROUTER_CYCLEWAY_PROFILE = "trekking";

// ── OSRM 設定 ─────────────────────────────────────────────────
const OSRM_HOST = "https://router.project-osrm.org/route/v1";

// 請求逾時（ms）
const FETCH_TIMEOUT_MS = 10000;

// ── OSRM 輔助函數 ─────────────────────────────────────────────

function translateModifier(modifier: string): string {
  const map: Record<string, string> = {
    "left": "左轉",
    "right": "右轉",
    "slight left": "稍向左",
    "slight right": "稍向右",
    "sharp left": "銳角左轉",
    "sharp right": "銳角右轉",
    "straight": "直行",
    "uturn": "迴轉",
    "u-turn": "迴轉",
  };
  return map[modifier?.toLowerCase()] ?? modifier ?? "";
}

function translateType(type: string): string {
  const map: Record<string, string> = {
    "turn": "轉彎",
    "new name": "進入",
    "depart": "出發",
    "arrive": "到達目的地",
    "merge": "匯入",
    "on ramp": "上匝道",
    "off ramp": "下匝道",
    "fork": "分岔",
    "end of road": "路尾",
    "roundabout": "圓環",
    "rotary": "圓環",
    "continue": "繼續前進",
    "use lane": "使用車道",
  };
  return map[type?.toLowerCase()] ?? type ?? "";
}

function parseOsrmSteps(steps: any[]): TurnStep[] {
  if (!steps || !Array.isArray(steps)) return [];
  return steps
    .filter((s: any) => s.maneuver)
    .map((s: any) => {
      const type = s.maneuver?.type ?? "";
      const modifier = s.maneuver?.modifier ?? "";
      const loc = s.maneuver?.location ?? [0, 0];
      let instruction = "";
      if (type === "depart") {
        instruction = "出發，進入路線";
      } else if (type === "arrive") {
        instruction = "到達目的地";
      } else {
        const typeStr = translateType(type);
        const modStr = translateModifier(modifier);
        instruction = modStr ? `${modStr}${typeStr !== "轉彎" ? "，" + typeStr : ""}` : typeStr;
      }
      return {
        instruction: instruction || "繼續前進",
        distanceM: Math.round(s.distance ?? 0),
        location: { latitude: loc[1], longitude: loc[0] },
      };
    });
}

function decodePolyline6(encoded: string): RouteCoordinate[] {
  const coords: RouteCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coords.push({ latitude: lat / 1e6, longitude: lng / 1e6 });
  }

  return coords;
}

// ── Brouter 輔助函數 ──────────────────────────────────────────

/**
 * 解析 Brouter messages 陣列為轉彎指令
 * Brouter messages 格式：[header_row, ...data_rows]
 * 每個 data_row：[Longitude, Latitude, Elevation, Distance, CostPerKm, ElevCost, TurnCost, NodeCost, InitialCost, WayTags, NodeTags, Time, Energy]
 */
function parseBrouterMessages(messages: string[][]): TurnStep[] {
  if (!messages || messages.length < 2) return [];
  const steps: TurnStep[] = [];
  // 跳過第一行（header），從第二行開始
  for (let i = 1; i < messages.length; i++) {
    const row = messages[i];
    if (!row || row.length < 11) continue;
    const lon = parseInt(row[0], 10) / 1e7;
    const lat = parseInt(row[1], 10) / 1e7;
    const distM = parseInt(row[3], 10);
    const turnCost = parseInt(row[6], 10);
    const wayTags = row[9] ?? "";
    const nodeTags = row[10] ?? "";

    // 只在有轉彎成本或有路口標籤時才產生指令
    if (turnCost > 0 || nodeTags.includes("crossing") || nodeTags.includes("junction")) {
      let instruction = "繼續前進";
      if (nodeTags.includes("crossing=traffic_signals")) {
        instruction = "注意號誌路口";
      } else if (nodeTags.includes("crossing")) {
        instruction = "注意路口";
      } else if (wayTags.includes("highway=cycleway")) {
        instruction = "進入自行車道";
      } else if (wayTags.includes("highway=footway")) {
        instruction = "進入人行自行車道";
      }
      steps.push({
        instruction,
        distanceM: distM,
        location: { latitude: lat, longitude: lon },
      });
    }
  }
  return steps;
}

/**
 * 計算兩點間的 Haversine 距離（公尺）
 */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 主要路由函數 ──────────────────────────────────────────────

/**
 * 使用 Brouter trekking profile 計算自行車道優先路由
 */
async function fetchBrouterRoute(
  from: RouteCoordinate,
  to: RouteCoordinate
): Promise<RouteResult | null> {
  const url =
    `${BROUTER_HOST}?lonlats=${from.longitude},${from.latitude}|${to.longitude},${to.latitude}` +
    `&profile=${BROUTER_CYCLEWAY_PROFILE}&alternativeidx=0&format=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("[RouteService] Brouter HTTP error:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      console.warn("[RouteService] Brouter no route found");
      return null;
    }

    const feature = data.features[0];
    const props = feature.properties ?? {};
    const geomCoords: number[][] = feature.geometry?.coordinates ?? [];

    // Brouter GeoJSON 座標格式：[lon, lat, ele]
    const coordinates: RouteCoordinate[] = geomCoords.map((c: number[]) => ({
      latitude: c[1],
      longitude: c[0],
    }));

    const distanceM = parseInt(props["track-length"] ?? "0", 10);
    const durationSec = parseInt(props["total-time"] ?? "0", 10);
    const messages: string[][] = props["messages"] ?? [];
    const steps = parseBrouterMessages(messages);

    return { coordinates, distanceM, durationSec, steps };
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === "AbortError") {
      console.warn("[RouteService] Brouter request timed out");
    } else {
      console.warn("[RouteService] Brouter fetch error:", err);
    }
    return null;
  }
}

/**
 * 使用 OSRM cycling profile 計算一般道路路由
 */
async function fetchOsrmRoute(
  from: RouteCoordinate,
  to: RouteCoordinate
): Promise<RouteResult | null> {
  const url =
    `${OSRM_HOST}/cycling/${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=polyline6&steps=true`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("[RouteService] OSRM HTTP error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      console.warn("[RouteService] OSRM no route found:", data.code);
      return null;
    }

    const route = data.routes[0];
    const coordinates = decodePolyline6(route.geometry);
    const allSteps: any[] = [];
    for (const leg of route.legs ?? []) {
      if (leg.steps) allSteps.push(...leg.steps);
    }
    const steps = parseOsrmSteps(allSteps);

    return {
      coordinates,
      distanceM: Math.round(route.distance),
      durationSec: Math.round(route.duration),
      steps,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === "AbortError") {
      console.warn("[RouteService] OSRM request timed out");
    } else {
      console.warn("[RouteService] OSRM fetch error:", err);
    }
    return null;
  }
}

/**
 * 計算從起點到終點的自行車路由
 *
 * @param from            起點座標（當前位置）
 * @param to              終點座標（最近路線點）
 * @param preferCycleway  true = 使用 Brouter（自行車道優先），false = 使用 OSRM（一般道路）
 * @returns               路由結果，失敗時返回 null
 */
export async function fetchBikeRoute(
  from: RouteCoordinate,
  to: RouteCoordinate,
  preferCycleway: boolean = true
): Promise<RouteResult | null> {
  // 兩點距離太近（< 20m）不需要路由
  const directDist = haversine(from.latitude, from.longitude, to.latitude, to.longitude);
  if (directDist < 20) {
    return {
      coordinates: [from, to],
      distanceM: Math.round(directDist),
      durationSec: Math.round(directDist / 4),
      steps: [],
    };
  }

  if (preferCycleway) {
    // 自行車道優先：使用 Brouter trekking profile
    // 失敗時自動降級至 OSRM
    const brouterResult = await fetchBrouterRoute(from, to);
    if (brouterResult) return brouterResult;
    console.warn("[RouteService] Brouter failed, falling back to OSRM");
    return fetchOsrmRoute(from, to);
  } else {
    // 一般道路：使用 OSRM cycling profile
    return fetchOsrmRoute(from, to);
  }
}

/**
 * 格式化路由距離為可讀字串
 */
export function formatRouteDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

/**
 * 格式化路由時間為可讀字串
 */
export function formatRouteDuration(durationSec: number): string {
  const min = Math.ceil(durationSec / 60);
  if (min < 60) return `約 ${min} 分鐘`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `約 ${h} 小時 ${m} 分鐘` : `約 ${h} 小時`;
}
