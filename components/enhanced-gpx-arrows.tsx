import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import * as turf from '@turf/turf';

interface EnhancedGpxArrowsProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  arrowInterval?: number; // 箭頭間隔（公尺）
  arrowColor?: string; // 箭頭顏色
  arrowSize?: number; // 箭頭大小
}

interface ArrowPosition {
  latitude: number;
  longitude: number;
  bearing: number;
  distance: number; // 距離起點的距離
}

/**
 * 改進的 GPX 路徑箭頭組件
 * 
 * 功能：
 * - 沿著 GPX 軌跡每 100 公尺疊加白色箭頭
 * - 計算每個箭頭的方向角
 * - 優化性能，支持大量坐標點
 */
export function EnhancedGpxArrows({
  coordinates,
  arrowInterval = 100,
  arrowColor = '#ffffff',
  arrowSize = 24,
}: EnhancedGpxArrowsProps) {
  // 計算箭頭位置
  const arrowPositions = useMemo(() => {
    if (!coordinates || coordinates.length < 2) {
      return [];
    }

    const arrows: ArrowPosition[] = [];
    let cumulativeDistance = 0;
    let nextArrowDistance = arrowInterval;

    // 轉換為 GeoJSON LineString
    const lineCoordinates = coordinates.map(c => [c.longitude, c.latitude]);
    const line = turf.lineString(lineCoordinates);

    // 沿著線計算箭頭位置
    for (let i = 0; i < coordinates.length - 1; i++) {
      const current = coordinates[i];
      const next = coordinates[i + 1];

      // 計算當前段的距離
      const segment = turf.distance(
        [current.longitude, current.latitude],
        [next.longitude, next.latitude],
        { units: 'meters' }
      );

      // 檢查是否需要在這段內添加箭頭
      if (cumulativeDistance + segment >= nextArrowDistance) {
        // 計算箭頭在這段內的位置
        const remainingDistance = nextArrowDistance - cumulativeDistance;
        const ratio = remainingDistance / segment;

        const arrowLat = current.latitude + (next.latitude - current.latitude) * ratio;
        const arrowLon = current.longitude + (next.longitude - current.longitude) * ratio;

        // 計算方向角（使用當前段和下一段的平均方向）
        const bearing = turf.bearing(
          [current.longitude, current.latitude],
          [next.longitude, next.latitude]
        );

        arrows.push({
          latitude: arrowLat,
          longitude: arrowLon,
          bearing,
          distance: nextArrowDistance,
        });

        nextArrowDistance += arrowInterval;
      }

      cumulativeDistance += segment;
    }

    return arrows;
  }, [coordinates, arrowInterval]);

  // 根據方向角獲取箭頭符號
  const getArrowSymbol = (bearing: number): string => {
    const normalizedBearing = ((bearing % 360) + 360) % 360;

    if (normalizedBearing < 45 || normalizedBearing >= 315) {
      return '▲'; // 向上
    } else if (normalizedBearing < 135) {
      return '▶'; // 向右
    } else if (normalizedBearing < 225) {
      return '▼'; // 向下
    } else {
      return '◀'; // 向左
    }
  };

  return (
    <>
      {arrowPositions.map((arrow, index) => (
        <ArrowMarker
          key={`gpx-arrow-${index}`}
          arrow={arrow}
          arrowColor={arrowColor}
          arrowSize={arrowSize}
          getArrowSymbol={getArrowSymbol}
        />
      ))}
    </>
  );
}

/**
 * 單個箭頭標記組件
 */
interface ArrowMarkerProps {
  arrow: ArrowPosition;
  arrowColor: string;
  arrowSize: number;
  getArrowSymbol: (bearing: number) => string;
}

function ArrowMarker({
  arrow,
  arrowColor,
  arrowSize,
  getArrowSymbol,
}: ArrowMarkerProps) {
  return (
    <View
      style={[
        styles.arrowContainer,
        {
          position: 'absolute',
          // 注意：實際位置需要由地圖組件根據坐標計算
        },
      ]}
    >
      <View
        style={[
          styles.arrow,
          {
            width: arrowSize,
            height: arrowSize,
            transform: [{ rotate: `${arrow.bearing}deg` }],
          },
        ]}
      >
        <Text
          style={[
            styles.arrowText,
            {
              color: arrowColor,
              fontSize: arrowSize * 0.8,
            },
          ]}
        >
          {getArrowSymbol(arrow.bearing)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 4,
  },
  arrow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
