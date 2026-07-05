import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, AppState, Platform } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
// import MapView from '@maplibre/maplibre-react-native'; // 假設使用 MapLibre React Native
import * as turf from '@turf/turf';
import { Feature, LineString, Point } from 'geojson'; // GeoJSON types
import * as Speech from 'expo-speech'; // expo-speech
// import { MMKVLoader } from 'react-native-mmkv-storage'; // MMKV

// 導入自訂模組
import { GpxTrackManager } from '@/lib/gpx-track-manager'; // GPX 軌跡管理
import { TurnDetectionEngine } from '@/lib/turn-detection-engine'; // 轉彎判定引擎
// import { ReroutingService } from '@/lib/rerouting-service'; // OSRM 重規劃服務
// import { ForegroundServiceModule } from '@/lib/foreground-service-module'; // 原生 Foreground Service 橋接

// 儀表板組件 (待實現)
import { DashboardOverlay } from '@/components/dashboard-overlay';
// 頂部 UI 組件 (待實現)
import { TopNavigationUI } from '@/components/top-navigation-ui';

// const mmkv = new MMKVLoader().initialize(); // MMKV 初始化 (待 MMKV 模組實現後啟用)

export default function NavigationScreen() {
  const colors = useColors();
  const mapRef = useRef(null); // MapView ref
  const [currentLocation, setCurrentLocation] = useState<Feature<Point> | null>(null);
  const [gpxRoute, setGpxRoute] = useState<Feature<LineString> | null>(null);
  const [reroutePath, setReroutePath] = useState<Feature<LineString> | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    speed: 0, power: 0, distance: 0, time: 0
  });

  // 1. GPS 數據獲取與處理 (模擬)
  useEffect(() => {
    let watchId: number;
    if (isNavigating) {
      // 啟動 Foreground Service (待原生模組實現後啟用)
      // ForegroundServiceModule.startService();

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation: Feature<Point> = turf.point([position.coords.longitude, position.coords.latitude]);
          setCurrentLocation(newLocation);

          // 實時寫入 MMKV (待 MMKV 模組實現後啟用)
          // mmkv.setMap('current_ride_data', {
          //   timestamp: Date.now(),
          //   latitude: position.coords.latitude,
          //   longitude: position.coords.longitude,
          //   speed: position.coords.speed || 0,
          //   // ... 其他儀表板數據
          // });

          // 更新儀表板數據 (簡化)
          setDashboardData(prev => ({
            ...prev,
            speed: position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0, // m/s to km/h
            power: Math.random() * 300, // 模擬功率數據
            distance: prev.distance + (position.coords.speed || 0) * 1, // 簡化距離計算
            time: prev.time + 1,
          }));

          // 轉彎判定與語音播報
          if (gpxRoute) {
            const turnInstruction = TurnDetectionEngine.detectTurn(newLocation, gpxRoute);
            if (turnInstruction) {
              Speech.speak(turnInstruction.text);
            }

            // 偏離檢測與重規劃 (待 OSRM 模組實現後啟用)
            // if (TurnDetectionEngine.isOffRoute(newLocation, gpxRoute)) {
            //   ReroutingService.reroute(newLocation, gpxRoute).then(newPath => {
            //     setReroutePath(newPath);
            //     // 播報新路徑上的第一個轉彎指令
            //     const firstInstruction = TurnDetectionEngine.getFirstInstruction(newPath);
            //     if (firstInstruction) Speech.speak(firstInstruction.text);
            //   });
            // }
          }
        },
        (error) => console.error("GPS Error:", error),
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (isNavigating) {
        // ForegroundServiceModule.stopService(); // 待原生模組實現後啟用
      }
    };
  }, [isNavigating, gpxRoute]);

  // 2. 斷線恢復邏輯 (待 MMKV 模組實現後啟用)
  useEffect(() => {
    const restoreRide = async () => {
      // const savedData = await mmkv.getMap('current_ride_data');
      // if (savedData && savedData.timestamp) {
      //   // 提示用戶是否恢復騎乘
      //   // ... 恢復地圖軌跡、儀表板數據、導航進度
      //   console.log("檢測到未完成騎乘，恢復數據:", savedData);
      //   // setIsNavigating(true); // 根據用戶選擇決定是否自動恢復
      // }
    };
    restoreRide();
  }, []);

  // 3. AppState 監聽 (用於語音播報和喚醒)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // App 返回前景，可以處理一些 UI 刷新或狀態檢查
      } else if (nextAppState === 'background') {
        // App 進入背景，確保語音播報和 GPS 服務持續運行
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // 4. GPX 載入 (模擬)
  const loadGpx = useCallback(async () => {
    // 模擬從文件或網絡加載 GPX
    const dummyGpx = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<gpx ...>\n  <trk>\n    <trkseg>\n      <trkpt lat="25.0330" lon="121.5654"></trkpt>\n      <trkpt lat="25.0335" lon="121.5660"></trkpt>\n      <trkpt lat="25.0340" lon="121.5665"></trkpt>\n      <!-- 更多點 -->\n    </trkseg>\n  </trk>\n</gpx>`;
    const geoJson = GpxTrackManager.parseGpxToGeoJSON(dummyGpx);
    setGpxRoute(geoJson);
    setIsNavigating(true);
  }, []);

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* MapView (待 MapLibre 模組實現後啟用) */}
      <View style={styles.mapPlaceholder}>
        <Text style={{ color: colors.muted }}>地圖區域 (MapLibre 待集成)</Text>
      </View>

      {/* 頂部搜尋與轉彎提示 UI */}
      <TopNavigationUI isNavigating={isNavigating} />

      {/* 儀表板懸浮化 (左下角) */}
      <DashboardOverlay data={dashboardData} />

      {/* 測試按鈕 (開發用) */}
      <View style={styles.testButtons}>
        <Text onPress={loadGpx} style={{ color: colors.foreground }}>開始導航 (載入GPX)</Text>
        <Text onPress={() => setIsNavigating(false)} style={{ color: colors.foreground }}>停止導航</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  map: {
    flex: 1,
  },
  chevron: {
    width: 20,
    height: 20,
    borderRadius: 10,
    // 實際的箭頭圖標會更複雜，這裡簡化
  },
  testButtons: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 5,
  },
});
