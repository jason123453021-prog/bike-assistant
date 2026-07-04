import * as turf from '@turf/turf';
import { Feature, LineString, Point, Position } from 'geojson';

interface TurnInstruction {
  distance: number; // 距離轉彎點的距離 (米)
  direction: 'left' | 'right' | 'straight';
  text: string;
}

export class TurnDetectionEngine {
  private static readonly OFF_ROUTE_THRESHOLD = 50; // 偏離路線閾值 (米)
  private static readonly TURN_ANGLE_THRESHOLD = 45; // 轉彎角度閾值 (度)
  private static readonly LOOK_AHEAD_DISTANCE = 50; // 提前檢測距離 (米)

  /**
   * 判斷當前位置是否偏離 GPX 路線。
   * @param currentLocation 當前位置的 GeoJSON Point Feature。
   * @param gpxRoute GPX 路線的 GeoJSON LineString。
   * @returns 是否偏離路線。
   */
  static isOffRoute(currentLocation: Feature<Point>, gpxRoute: Feature<LineString>): boolean {
    const distance = turf.pointToLineDistance(currentLocation, gpxRoute, { units: 'meters' });
    return distance > TurnDetectionEngine.OFF_ROUTE_THRESHOLD;
  }

  /**
   * 檢測前方轉彎並提供轉彎指示。
   * @param currentLocation 當前位置的 GeoJSON Point Feature。
   * @param gpxRoute GPX 路線的 GeoJSON LineString。
   * @returns 轉彎指示，如果沒有轉彎則返回 null。
   */
  static detectTurn(currentLocation: Feature<Point>, gpxRoute: Feature<LineString>): TurnInstruction | null {
    if (!gpxRoute || !gpxRoute.geometry || !gpxRoute.geometry.coordinates || gpxRoute.geometry.coordinates.length < 2) {
      return null;
    }

    // 找到當前位置在路線上的最近點
    const snapped = turf.nearestPointOnLine(gpxRoute, currentLocation);
    if (!snapped || snapped.properties.index === undefined) {
      return null;
    }

    const currentRoutePoint = snapped as Feature<Point>;
    const currentRouteIndex = snapped.properties.index;

    let lookAheadPoint: Feature<Point> | null = null;
    let lookAheadIndex = -1;

    // 尋找前方 LOOK_AHEAD_DISTANCE 處的點
    for (let i = currentRouteIndex; i < gpxRoute.geometry.coordinates.length - 1; i++) {
      const segment = turf.lineString([gpxRoute.geometry.coordinates[i], gpxRoute.geometry.coordinates[i + 1]]);
      const segmentLength = turf.length(segment, { units: 'meters' });
      const distanceToLookAhead = turf.pointToLineDistance(currentLocation, segment, { units: 'meters' });

      if (distanceToLookAhead >= TurnDetectionEngine.LOOK_AHEAD_DISTANCE) {
        // 找到前方 LOOK_AHEAD_DISTANCE 處的點
        const fraction = (TurnDetectionEngine.LOOK_AHEAD_DISTANCE - (distanceToLookAhead - segmentLength)) / segmentLength;
        lookAheadPoint = turf.along(segment, fraction, { units: 'meters' }) as Feature<Point>;
        lookAheadIndex = i;
        break;
      }
    }

    if (!lookAheadPoint || lookAheadIndex === -1) {
      return null; // 路線結束或前方沒有足夠距離的轉彎
    }

    // 計算當前方向與前方轉彎方向的角度
    const bearingToLookAhead = turf.bearing(currentLocation, lookAheadPoint);
    const bearingAfterTurn = turf.bearing(turf.point(gpxRoute.geometry.coordinates[lookAheadIndex]), turf.point(gpxRoute.geometry.coordinates[lookAheadIndex + 1]));

    const angleDiff = (bearingAfterTurn - bearingToLookAhead + 360) % 360;
    const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;

    let direction: TurnInstruction['direction'] = 'straight';
    if (normalizedAngle > TurnDetectionEngine.TURN_ANGLE_THRESHOLD && normalizedAngle < (180 - TurnDetectionEngine.TURN_ANGLE_THRESHOLD)) {
      direction = 'right';
    } else if (normalizedAngle > 180 && normalizedAngle < (360 - TurnDetectionEngine.TURN_ANGLE_THRESHOLD)) {
      direction = 'left';
    }

    const distanceToTurn = turf.distance(currentLocation, currentRoutePoint, { units: 'meters' });

    let text = "";
    if (direction === "left") {
      text = `前方 ${Math.round(distanceToTurn)} 公尺，向左轉`;
    } else if (direction === "right") {
      text = `前方 ${Math.round(distanceToTurn)} 公尺，向右轉`;
    } else {
      text = `前方 ${Math.round(distanceToTurn)} 公尺，直行`;
    }

    return {
      distance: Math.round(distanceToTurn),
      direction,
      text,
    };
  }

  /**
   * 從新規劃的路徑中獲取第一個轉彎指令。
   * @param reroutePath 新規劃的路徑 GeoJSON LineString。
   * @returns 轉彎指令或 null。
   */
  static getFirstInstruction(reroutePath: Feature<LineString>): TurnInstruction | null {
    // 簡化實現：這裡只獲取第一個明顯的轉彎
    const coordinates = reroutePath.geometry.coordinates;
    if (coordinates.length < 3) return null;

    const p1 = turf.point(coordinates[0]);
    const p2 = turf.point(coordinates[1]);
    const p3 = turf.point(coordinates[2]);

    const angle = turf.bearing(p1, p2) - turf.bearing(p2, p3);
    const normalizedAngle = (angle + 360) % 360;

    if (Math.abs(normalizedAngle) > TurnDetectionEngine.TURN_ANGLE_THRESHOLD && Math.abs(normalizedAngle) < (360 - TurnDetectionEngine.TURN_ANGLE_THRESHOLD)) {
      let direction: 'left' | 'right' | 'straight' = 'straight';
      if (normalizedAngle > TurnDetectionEngine.TURN_ANGLE_THRESHOLD && normalizedAngle < 180) {
        direction = 'right';
      } else if (normalizedAngle > 180 && normalizedAngle < (360 - TurnDetectionEngine.TURN_ANGLE_THRESHOLD)) {
        direction = 'left';
      }
      const distance = turf.distance(p1, p2, { units: 'meters' });
      return {
        distance: Math.round(distance),
        direction,
        text: `沿新路線，前方 ${Math.round(distance)} 公尺，向${direction === 'left' ? '左' : '右'}轉`,
      };
    }
    return null;
  }
}
