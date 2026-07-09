import { useEffect, useRef, useState } from 'react';
import { Feature, LineString, Point } from 'geojson';
import { TurnDetectionEngine } from '@/lib/turn-detection-engine';
import { ReroutingService } from '@/lib/rerouting-service';
import { VoiceNavigationManager } from '@/lib/voice-navigation-manager';

interface UseOffRouteDetectionOptions {
  gpxRoute?: Feature<LineString> | null;
  currentLocation?: Feature<Point> | null;
  enabled?: boolean;
  onOffRoute?: (isOffRoute: boolean) => void;
  onReroute?: (newRoute: Feature<LineString>) => void;
}

export function useOffRouteDetection({
  gpxRoute,
  currentLocation,
  enabled = true,
  onOffRoute,
  onReroute,
}: UseOffRouteDetectionOptions) {
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const offRouteWarningShownRef = useRef(false);

  useEffect(() => {
    if (!enabled || !gpxRoute || !currentLocation) return;

    const checkOffRoute = async () => {
      const offRoute = TurnDetectionEngine.isOffRoute(currentLocation, gpxRoute);

      if (offRoute && !isOffRoute) {
        // 剛剛偏離路線
        setIsOffRoute(true);
        onOffRoute?.(true);
        offRouteWarningShownRef.current = false;

        // 播放警告語音
        if (!offRouteWarningShownRef.current) {
          await VoiceNavigationManager.speakOffRouteWarning();
          offRouteWarningShownRef.current = true;
        }

        // 自動重規劃
        await handleReroute();
      } else if (!offRoute && isOffRoute) {
        // 回到路線
        setIsOffRoute(false);
        onOffRoute?.(false);
        offRouteWarningShownRef.current = false;
      }
    };

    const handleReroute = async () => {
      if (isRerouting) return;

      setIsRerouting(true);
      try {
        // 找到 GPX 路線上最近的點作為目標
        const nearestPoint = turf.nearestPointOnLine(gpxRoute, currentLocation);
        if (nearestPoint) {
          const newRoute = await ReroutingService.reroute(
            currentLocation,
            nearestPoint as Feature<Point>
          );

          if (newRoute) {
            onReroute?.(newRoute);
            await VoiceNavigationManager.speakTurnInstruction('已重新規劃路線，請跟隨新路線');
          }
        }
      } catch (error) {
        console.error('Rerouting failed:', error);
      } finally {
        setIsRerouting(false);
      }
    };

    const interval = setInterval(checkOffRoute, 5000); // 每 5 秒檢查一次

    return () => clearInterval(interval);
  }, [gpxRoute, currentLocation, enabled, isOffRoute, isRerouting, onOffRoute, onReroute]);

  return { isOffRoute, isRerouting };
}

// 導入 turf
import * as turf from '@turf/turf';
