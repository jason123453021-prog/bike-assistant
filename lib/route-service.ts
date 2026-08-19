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
 * 2. OSM Bike Router（一般道路自行車模式）
 *    - 端點：https://routing.openstreetmap.de/routed-bike
 *    - 使用 OSM 的自行車設定檔，遵守自行車可通行性、單行與轉向限制
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

// ── OSM 專用自行車路由設定 ──────────────────────────────────────
// routed-bike 的 URL profile 名稱固定為 driving；伺服器實際載入的是自行車設定檔。
const OSM_BIKE_ROUTE_HOST = "https://routing.openstreetmap.de/routed-bike/route/v1/driving";

// 請求逾時（ms）
const FETCH_TIMEOUT_MS = 10000;
// 端點被吸附到道路時可接受的最遠距離；超出即視為目標落在不可通行區域。
const MAX_ENDPOINT_SNAP_DISTANCE_M = 120;
/** 自行車道路線距離多出此比例以上時，視為不合理繞路。 */
export const CYCLEWAY_MAX_DETOUR_RATIO = 1.3;
/** 僅因極小時間差不放棄自行車道；超過此比例才視為明顯較慢。 */
export const CYCLEWAY_MAX_DURATION_RATIO = 1.2;

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

/**
 * 確認路由引擎將起訖點吸附到合理距離內的可通行道路。
 * 避免端點落在河川、封閉區、匝道或無法進出的路段時繪製誤導性的直連線。
 */
export function hasUsableRouteEndpoints(
  coordinates: RouteCoordinate[],
  from: RouteCoordinate,
  to: RouteCoordinate,
  maxSnapDistanceM: number = MAX_ENDPOINT_SNAP_DISTANCE_M,
): boolean {
  if (coordinates.length < 2) return false;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return (
    haversine(from.latitude, from.longitude, first.latitude, first.longitude) <= maxSnapDistanceM &&
    haversine(to.latitude, to.longitude, last.latitude, last.longitude) <= maxSnapDistanceM
  );
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

    if (!hasUsableRouteEndpoints(coordinates, from, to)) {
      console.warn("[RouteService] Brouter endpoint snap is too far from a routable road");
      return null;
    }

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
 * 使用 OSM 專用自行車路由服務計算一般道路路由。
 * 請求禁止使用本機／代理快取，讓新規劃優先採用服務端最新 OSM 道路資料。
 */
async function fetchOsrmRoute(
  from: RouteCoordinate,
  to: RouteCoordinate
): Promise<RouteResult | null> {
  const url =
    `${OSM_BIKE_ROUTE_HOST}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=polyline6&steps=true&alternatives=false&continue_straight=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
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
    if (!hasUsableRouteEndpoints(coordinates, from, to)) {
      console.warn("[RouteService] OSM bike endpoint snap is too far from a routable road");
      return null;
    }
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

  if (!preferCycleway) return fetchOsrmRoute(from, to);

  // 同時計算兩條可通行候選，避免先等待 Brouter 完成後才發現其路線過度繞行。
  // 選中 Brouter 時，之後若下一段自行車道仍有利，重新規劃會自然回到自行車道優先。
  const [cyclewayRoute, roadRoute] = await Promise.all([
    fetchBrouterRoute(from, to),
    fetchOsrmRoute(from, to),
  ]);
  return selectBikeRouteCandidate(cyclewayRoute, roadRoute);
}

/**
 * 自行車道優先的候選選擇規則。
 * 只有 Brouter 距離超過一般道路 30%，或同時明顯更遠且時間多出 20%，才改走一般道路。
 * 這可維持自行車道偏好，又不會在繞行／迂迴路網中產生不合常理的導航。
 */
export function selectBikeRouteCandidate(
  cyclewayRoute: RouteResult | null,
  roadRoute: RouteResult | null,
): RouteResult | null {
  if (!cyclewayRoute) return roadRoute;
  if (!roadRoute) return cyclewayRoute;

  const distanceRatio = cyclewayRoute.distanceM / Math.max(1, roadRoute.distanceM);
  const durationRatio = cyclewayRoute.durationSec > 0 && roadRoute.durationSec > 0
    ? cyclewayRoute.durationSec / roadRoute.durationSec
    : 1;
  const isMaterialDetour = distanceRatio > CYCLEWAY_MAX_DETOUR_RATIO;
  const isSlowerAndLonger = distanceRatio > 1.1 && durationRatio > CYCLEWAY_MAX_DURATION_RATIO;

  if (isMaterialDetour || isSlowerAndLonger) {
    return roadRoute;
  }
  return cyclewayRoute;
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
