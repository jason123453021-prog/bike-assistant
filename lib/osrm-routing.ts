/**
 * OSRM (Open Source Routing Machine) 路由規劃 API 集成
 * 
 * 功能：
 * - 路由規劃（自行車、汽車模式）
 * - 多路線選項
 * - 路線優化
 * - 距離和時間計算
 */

const OSRM_BASE_URL = 'https://router.project-osrm.org';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  distance: number; // 公尺
  duration: number; // 秒
  name: string;
  instruction: string;
  maneuver?: string;
}

export interface Route {
  distance: number; // 公尺
  duration: number; // 秒
  coordinates: RouteCoordinate[];
  steps: RouteStep[];
  elevation?: number; // 總爬升（公尺）
  summary?: string;
}

export interface RoutingOptions {
  mode: 'bike' | 'car'; // 路線模式
  alternatives?: boolean; // 是否返回多條路線
  steps?: boolean; // 是否返回詳細步驟
  geometries?: 'geojson' | 'polyline' | 'polyline6'; // 坐標格式
}

/**
 * 規劃路由
 */
export async function planRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  options: RoutingOptions = { mode: 'bike', alternatives: true, steps: true }
): Promise<Route[]> {
  try {
    // 根據模式選擇配置檔案
    const profile = options.mode === 'bike' ? 'bike' : 'car';

    // 構建 URL
    const url = new URL(
      `${OSRM_BASE_URL}/route/v1/${profile}/${startLon},${startLat};${endLon},${endLat}`
    );

    // 添加參數
    url.searchParams.append('overview', 'full');
    url.searchParams.append('steps', options.steps ? 'true' : 'false');
    url.searchParams.append('alternatives', options.alternatives ? 'true' : 'false');
    url.searchParams.append('geometries', options.geometries || 'geojson');
    url.searchParams.append('annotations', 'distance,duration,speed');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok') {
      throw new Error(`OSRM error: ${data.code}`);
    }

    // 轉換響應格式
    return data.routes.map((route: any) => ({
      distance: route.distance,
      duration: route.duration,
      coordinates: convertCoordinates(route.geometry),
      steps: route.legs?.[0]?.steps?.map((step: any) => ({
        distance: step.distance,
        duration: step.duration,
        name: step.name || '',
        instruction: step.maneuver?.instruction || '',
        maneuver: step.maneuver?.type,
      })) || [],
      elevation: calculateElevation(route.geometry),
      summary: route.summary,
    }));
  } catch (error) {
    console.error('Route planning error:', error);
    throw error;
  }
}

/**
 * 轉換坐標格式
 */
function convertCoordinates(geometry: any): RouteCoordinate[] {
  if (!geometry) {
    return [];
  }

  if (geometry.type === 'LineString') {
    return geometry.coordinates.map((coord: [number, number]) => ({
      latitude: coord[1],
      longitude: coord[0],
    }));
  }

  return [];
}

/**
 * 計算總爬升（模擬）
 */
function calculateElevation(geometry: any): number {
  // 實際應用中應使用真實的高程數據
  // 這裡使用模擬值
  return Math.floor(Math.random() * 200) + 50;
}

/**
 * 獲取多條路線
 */
export async function getAlternativeRoutes(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  mode: 'bike' | 'car' = 'bike'
): Promise<Route[]> {
  return planRoute(startLat, startLon, endLat, endLon, {
    mode,
    alternatives: true,
    steps: true,
  });
}

/**
 * 計算路線統計信息
 */
export function calculateRouteStats(route: Route) {
  return {
    distance: (route.distance / 1000).toFixed(1), // 轉換為公里
    duration: formatDuration(route.duration),
    averageSpeed: (
      (route.distance / 1000) /
      (route.duration / 3600)
    ).toFixed(1), // km/h
    elevation: route.elevation || 0,
  };
}

/**
 * 格式化時間
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * 獲取路線上的轉彎指令
 */
export function getManeuvers(route: Route): Array<{
  distance: number;
  instruction: string;
  type: string;
}> {
  return route.steps
    .filter((step) => step.maneuver)
    .map((step) => ({
      distance: step.distance,
      instruction: step.instruction,
      type: step.maneuver || '',
    }));
}

/**
 * 優化多點路由
 */
export async function optimizeRoute(
  coordinates: RouteCoordinate[]
): Promise<number[]> {
  try {
    if (coordinates.length < 2) {
      return Array.from({ length: coordinates.length }, (_, i) => i);
    }

    // 構建 URL
    const coordString = coordinates
      .map((c) => `${c.longitude},${c.latitude}`)
      .join(';');

    const url = new URL(`${OSRM_BASE_URL}/trip/v1/bike/${coordString}`);
    url.searchParams.append('steps', 'false');
    url.searchParams.append('geometries', 'geojson');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok') {
      throw new Error(`OSRM error: ${data.code}`);
    }

    // 返回優化後的順序
    return data.waypoints.map((wp: any) => wp.waypoint_index);
  } catch (error) {
    console.error('Route optimization error:', error);
    throw error;
  }
}
