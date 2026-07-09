import * as turf from '@turf/turf';
import { Feature, LineString, Point } from 'geojson';
import axios from 'axios';

interface OSRMRouteResponse {
  code: string;
  routes: Array<{ 
    geometry: string; 
    distance: number; 
    duration: number;
    steps?: any[];
  }>
}

export class ReroutingService {
  // 使用公共 OSRM 服務 - 自行車模式
  private static readonly OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/bike/';

  /**
   * 根據當前位置和目標點，獲取新的路線。
   * @param currentLocation 當前位置的 GeoJSON Point Feature。
   * @param targetLocation 目標位置的 GeoJSON Point Feature (例如 GPX 路線上的下一個關鍵點)。
   * @returns 新規劃的路線 GeoJSON LineString Feature 或 null。
   */
  static async reroute(currentLocation: Feature<Point>, targetLocation: Feature<Point>): Promise<Feature<LineString> | null> {
    const startCoords = currentLocation.geometry.coordinates;
    const endCoords = targetLocation.geometry.coordinates;

    // 使用自行車模式 (bike) 的 OSRM API
    const url = `${ReroutingService.OSRM_BASE_URL}${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?overview=full&geometries=geojson&steps=true&annotations=distance,duration,speed`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OSRM API error: ${response.statusText}`);
      }
      
      const data: OSRMRouteResponse = await response.json();
      if (data.code === 'Ok' && data.routes.length > 0) {
        const routeGeometry = data.routes[0].geometry as unknown as LineString;
        // OSRM 返回的 geometry 已經是 GeoJSON LineString 格式
        const route = turf.lineString(routeGeometry.coordinates) as Feature<LineString>;
        
        // 添加路線元數據
        route.properties = {
          distance: data.routes[0].distance,
          duration: data.routes[0].duration,
          steps: data.routes[0].steps,
        };
        
        return route;
      }
    } catch (error) {
      console.error('OSRM Rerouting Error:', error);
    }
    return null;
  }

  /**
   * 根據當前位置和偏離的 GPX 路線，規劃一條回到 GPX 路線的最短路徑。
   * 這個方法會嘗試找到 GPX 路線上離當前位置最近的點作為目標點。
   * @param currentLocation 當前位置的 GeoJSON Point Feature。
   * @param gpxRoute 原始 GPX 路線的 GeoJSON LineString。
   * @returns 新規劃的路線 GeoJSON LineString Feature 或 null。
   */
  static async rerouteToGpx(currentLocation: Feature<Point>, gpxRoute: Feature<LineString>): Promise<Feature<LineString> | null> {
    // 找到 GPX 路線上離當前位置最近的點
    const nearestPointOnGpx = turf.nearestPointOnLine(gpxRoute, currentLocation);

    if (!nearestPointOnGpx) {
      console.warn('Could not find nearest point on GPX route for rerouting.');
      return null;
    }

    // 以最近點作為目標，重新規劃路線
    return ReroutingService.reroute(currentLocation, nearestPointOnGpx as Feature<Point>);
  }

  /**
   * 獲取路線的轉彎步驟
   * @param route 路線 Feature
   * @returns 轉彎步驟數組
   */
  static getRouteSteps(route: Feature<LineString>): any[] {
    return route.properties?.steps || [];
  }

  /**
   * 獲取路線距離（米）
   * @param route 路線 Feature
   * @returns 距離（米）
   */
  static getRouteDistance(route: Feature<LineString>): number {
    return route.properties?.distance || 0;
  }

  /**
   * 獲取路線持續時間（秒）
   * @param route 路線 Feature
   * @returns 持續時間（秒）
   */
  static getRouteDuration(route: Feature<LineString>): number {
    return route.properties?.duration || 0;
  }
}
