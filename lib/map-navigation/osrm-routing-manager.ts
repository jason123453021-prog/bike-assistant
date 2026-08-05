/**
 * OSRM 路徑規劃管理
 * 
 * 功能：
 * 1. 調用 OSRM API 進行路徑規劃
 * 2. 支援多點路由
 * 3. 提取轉彎指令與距離信息
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  distance: number; // 米
  duration: number; // 秒
  instruction: string; // 轉彎指令
  name: string; // 街道名稱
  bearing_before: number; // 進入方向
  bearing_after: number; // 離開方向
  turn_angle: number; // 轉向角度
}

export interface Route {
  distance: number; // 總距離（米）
  duration: number; // 總時間（秒）
  geometry: Coordinate[]; // 路徑坐標點
  steps: RouteStep[]; // 轉彎步驟
  summary: string; // 路線摘要
}

export interface OSRMConfig {
  baseUrl: string; // OSRM 服務 URL
  profile: 'bike' | 'car' | 'foot'; // 路線類型
  timeout: number; // 請求超時（毫秒）
}

const DEFAULT_CONFIG: OSRMConfig = {
  baseUrl: 'https://router.project-osrm.org',
  profile: 'bike',
  timeout: 10000,
};

/**
 * 驗證坐標有效性
 */
function validateCoordinate(coord: Coordinate): boolean {
  return (
    typeof coord.latitude === 'number' &&
    typeof coord.longitude === 'number' &&
    coord.latitude >= -90 &&
    coord.latitude <= 90 &&
    coord.longitude >= -180 &&
    coord.longitude <= 180
  );
}

/**
 * 構建 OSRM 請求 URL
 */
function buildOSRMUrl(
  coordinates: Coordinate[],
  config: OSRMConfig,
  options: {
    steps?: boolean;
    annotations?: string[];
    overview?: 'full' | 'simplified' | 'false';
  } = {}
): string {
  // 驗證坐標
  for (const coord of coordinates) {
    if (!validateCoordinate(coord)) {
      throw new Error(`Invalid coordinate: ${JSON.stringify(coord)}`);
    }
  }

  // 構建坐標字符串（OSRM 格式：lon,lat;lon,lat）
  const coordString = coordinates
    .map((c) => `${c.longitude},${c.latitude}`)
    .join(';');

  // 構建查詢參數
  const params = new URLSearchParams();
  params.append('steps', options.steps !== false ? 'true' : 'false');
  params.append('annotations', options.annotations?.join(',') || 'distance,duration');
  params.append('overview', options.overview || 'full');
  params.append('geometries', 'geojson');

  return `${config.baseUrl}/route/v1/${config.profile}/${coordString}?${params.toString()}`;
}

/**
 * 解析 OSRM 響應
 */
function parseOSRMResponse(data: any): Route {
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found');
  }

  const route = data.routes[0];
  const geometry = route.geometry.coordinates.map((coord: [number, number]) => ({
    latitude: coord[1],
    longitude: coord[0],
  }));

  const steps: RouteStep[] = [];
  if (route.legs) {
    for (const leg of route.legs) {
      if (leg.steps) {
        for (const step of leg.steps) {
          steps.push({
            distance: step.distance,
            duration: step.duration,
            instruction: step.maneuver?.instruction || 'Continue',
            name: step.name || 'Unknown',
            bearing_before: step.maneuver?.bearing_before || 0,
            bearing_after: step.maneuver?.bearing_after || 0,
            turn_angle: step.maneuver?.modifier ? calculateTurnAngle(step.maneuver) : 0,
          });
        }
      }
    }
  }

  return {
    distance: route.distance,
    duration: route.duration,
    geometry,
    steps,
    summary: `${(route.distance / 1000).toFixed(1)} km, ${Math.round(route.duration / 60)} min`,
  };
}

/**
 * 計算轉向角度
 */
function calculateTurnAngle(maneuver: any): number {
  const modifier = maneuver.modifier || '';
  const angleMap: Record<string, number> = {
    'sharp left': -90,
    left: -45,
    'slight left': -20,
    straight: 0,
    'slight right': 20,
    right: 45,
    'sharp right': 90,
    'u-turn': 180,
  };
  return angleMap[modifier] || 0;
}

/**
 * 調用 OSRM 進行路徑規劃
 */
export async function planRoute(
  startCoord: Coordinate,
  endCoord: Coordinate,
  waypoints: Coordinate[] = [],
  config: Partial<OSRMConfig> = {}
): Promise<Route> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // 構建坐標列表
    const coordinates = [startCoord, ...waypoints, endCoord];

    // 構建 URL
    const url = buildOSRMUrl(coordinates, finalConfig, {
      steps: true,
      annotations: ['distance', 'duration'],
      overview: 'full',
    });

    // 發送請求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok') {
      throw new Error(`OSRM error: ${data.message || 'Unknown error'}`);
    }

    return parseOSRMResponse(data);
  } catch (error) {
    console.error('[OSRM] Route planning failed:', error);
    throw error;
  }
}

/**
 * 獲取轉彎提示文本
 */
export function getTurnInstruction(step: RouteStep): string {
  const distance = step.distance;
  const distanceStr =
    distance < 100
      ? `${Math.round(distance)} m`
      : `${(distance / 1000).toFixed(1)} km`;

  return `${step.instruction} on ${step.name} (${distanceStr})`;
}

/**
 * 計算下一個轉彎點
 */
export function getNextTurnPoint(
  currentLocation: Coordinate,
  steps: RouteStep[],
  geometry: Coordinate[]
): { step: RouteStep; distance: number } | null {
  if (steps.length === 0) {
    return null;
  }

  // 簡化版：返回第一個轉彎點
  // 實際應用中應計算當前位置到各轉彎點的距離
  const nextStep = steps[0];
  const distance = nextStep.distance;

  return { step: nextStep, distance };
}

/**
 * 檢查是否偏離路線
 */
export function isOffRoute(
  currentLocation: Coordinate,
  routeGeometry: Coordinate[],
  toleranceMeters: number = 50
): boolean {
  if (routeGeometry.length < 2) {
    return false;
  }

  // 簡化版：計算到最近路線點的距離
  let minDistance = Infinity;

  for (const point of routeGeometry) {
    const distance = calculateDistance(currentLocation, point);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance > toleranceMeters;
}

/**
 * 計算兩點間距離（單位：米）
 */
function calculateDistance(point1: Coordinate, point2: Coordinate): number {
  const R = 6371000; // 地球半徑（米）
  const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.latitude * Math.PI) / 180) *
      Math.cos((point2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 計算路線統計信息
 */
export function calculateRouteStats(route: Route): {
  totalDistance: number; // km
  totalDuration: number; // 分鐘
  averageSpeed: number; // km/h
  turnCount: number;
} {
  return {
    totalDistance: route.distance / 1000,
    totalDuration: Math.round(route.duration / 60),
    averageSpeed: (route.distance / 1000) / (route.duration / 3600),
    turnCount: route.steps.length,
  };
}
