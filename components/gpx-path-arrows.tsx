import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Feature, LineString } from 'geojson';
import { calculateArrowMarkers, ArrowMarker } from '@/components/path-arrows';

interface GpxPathArrowsProps {
  route: Feature<LineString> | null;
  zoomLevel: number;
  arrowInterval?: number; // 箭頭間隔（公尺）
}

/**
 * GPX 路徑軌跡箭頭渲染組件
 * 
 * 功能：
 * - 沿著 GPX 軌跡每 100 公尺疊加白色箭頭
 * - 動態調整箭頭密度（基於地圖縮放級別）
 * - 優化性能，確保地圖放大縮小不卡頓
 */
export function GpxPathArrows({
  route,
  zoomLevel,
  arrowInterval = 100,
}: GpxPathArrowsProps) {
  // 計算箭頭標記
  const arrowMarkers = useMemo(() => {
    if (!route || route.geometry.type !== 'LineString') {
      return [];
    }

    return calculateArrowMarkers(route, arrowInterval, zoomLevel);
  }, [route, zoomLevel, arrowInterval]);

  // 渲染箭頭
  return (
    <>
      {arrowMarkers.map((arrow, index) => (
        <ArrowMarkerComponent key={`arrow-${index}`} arrow={arrow} />
      ))}
    </>
  );
}

/**
 * 單個箭頭標記組件
 */
function ArrowMarkerComponent({ arrow }: { arrow: ArrowMarker }) {
  // 根據方向角獲取箭頭符號
  const getArrowSymbol = (bearing: number): string => {
    const normalizedBearing = ((bearing % 360) + 360) % 360;

    if (normalizedBearing < 45 || normalizedBearing >= 315) {
      return '↑'; // 向上
    } else if (normalizedBearing < 135) {
      return '→'; // 向右
    } else if (normalizedBearing < 225) {
      return '↓'; // 向下
    } else {
      return '←'; // 向左
    }
  };

  return (
    <Marker
      coordinate={{
        latitude: arrow.coordinate[1],
        longitude: arrow.coordinate[0],
      }}
      title={`${Math.round(arrow.distance)} m`}
      description={`方向: ${Math.round(arrow.bearing)}°`}
    >
      <View style={styles.arrowContainer}>
        <View
          style={[
            styles.arrow,
            {
              transform: [{ rotate: `${arrow.bearing}deg` }],
            },
          ]}
        >
          <View style={styles.arrowHead} />
          <View style={styles.arrowTail} />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  arrowContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  arrow: {
    width: 20,
    height: 20,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
  },
  arrowTail: {
    width: 2,
    height: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
});
