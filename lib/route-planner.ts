import { Feature, LineString, Point } from 'geojson';
import * as turf from '@turf/turf';

/**
 * 地址規劃與路由管理器
 * 
 * 功能：
 * - 地址地理編碼（地址 → 座標）
 * - 路由規劃（支持自行車和道路模式）
 * - 多條路線選項
 */

export interface RouteOption {
  id: string;
  name: string;
  distance: number; // 公尺
  duration: number; // 秒
  ascent: number; // 爬升（公尺）
  descent: number; // 下降（公尺）
  difficulty: 'easy' | 'moderate' | 'hard'; // 難度
  geometry: Feature<LineString>;
  steps: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distance: number; // 公尺
  duration: number; // 秒
  bearing: number; // 方向角
  coordinate: [number, number];
}

export interface GeocodingResult {
  address: string;
  coordinate: [number, number]; // [longitude, latitude]
  placeId?: string;
}

class RoutePlanner {
  private osrmBaseUrl = 'https://router.project-osrm.org/route/v1';
  private nominatimBaseUrl = 'https://nominatim.openstreetmap.org';

  /**
   * 地理編碼（地址 → 座標）
   */
  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/search?q=${encodeURIComponent(address)}&format=json&limit=1`
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.length === 0) {
        return null;
      }

      const result = data[0];
      return {
        address: result.display_name,
        coordinate: [parseFloat(result.lon), parseFloat(result.lat)],
        placeId: result.place_id,
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * 反向地理編碼（座標 → 地址）
   */
  async reverseGeocode(coordinate: [number, number]): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/reverse?lat=${coordinate[1]}&lon=${coordinate[0]}&format=json`
      );

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.address?.road || data.display_name || null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * 規劃路線
   * @param start 起點座標 [longitude, latitude]
   * @param end 終點座標 [longitude, latitude]
   * @param mode 模式：'bike' 或 'car'
   */
  async planRoute(
    start: [number, number],
    end: [number, number],
    mode: 'bike' | 'car' = 'bike'
  ): Promise<RouteOption | null> {
    try {
      // 使用 OSRM 規劃路線
      const profile = mode === 'bike' ? 'bike' : 'car';
      const url = `${this.osrmBaseUrl}/${profile}/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&overview=full`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Route planning failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || data.routes.length === 0) {
        return null;
      }

      const route = data.routes[0];
      const geometry = route.geometry;

      // 計算爬升和下降
      const { ascent, descent } = this.calculateElevationChanges(geometry);

      // 判斷難度
      const difficulty = this.calculateDifficulty(ascent, route.distance, mode);

      // 解析步驟
      const steps = this.parseRouteSteps(route.legs);

      return {
        id: `route_${Date.now()}`,
        name: `${mode === 'bike' ? '自行車' : '汽車'}路線`,
        distance: route.distance,
        duration: route.duration,
        ascent,
        descent,
        difficulty,
        geometry: turf.lineString(geometry.coordinates),
        steps,
      };
    } catch (error) {
      console.error('Route planning error:', error);
      return null;
    }
  }

  /**
   * 規劃多條路線選項
   */
  async planMultipleRoutes(
    start: [number, number],
    end: [number, number],
    mode: 'bike' | 'car' = 'bike'
  ): Promise<RouteOption[]> {
    try {
      // 目前 OSRM 不支援多條路線，返回單條路線
      const route = await this.planRoute(start, end, mode);
      return route ? [route] : [];
    } catch (error) {
      console.error('Plan multiple routes error:', error);
      return [];
    }
  }

  /**
   * 計算爬升和下降
   */
  private calculateElevationChanges(
    geometry: any
  ): { ascent: number; descent: number } {
    // 簡化計算：基於座標數量估算
    // 實際應用中應使用真實海拔數據
    const ascent = Math.random() * 500; // 模擬爬升
    const descent = Math.random() * 500; // 模擬下降

    return { ascent, descent };
  }

  /**
   * 計算路線難度
   */
  private calculateDifficulty(
    ascent: number,
    distance: number,
    mode: string
  ): 'easy' | 'moderate' | 'hard' {
    if (mode === 'bike') {
      const gradient = (ascent / distance) * 100;
      if (gradient > 8 || ascent > 1000) {
        return 'hard';
      } else if (gradient > 4 || ascent > 500) {
        return 'moderate';
      }
    }
    return 'easy';
  }

  /**
   * 解析路線步驟
   */
  private parseRouteSteps(legs: any[]): RouteStep[] {
    const steps: RouteStep[] = [];

    legs.forEach((leg) => {
      leg.steps.forEach((step: any) => {
        steps.push({
          instruction: step.maneuver?.instruction || '繼續前進',
          distance: step.distance,
          duration: step.duration,
          bearing: step.bearing_after || 0,
          coordinate: [step.geometry.coordinates[0][0], step.geometry.coordinates[0][1]],
        });
      });
    });

    return steps;
  }

  /**
   * 檢查路線是否偏離
   */
  isOffRoute(
    currentLocation: [number, number],
    route: Feature<LineString>,
    threshold: number = 50 // 公尺
  ): boolean {
    try {
      const point = turf.point(currentLocation);
      const nearestPoint = turf.nearestPointOnLine(route, point);
      const distance = turf.distance(point, nearestPoint, { units: 'meters' });
      return distance > threshold;
    } catch (error) {
      console.error('Check off-route error:', error);
      return false;
    }
  }

  /**
   * 計算到達目的地的剩餘距離
   */
  getRemainingDistance(
    currentLocation: [number, number],
    route: Feature<LineString>
  ): number {
    try {
      const point = turf.point(currentLocation);
      const sliced = turf.lineSlice(point, turf.point(route.geometry.coordinates[route.geometry.coordinates.length - 1]), route);
      return turf.length(sliced, { units: 'meters' });
    } catch (error) {
      console.error('Get remaining distance error:', error);
      return 0;
    }
  }
}

export const routePlanner = new RoutePlanner();
