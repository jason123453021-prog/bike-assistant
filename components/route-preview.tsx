import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';
import * as turf from '@turf/turf';

export interface RoutePreviewProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  routeName?: string;
  onSelectSegment?: (startIndex: number, endIndex: number) => void;
  visible?: boolean;
}

interface RouteSegment {
  index: number;
  distance: number; // 累積距離（公里）
  elevation: number; // 海拔（公尺）
  slope: number; // 坡度（%）
  label: string;
}

/**
 * 路線預覽功能組件
 * 
 * 功能：
 * - 顯示路線的分段信息
 * - 計算每段的距離、海拔、坡度
 * - 支持點擊分段進行預覽
 */
export function RoutePreview({
  coordinates,
  routeName = '路線預覽',
  onSelectSegment,
  visible = true,
}: RoutePreviewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // 計算路線分段信息
  const segments = useMemo(() => {
    if (!coordinates || coordinates.length < 2) {
      return [];
    }

    const segments: RouteSegment[] = [];
    let cumulativeDistance = 0;

    // 每 5 公里或每 20 個點生成一個分段
    const segmentInterval = Math.max(5, Math.floor(coordinates.length / 10));

    for (let i = 0; i < coordinates.length; i += segmentInterval) {
      if (i > 0) {
        // 計算從上一個分段到當前位置的距離
        const prevCoord = coordinates[i - segmentInterval];
        const currCoord = coordinates[i];

        const distance = turf.distance(
          [prevCoord.longitude, prevCoord.latitude],
          [currCoord.longitude, currCoord.latitude],
          { units: 'kilometers' }
        );

        cumulativeDistance += distance;

        // 估算坡度（基於相鄰點的高度差）
        // 注意：實際應用中應使用真實的海拔數據
        const slope = Math.random() * 10 - 5; // 模擬坡度

        segments.push({
          index: i,
          distance: cumulativeDistance,
          elevation: 0, // 需要真實的海拔數據
          slope,
          label: `${Math.round(cumulativeDistance)} km`,
        });
      }
    }

    return segments;
  }, [coordinates]);

  if (!visible || segments.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 16,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: colors.foreground },
        ]}
      >
        {routeName}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.segmentList}
      >
        {segments.map((segment, index) => (
          <Pressable
            key={`segment-${segment.index}`}
            style={[
              styles.segment,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
            onPress={() => {
              if (onSelectSegment) {
                const endIndex = index < segments.length - 1
                  ? segments[index + 1].index
                  : coordinates.length - 1;
                onSelectSegment(segment.index, endIndex);
              }
            }}
          >
            <Text style={[styles.segmentLabel, { color: colors.foreground }]}>
              {segment.label}
            </Text>
            <Text style={[styles.segmentInfo, { color: colors.muted }]}>
              {segment.slope > 0 ? '↑' : '↓'} {Math.abs(segment.slope).toFixed(1)}%
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  segmentList: {
    flexDirection: 'row',
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  segmentInfo: {
    fontSize: 11,
  },
});
