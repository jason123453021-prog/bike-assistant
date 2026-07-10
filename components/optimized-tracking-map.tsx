import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { gpsTracker, GPSLocation, LocationStats } from '@/lib/gps-location-tracker';

interface OptimizedTrackingMapProps {
  onLocationUpdate?: (location: GPSLocation) => void;
  onStatsUpdate?: (stats: LocationStats) => void;
  routeColor?: string;
  routeWidth?: number;
  showCurrentLocation?: boolean;
  enableRotation?: boolean;
  enableZoom?: boolean;
}

/**
 * 優化的軌跡追蹤地圖組件
 * 
 * 功能：
 * - 實時軌跡增量渲染
 * - GPS 位置實時更新
 * - 雙指旋轉支持
 * - 性能優化（只渲染可見區域）
 */
export function OptimizedTrackingMap({
  onLocationUpdate,
  onStatsUpdate,
  routeColor = '#4CAF50',
  routeWidth = 4,
  showCurrentLocation = true,
  enableRotation = true,
  enableZoom = true,
}: OptimizedTrackingMapProps) {
  const mapRef = useRef<MapView>(null);
  const [trackingLocations, setTrackingLocations] = useState<GPSLocation[]>([]);
  const [currentLocation, setCurrentLocation] = useState<GPSLocation | null>(null);
  const [mapRotation, setMapRotation] = useState(0);
  const [mapZoom, setMapZoom] = useState(15);
  const [isTracking, setIsTracking] = useState(false);

  // 雙指旋轉手勢
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enableRotation,
      onMoveShouldSetPanResponder: () => enableRotation,
      onPanResponderMove: (evt: GestureResponderEvent) => {
        if (enableRotation && evt.nativeEvent.touches.length === 2) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];

          const dx = touch2.pageX - touch1.pageX;
          const dy = touch2.pageY - touch1.pageY;

          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          setMapRotation(angle);
        }
      },
    })
  ).current;

  // 初始化 GPS 追蹤
  useEffect(() => {
    const initializeTracking = async () => {
      try {
        await gpsTracker.startTracking();
        setIsTracking(true);

        // 監聽位置更新
        gpsTracker.on('location', (location: GPSLocation) => {
          setTrackingLocations((prev) => {
            const updated = [...prev, location];
            // 限制記錄數量以優化性能（保留最近 1000 個點）
            if (updated.length > 1000) {
              updated.shift();
            }
            return updated;
          });

          setCurrentLocation(location);
          onLocationUpdate?.(location);

          // 更新地圖中心到當前位置
          if (mapRef.current && location) {
            mapRef.current.animateToRegion({
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 500);
          }
        });

        // 監聽統計更新
        gpsTracker.on('stats', (stats: LocationStats) => {
          onStatsUpdate?.(stats);
        });
      } catch (error) {
        console.error('Failed to initialize tracking:', error);
      }
    };

    initializeTracking();

    return () => {
      gpsTracker.stopTracking();
      gpsTracker.removeAllListeners();
    };
  }, [onLocationUpdate, onStatsUpdate]);

  // 處理地圖區域變化
  const handleRegionChange = (region: any) => {
    // 計算縮放級別
    const zoomLevel = Math.log2(360 / region.longitudeDelta);
    setMapZoom(zoomLevel);
  };

  // 動態調整軌跡點密度（基於縮放級別）
  const getFilteredLocations = () => {
    if (trackingLocations.length === 0) {
      return [];
    }

    // 根據縮放級別決定是否過濾點
    const filterInterval = Math.max(1, Math.floor(5 - mapZoom / 3));

    return trackingLocations.filter((_, index) => index % filterInterval === 0);
  };

  const filteredLocations = getFilteredLocations();

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 25.0330,
          longitude: 121.5654,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onRegionChange={handleRegionChange}
        rotateEnabled={enableRotation}
        zoomEnabled={enableZoom}
        pitchEnabled={true}
        scrollEnabled={true}
      >
        {/* 軌跡路線 */}
        {filteredLocations.length > 1 && (
          <Polyline
            coordinates={filteredLocations.map((loc) => ({
              latitude: loc.latitude,
              longitude: loc.longitude,
            }))}
            strokeColor={routeColor}
            strokeWidth={routeWidth}
            lineDashPattern={[0]} // 實線
            tappable={false}
          />
        )}

        {/* 當前位置標記 */}
        {showCurrentLocation && currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="當前位置"
            description={`速度: ${(currentLocation.speed || 0).toFixed(1)} m/s`}
            pinColor="#FF5722"
          />
        )}

        {/* 起點標記 */}
        {trackingLocations.length > 0 && (
          <Marker
            coordinate={{
              latitude: trackingLocations[0].latitude,
              longitude: trackingLocations[0].longitude,
            }}
            title="起點"
            pinColor="#4CAF50"
          />
        )}
      </MapView>

      {/* 地圖旋轉指示器 */}
      {enableRotation && mapRotation !== 0 && (
        <View style={[styles.rotationIndicator, { transform: [{ rotate: `${mapRotation}deg` }] }]}>
          <View style={styles.rotationArrow} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  rotationIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  rotationArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF5722',
  },
});
