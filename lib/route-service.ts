/**
 * route-service.ts
 *
 * 封裝 OSRM（Open Source Routing Machine）公開 API，
 * 提供自行車路由計算功能。
 *
 * OSRM 公開端點：https://router.project-osrm.org
 * 使用 cycling profile（自行車）計算可騎路徑。
 *
 * 注意：公開端點有流量限制，僅供開發/示範用途。
 * 生產環境建議自行部署 OSRM 或使用 Valhalla。
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

// OSRM 公開端點基礎 URL
const OSRM_HOST = "https://router.project-osrm.org/route/v1";

/**
 * 將 OSRM 轉彎指令轉換為中文
 */
function translateModifier(modifier: string): string {
  const map: Record<string, string> = {
    "left": "左轉",
    "right": "右轉",
    "slight left": "稍向左",
    "slight right": "稍向右",
    "sharp left": "鎖左轉",
    "sharp right": "鎖右轉",
    "straight": "直行",
    "uturn": "辭回",
    "u-turn": "辭回",
  };
  return map[modifier?.toLowerCase()] ?? modifier ?? "";
}

function translateType(type: string): string {
  const map: Record<string, string> = {
    "turn": "轉彎",
    "new name": "進入",
    "depart": "出發",
    "arrive": "到達目的地",
    "merge": "彙入",
    "on ramp": "上匹道",
    "off ramp": "下匹道",
    "fork": "分岔",
    "end of road": "路尾",
    "roundabout": "圓環",
    "rotary": "圓環",
    "continue": "繼續前進",
    "use lane": "使用車道",
  };
  return map[type?.toLowerCase()] ?? type ?? "";
}

/**
 * 解析 OSRM steps 為中文轉彎指令陣列
 */
function parseSteps(steps: any[]): TurnStep[] {
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

// 請求逾時（ms）
const FETCH_TIMEOUT_MS = 8000;

/**
 * 解碼 Polyline6 編碼字串為座標陣列
 * OSRM 使用 Polyline6（精度 1e-6）
 */
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

    coords.push({
      latitude: lat / 1e6,
      longitude: lng / 1e6,
    });
  }

  return coords;
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
 * 計算從起點到終點的自行車路由
 *
 * @param from            起點座標（當前位置）
 * @param to              終點座標（最近路線點）
 * @param preferCycleway  是否優先自行車道（預設 true）
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

  try {
    // preferCycleway=true 使用 cycling profile（對自行車道有更高權重）
    // preferCycleway=false 使用 foot profile（一般道路）
    const profile = preferCycleway ? "cycling" : "foot";
    const url =
      `${OSRM_HOST}/${profile}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?overview=full&geometries=polyline6&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
    // 解析所有 leg 的 steps
    const allSteps: any[] = [];
    for (const leg of route.legs ?? []) {
      if (leg.steps) allSteps.push(...leg.steps);
    }
    const steps = parseSteps(allSteps);

    return {
      coordinates,
      distanceM: Math.round(route.distance),
      durationSec: Math.round(route.duration),
      steps,
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.warn("[RouteService] OSRM request timed out");
    } else {
      console.warn("[RouteService] OSRM fetch error:", err);
    }
    return null;
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
