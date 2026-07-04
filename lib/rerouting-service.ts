import * as turf from '@turf/turf';
import { Feature, LineString, Point } from 'geojson';
import axios from 'axios';

interface OSRMRouteResponse {
  code: string;
  routes: Array<{ geometry: string; distance: number; duration: number; }>
}

export class ReroutingService {
  // 可以使用公共 OSRM 服務，例如 OpenStreetMap 的 OSRM 實例
  // 注意：公共服務可能有速率限制，生產環境建議部署自己的 OSRM 實例或使用其他服務
  private static readonly OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving/';

  /**
   * 根據當前位置和目標點，獲取新的路線。
   * @param currentLocation 當前位置的 GeoJSON Point Feature。
   * @param targetLocation 目標位置的 GeoJSON Point Feature (例如 GPX 路線上的下一個關鍵點)。
   * @returns 新規劃的路線 GeoJSON LineString Feature 或 null。
   */
  static async reroute(currentLocation: Feature<Point>, targetLocation: Feature<Point>): Promise<Feature<LineString> | null> {
    const startCoords = currentLocation.geometry.coordinates;
    const endCoords = targetLocation.geometry.coordinates;

    const url = `${ReroutingService.OSRM_BASE_URL}${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?overview=full&geometries=geojson`;

    try {
      const response = await axios.get<OSRMRouteResponse>(url);
      if (response.data.code === 'Ok' && response.data.routes.length > 0) {
        const routeGeometry = response.data.routes[0].geometry as unknown as LineString;
        // OSRM 返回的 geometry 已經是 GeoJSON LineString 格式
        return turf.lineString(routeGeometry.coordinates) as Feature<LineString>;
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
}
