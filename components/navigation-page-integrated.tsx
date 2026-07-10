import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Pressable, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { ScreenContainer } from '@/components/screen-container';
import { NavigationBar, NavigationInstruction } from '@/components/navigation-bar';
import { GpxPathArrows } from '@/components/gpx-path-arrows';
import { DeviceHeadingArrow } from '@/components/device-heading-arrow';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface NavigationPageIntegratedProps {
  route?: any; // GPX 路線
  onRouteSelect?: (route: any) => void;
}

/**
 * 集成 NavigationBar 的導航頁面
 * 
 * 功能：
 * - 頂部實時轉彎提示導航欄
 * - 地址搜尋框
 * - 自行車/道路模式切換
 * - 多條路線選項展示
 * - 地圖顯示和 GPS 軌跡追蹤
 */
export function NavigationPageIntegrated({
  route,
  onRouteSelect,
}: NavigationPageIntegratedProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // 狀態管理
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [routeMode, setRouteMode] = useState<'bike' | 'road'>('bike');
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [navigationInstruction, setNavigationInstruction] = useState<NavigationInstruction | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(15);

  // 搜尋地址
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsSearching(true);
    try {
      // 模擬地址搜尋和路線規劃
      // 實際應用中應調用地理編碼 API 和路由 API
      const mockRoutes = [
        {
          id: 'route-1',
          name: '自行車道優先路線',
          distance: 15.2,
          duration: 45,
          elevation: 120,
          coordinates: [
            { latitude: 25.0330, longitude: 121.5654 },
            { latitude: 25.0340, longitude: 121.5664 },
            { latitude: 25.0350, longitude: 121.5674 },
          ],
        },
        {
          id: 'route-2',
          name: '最快路線',
          distance: 12.8,
          duration: 38,
          elevation: 85,
          coordinates: [
            { latitude: 25.0330, longitude: 121.5654 },
            { latitude: 25.0345, longitude: 121.5670 },
            { latitude: 25.0350, longitude: 121.5674 },
          ],
        },
        {
          id: 'route-3',
          name: '風景路線',
          distance: 18.5,
          duration: 55,
          elevation: 150,
          coordinates: [
            { latitude: 25.0330, longitude: 121.5654 },
            { latitude: 25.0325, longitude: 121.5650 },
            { latitude: 25.0350, longitude: 121.5674 },
          ],
        },
      ];

      setRoutes(mockRoutes);
      setSelectedRoute(mockRoutes[0]);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 選擇路線
  const handleSelectRoute = (route: any) => {
    setSelectedRoute(route);
    onRouteSelect?.(route);

    // 更新導航指令
    setNavigationInstruction({
      type: 'straight',
      distance: route.distance * 1000,
      instruction: `前往 ${route.name}`,
      isNavigating: true,
    });

    // 移動地圖到路線起點
    if (route.coordinates && route.coordinates.length > 0) {
      mapRef.current?.animateToRegion({
        latitude: route.coordinates[0].latitude,
        longitude: route.coordinates[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  // 切換路線模式
  const toggleRouteMode = () => {
    setRouteMode(routeMode === 'bike' ? 'road' : 'bike');
    // 重新搜尋
    if (searchQuery.trim()) {
      handleSearch();
    }
  };

  return (
    <ScreenContainer className="flex-1">
      {/* 頂部導航欄 */}
      <NavigationBar
        instruction={navigationInstruction}
        onClose={() => setNavigationInstruction(null)}
      />

      {/* 地圖 */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: 25.0330,
            longitude: 121.5654,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          onRegionChangeComplete={(region) => {
            // 計算縮放級別
            const zoomLevel = Math.log2(360 / region.longitudeDelta);
            setZoomLevel(zoomLevel);
          }}
        >
          {/* 當前位置標記 */}
          {currentLocation && (
            <Marker
              coordinate={currentLocation}
              title="當前位置"
            >
              <View style={styles.currentLocationMarker}>
                <DeviceHeadingArrow size={40} showCompass={false} />
              </View>
            </Marker>
          )}

          {/* 路線顯示 */}
          {selectedRoute && selectedRoute.coordinates && (
            <>
              <Polyline
                coordinates={selectedRoute.coordinates}
                strokeColor={routeMode === 'bike' ? '#4CAF50' : '#2196F3'}
                strokeWidth={4}
              />
              <GpxPathArrows
                route={{
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: selectedRoute.coordinates.map((c: any) => [c.longitude, c.latitude]),
                  },
                } as any}
                zoomLevel={zoomLevel}
              />
            </>
          )}
        </MapView>

        {/* 手機朝向指示器 */}
        <View style={[styles.headingIndicator, { top: insets.top + 80 }]}>
          <DeviceHeadingArrow size={50} showCompass={true} />
        </View>
      </View>

      {/* 搜尋和路線選擇面板 */}
      <View style={[styles.searchPanel, { paddingBottom: insets.bottom }]}>
        {/* 搜尋框 */}
        <View style={styles.searchContainer}>
          <IconSymbol
            size={20}
            name="magnifyingglass"
            color={colors.muted}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="搜尋地址或地點"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          <Pressable
            onPress={toggleRouteMode}
            style={[
              styles.modeButton,
              {
                backgroundColor: routeMode === 'bike' ? '#4CAF50' : '#2196F3',
              },
            ]}
          >
            <Text style={styles.modeButtonText}>
              {routeMode === 'bike' ? '🚴' : '🛣️'}
            </Text>
          </Pressable>
        </View>

        {/* 搜尋結果 */}
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : routes.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.routesContainer}
          >
            {routes.map((r) => (
              <Pressable
                key={r.id}
                style={[
                  styles.routeCard,
                  selectedRoute?.id === r.id && styles.routeCardSelected,
                ]}
                onPress={() => handleSelectRoute(r)}
              >
                <Text style={styles.routeName}>{r.name}</Text>
                <Text style={styles.routeInfo}>
                  {r.distance.toFixed(1)} km • {r.duration} min
                </Text>
                <Text style={styles.routeElevation}>
                  爬升: {r.elevation} m
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  headingIndicator: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  currentLocationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  searchPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  modeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  modeButtonText: {
    fontSize: 16,
  },
  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routesContainer: {
    maxHeight: 150,
  },
  routeCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 180,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  routeCardSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  routeName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333333',
  },
  routeInfo: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  routeElevation: {
    fontSize: 11,
    color: '#999999',
  },
});
