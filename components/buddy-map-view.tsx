import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { BuddyStatus } from '@/lib/real-time-buddy-tracking';

const { width, height } = Dimensions.get('window');

interface BuddyMapViewProps {
  currentLocation: { lat: number; lon: number };
  buddies: BuddyStatus[];
  onBuddyPress?: (buddy: BuddyStatus) => void;
}

export function BuddyMapView({
  currentLocation,
  buddies,
  onBuddyPress,
}: BuddyMapViewProps) {
  const colors = useColors();
  const [mapBounds, setMapBounds] = useState({
    minLat: currentLocation.lat,
    maxLat: currentLocation.lat,
    minLon: currentLocation.lon,
    maxLon: currentLocation.lon,
  });

  useEffect(() => {
    // 計算地圖邊界
    let minLat = currentLocation.lat;
    let maxLat = currentLocation.lat;
    let minLon = currentLocation.lon;
    let maxLon = currentLocation.lon;

    buddies.forEach((buddy) => {
      minLat = Math.min(minLat, buddy.currentLocation.latitude);
      maxLat = Math.max(maxLat, buddy.currentLocation.latitude);
      minLon = Math.min(minLon, buddy.currentLocation.longitude);
      maxLon = Math.max(maxLon, buddy.currentLocation.longitude);
    });

    // 添加邊距
    const latMargin = (maxLat - minLat) * 0.2;
    const lonMargin = (maxLon - minLon) * 0.2;

    setMapBounds({
      minLat: minLat - latMargin,
      maxLat: maxLat + latMargin,
      minLon: minLon - lonMargin,
      maxLon: maxLon + lonMargin,
    });
  }, [currentLocation, buddies]);

  /**
   * 將經緯度轉換為像素座標
   */
  const latLonToPixel = (lat: number, lon: number) => {
    const mapWidth = width - 32;
    const mapHeight = height * 0.4;

    const x =
      ((lon - mapBounds.minLon) / (mapBounds.maxLon - mapBounds.minLon)) * mapWidth;
    const y =
      ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * mapHeight;

    return { x, y };
  };

  /**
   * 獲取方向箭頭
   */
  const getDirectionArrow = (heading: number) => {
    if (heading < 45 || heading >= 315) return '⬆️';
    if (heading < 135) return '➡️';
    if (heading < 225) return '⬇️';
    return '⬅️';
  };

  const currentPixel = latLonToPixel(currentLocation.lat, currentLocation.lon);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* 地圖背景 */}
      <View
        style={[
          styles.mapBackground,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        {/* 網格線 */}
        <View style={[styles.gridH1, { backgroundColor: colors.border }]} />
        <View style={[styles.gridH2, { backgroundColor: colors.border }]} />
        <View style={[styles.gridV1, { backgroundColor: colors.border }]} />
        <View style={[styles.gridV2, { backgroundColor: colors.border }]} />

        {/* 隊友標記 */}
        {buddies.map((buddy) => {
          const pixel = latLonToPixel(
            buddy.currentLocation.latitude,
            buddy.currentLocation.longitude
          );

          return (
            <View
              key={buddy.userId}
              style={[
                styles.buddyMarker,
                {
                  left: pixel.x - 20,
                  top: pixel.y - 20,
                },
              ]}
            >
              {/* 外圈 */}
              <View
                style={[
                  styles.markerOuter,
                  {
                    borderColor: buddy.status === 'riding' ? colors.primary : colors.muted,
                  },
                ]}
              />

              {/* 內圈 */}
              <View
                style={[
                  styles.markerInner,
                  {
                    backgroundColor: buddy.status === 'riding' ? colors.primary : colors.muted,
                  },
                ]}
              />

              {/* 方向箭頭 */}
              <Text style={styles.directionArrow}>
                {getDirectionArrow(buddy.currentLocation.heading)}
              </Text>

              {/* 隊友名稱 */}
              <Text
                style={[
                  styles.buddyName,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.surface,
                  },
                ]}
                numberOfLines={1}
              >
                {buddy.userName}
              </Text>

              {/* 距離信息 */}
              <Text
                style={[
                  styles.distanceInfo,
                  {
                    color: colors.muted,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                {(buddy.distance / 1000).toFixed(1)} km
              </Text>
            </View>
          );
        })}

        {/* 當前位置標記 */}
        <View
          style={[
            styles.currentMarker,
            {
              left: currentPixel.x - 15,
              top: currentPixel.y - 15,
            },
          ]}
        >
          <View
            style={[
              styles.currentOuter,
              {
                borderColor: colors.primary,
              },
            ]}
          />
          <View
            style={[
              styles.currentInner,
              {
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* 圖例 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendMarker,
              {
                backgroundColor: colors.primary,
              },
            ]}
          />
          <Text style={[styles.legendText, { color: colors.foreground }]}>
            你的位置
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendMarker,
              {
                backgroundColor: colors.primary,
                opacity: 0.6,
              },
            ]}
          />
          <Text style={[styles.legendText, { color: colors.foreground }]}>
            騎乘中的隊友
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendMarker,
              {
                backgroundColor: colors.muted,
              },
            ]}
          />
          <Text style={[styles.legendText, { color: colors.foreground }]}>
            已停止的隊友
          </Text>
        </View>
      </View>

      {/* 信息面板 */}
      {buddies.length > 0 && (
        <View
          style={[
            styles.infoPanel,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.infoPanelTitle, { color: colors.foreground }]}>
            隊友信息
          </Text>
          <View style={styles.infoPanelContent}>
            {buddies.slice(0, 3).map((buddy) => (
              <View key={buddy.userId} style={styles.infoPanelItem}>
                <Text style={[styles.infoPanelName, { color: colors.foreground }]}>
                  {buddy.userName}
                </Text>
                <Text style={[styles.infoPanelDistance, { color: colors.muted }]}>
                  距離: {(buddy.distance / 1000).toFixed(1)} km • 速度: {buddy.currentLocation.speed.toFixed(1)} km/h
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapBackground: {
    height: height * 0.4,
    borderBottomWidth: 1,
    position: 'relative',
  },
  gridH1: {
    position: 'absolute',
    height: 1,
    width: '100%',
    top: '33%',
  },
  gridH2: {
    position: 'absolute',
    height: 1,
    width: '100%',
    top: '66%',
  },
  gridV1: {
    position: 'absolute',
    width: 1,
    height: '100%',
    left: '33%',
  },
  gridV2: {
    position: 'absolute',
    width: 1,
    height: '100%',
    left: '66%',
  },
  buddyMarker: {
    position: 'absolute',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerOuter: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
  markerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  directionArrow: {
    fontSize: 16,
    fontWeight: '600',
  },
  buddyName: {
    position: 'absolute',
    top: 35,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 60,
  },
  distanceInfo: {
    position: 'absolute',
    top: 50,
    fontSize: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentMarker: {
    position: 'absolute',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentOuter: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  currentInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legend: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  infoPanel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  infoPanelTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoPanelContent: {
    gap: 6,
  },
  infoPanelItem: {
    paddingVertical: 4,
  },
  infoPanelName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoPanelDistance: {
    fontSize: 10,
  },
});
