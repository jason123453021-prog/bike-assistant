# 導航系統全面升級 - 架構設計文檔

## 1. 概述

本文件旨在詳細說明 Smart Bike Assistant 應用導航系統全面升級的架構設計。本次升級將採用 MapLibre React Native 作為基礎地圖引擎，結合 Turf.js 進行本地空間分析，OSRM 公共 API 實現路線重規劃，以及 expo-speech 進行語音播報。核心目標是提供一個免費、高效、離線優先且穩定可靠的導航體驗，特別針對長距離騎乘和深山無網路場景。

## 2. 技術棧概覽

| 組件 | 角色 | 選擇理由 | 備註 |
|---|---|---|---|
| **地圖引擎** | MapLibre React Native | 開源免費，高效渲染，支援離線地圖，無廠商鎖定 | `app/(tabs)/navigation.tsx` 中的核心地圖組件 |
| **空間分析** | Turf.js | 強大的本地地理空間分析庫，無需網路，性能優異 | 用於 GPX 軌跡處理、轉彎判定、偏離檢測 |
| **路線規劃** | OSRM 公共 API | 免費、高性能的開源路由引擎，用於偏離重規劃 | 僅在偏離時觸發，減少網路依賴 |
| **語音播報** | expo-speech (TTS) | 原生文字轉語音，支援背景/鎖屏播放，無需付費 API | 播報轉彎指令和補給提醒 |
| **本地持久化** | MMKV | 毫秒級讀寫性能，專為高頻數據存儲設計 | 實時保存 GPS 點位、儀表板數據，實現斷線恢復 |
| **後台保活** | 原生 Android Foreground Service | 系統級進程保活，確保 GPS 持續定位和記錄 | 需透過 Expo Config Plugin 實現 |
| **開發環境** | Expo Dev Client / EAS Build | 支援原生模組開發，提供完整的開發和構建流程 | 替代 Expo Go，確保原生功能運行 |

## 3. 核心功能模組設計

### 3.1. 地圖渲染與 GPX 軌跡顯示 (MapLibre React Native)

- **地圖初始化**：在 `app/(tabs)/navigation.tsx` 中初始化 `MapView`，配置基礎地圖樣式（可使用 OpenStreetMap 或自訂樣式）。
- **GPX 軌跡加載**：
  1. 用戶匯入 GPX 文件後，使用第三方庫（如 `gpx-to-geojson` 或 `togeojson`）將 GPX 數據轉換為 GeoJSON 格式。
  2. 將 GeoJSON 數據作為 `Source` 和 `Layer` 添加到 MapLibre 地圖上，渲染為高飽和度深藍色線條。
- **實時位置顯示**：使用 `Camera` 組件跟隨用戶當前位置，並顯示自訂的「藍色三角導航箭頭」作為定位圖標。箭頭方向綁定陀螺儀和 GPS 數據，實時指向行進方向。
- **路線配色**：主導航路線採用高飽和度「深藍色」，替代路線採用淡灰色或淡藍色。

### 3.2. 轉彎判定引擎 (Turf.js)

- **數據輸入**：
  - 用戶當前 GPS 點位 (實時獲取)
  - GPX 軌跡的 GeoJSON 數據 (預加載)
- **核心邏輯**：
  1. **最近點查找**：使用 `turf.nearestPointOnLine()` 找到用戶當前位置在 GPX 軌跡上的最近點。
  2. **前方軌跡分析**：從最近點開始，沿 GPX 軌跡向前取一段距離（例如 50-100 公尺）的線段。
  3. **角度計算**：使用 `turf.bearing()` 或 `turf.angle()` 計算：
     - 用戶當前行進方向與前方軌跡線段方向的夾角。
     - 前方軌跡線段兩端點之間的夾角（用於判斷轉彎點）。
  4. **轉彎事件觸發**：當前方 50 公尺處的軌跡夾角大於閾值（例如 45 度）時，觸發轉彎事件。
  5. **語音指令生成**：根據轉彎方向和距離，生成語音指令文本（例如：「前方 50 公尺，向右轉」）。
- **偏離檢測**：使用 `turf.pointToLineDistance()` 計算用戶當前位置與 GPX 軌跡的垂直距離。當距離超過閾值（例如 50 公尺）時，觸發偏離事件。

### 3.3. 靜默重規劃 (OSRM 公共 API)

- **觸發條件**：當 Turf.js 檢測到用戶偏離 GPX 軌跡超過 50 公尺時。
- **API 調用**：向 OSRM 公共 API 發送請求，獲取從用戶當前位置回到原 GPX 軌跡的最短路徑。
  - **請求參數**：當前位置、目標點（GPX 軌跡上最近的點或下一個關鍵點）。
  - **OSRM API 選擇**：`route` 服務用於獲取路徑 GeoJSON，`match` 服務用於將用戶位置匹配到路網。
- **路線更新**：獲取到新路徑後，將其渲染到 MapLibre 地圖上（使用淡灰色或淡藍色），並將其作為新的導航參考。
- **語音指令**：直接播報新路徑上的轉彎指令，不播報「您已偏離路徑」。

### 3.4. 語音播報系統 (expo-speech)

- **初始化**：在應用啟動時初始化 `expo-speech`。
- **語音指令**：接收來自轉彎判定引擎和重規劃模組的文本指令。
- **播放管理**：
  - 使用 `Speech.speak()` 進行語音播報。
  - 確保在背景和鎖屏狀態下也能正常播放。
  - 考慮 Audio Focus 管理，避免與其他音頻衝突。
- **補給提醒**：當補給閾值達到時，觸發 `expo-speech` 播報補給提醒。

### 3.5. 本地持久化 (MMKV)

- **數據存儲**：
  - 實時 GPS 點位：每 5-10 秒將當前 GPS 座標、速度、瓦數等數據寫入 MMKV。
  - 儀表板數據：累積的騎乘距離、時間、平均速度等。
  - 導航進度：當前導航狀態、下一個轉彎點信息。
- **斷線恢復**：
  - 應用啟動時，檢查 MMKV 中是否存在未結束的騎乘 Flag。
  - 若存在，自動讀取 MMKV 中的數據，還原軌跡線、儀表數據和導航進度。
- **MMKV React Native 橋接**：需要編寫原生模組（Kotlin）並透過 JSI 或 Native Modules 橋接到 React Native。

### 3.6. 後台保活 (原生 Android Foreground Service)

- **觸發時機**：當用戶開始騎乘導航或記錄時，啟動 Foreground Service。
- **核心功能**：
  - **持續 GPS 定位**：確保 App 在背景或鎖屏狀態下持續獲取高精度 GPS 數據。
  - **常駐通知**：在通知欄顯示一個不可清除的通知，提升進程優先級，防止系統殺死。
  - **鎖屏喚醒**：當補給提醒等重要事件發生時，透過原生 Wake-up 模組強制點亮螢幕並跳出彈窗。
- **Expo Config Plugin**：
  - 自動修改 `AndroidManifest.xml`，添加 `FOREGROUND_SERVICE` 權限和 Service 聲明。
  - 處理 Service 的啟動、停止和生命週期管理。
  - 提供 React Native 接口，用於啟動/停止 Service。

## 4. 新導航頁面組件結構 (`app/(tabs)/navigation.tsx`)

```tsx
// app/(tabs)/navigation.tsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, AppState, Platform } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import MapView from '@maplibre/maplibre-react-native'; // 假設使用 MapLibre React Native
import * as turf from '@turf/turf'; // Turf.js
import * as Speech from 'expo-speech'; // expo-speech
import { MMKVLoader } from 'react-native-mmkv-storage'; // MMKV

// 導入自訂模組
import { GpxTrackManager } from '@/lib/gpx-track-manager'; // GPX 軌跡管理
import { TurnDetectionEngine } from '@/lib/turn-detection-engine'; // 轉彎判定引擎
import { ReroutingService } from '@/lib/rerouting-service'; // OSRM 重規劃服務
import { ForegroundServiceModule } from '@/lib/foreground-service-module'; // 原生 Foreground Service 橋接

// 儀表板組件 (待實現)
import { DashboardOverlay } from '@/components/dashboard-overlay';
// 頂部 UI 組件 (待實現)
import { TopNavigationUI } from '@/components/top-navigation-ui';

const mmkv = new MMKVLoader().initialize();

export default function NavigationScreen() {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const [currentLocation, setCurrentLocation] = useState<turf.Point | null>(null);
  const [gpxRoute, setGpxRoute] = useState<turf.Feature<turf.LineString> | null>(null);
  const [reroutePath, setReroutePath] = useState<turf.Feature<turf.LineString> | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    speed: 0, wattage: 0, distance: 0, time: 0
  });

  // 1. GPS 數據獲取與處理 (模擬)
  useEffect(() => {
    let watchId: number;
    if (isNavigating) {
      // 啟動 Foreground Service
      ForegroundServiceModule.startService();

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = turf.point([position.coords.longitude, position.coords.latitude]);
          setCurrentLocation(newLocation);

          // 實時寫入 MMKV
          mmkv.setMap('current_ride_data', {
            timestamp: Date.now(),
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed || 0,
            // ... 其他儀表板數據
          });

          // 更新儀表板數據 (簡化)
          setDashboardData(prev => ({
            ...prev,
            speed: position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0, // m/s to km/h
            distance: prev.distance + (position.coords.speed || 0) * 1, // 簡化距離計算
            time: prev.time + 1,
          }));

          // 轉彎判定與語音播報
          if (gpxRoute) {
            const turnInstruction = TurnDetectionEngine.detectTurn(newLocation, gpxRoute);
            if (turnInstruction) {
              Speech.speak(turnInstruction);
            }

            // 偏離檢測與重規劃
            if (TurnDetectionEngine.isOffRoute(newLocation, gpxRoute)) {
              ReroutingService.reroute(newLocation, gpxRoute).then(newPath => {
                setReroutePath(newPath);
                // 播報新路徑上的第一個轉彎指令
                const firstInstruction = TurnDetectionEngine.getFirstInstruction(newPath);
                if (firstInstruction) Speech.speak(firstInstruction);
              });
            }
          }
        },
        (error) => console.error("GPS Error:", error),
        { enableHighAccuracy: true, distanceFilter: 10, interval: 1000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (isNavigating) {
        ForegroundServiceModule.stopService();
      }
    };
  }, [isNavigating, gpxRoute]);

  // 2. 斷線恢復邏輯
  useEffect(() => {
    const restoreRide = async () => {
      const savedData = await mmkv.getMap('current_ride_data');
      if (savedData && savedData.timestamp) {
        // 提示用戶是否恢復騎乘
        // ... 恢復地圖軌跡、儀表板數據、導航進度
        console.log("檢測到未完成騎乘，恢復數據:", savedData);
        // setIsNavigating(true); // 根據用戶選擇決定是否自動恢復
      }
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
    const dummyGpx = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<gpx ...>
  <trk>
    <trkseg>
      <trkpt lat="25.0330" lon="121.5654"></trkpt>
      <trkpt lat="25.0335" lon="121.5660"></trkpt>
      <trkpt lat="25.0340" lon="121.5665"></trkpt>
      <!-- 更多點 -->
    </trkseg>
  </trk>
</gpx>`;
    const geoJson = GpxTrackManager.parseGpxToGeoJSON(dummyGpx);
    setGpxRoute(geoJson);
    setIsNavigating(true);
  }, []);

  return (
    <ScreenContainer containerClassName="bg-background">
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL="https://tiles.stadiamaps.com/styles/outdoors.json" // 或 OpenStreetMap 樣式
        initialCamera={{
          centerCoordinate: [121.5654, 25.0330],
          zoomLevel: 14,
          pitch: 60,
          heading: 0,
        }}
      >
        {gpxRoute && (
          <MapLibre.ShapeSource id="gpxSource" shape={gpxRoute}>
            <MapLibre.LineLayer
              id="gpxLine"
              style={{
                lineColor: colors.primary, // 深藍色
                lineWidth: 4,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            />
            {/* 動態方向箭頭 (待實現為 SymbolLayer) */}
          </MapLibre.ShapeSource>
        )}
        {reroutePath && (
          <MapLibre.ShapeSource id="rerouteSource" shape={reroutePath}>
            <MapLibre.LineLayer
              id="rerouteLine"
              style={{
                lineColor: colors.muted, // 淡灰色
                lineWidth: 3,
                lineDasharray: [2, 2],
              }}
            />
          </MapLibre.ShapeSource>
        )}
        {currentLocation && (
          <MapLibre.PointAnnotation
            id="userLocation"
            coordinate={currentLocation.geometry.coordinates}
          >
            {/* 藍色三角導航箭頭 (自訂組件) */}
            <View style={[styles.chevron, { backgroundColor: colors.primary }]} />
          </MapLibre.PointAnnotation>
        )}
      </MapView>

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
```

## 5. Turf.js 轉彎判定引擎 (`lib/turn-detection-engine.ts`)

```typescript
// lib/turn-detection-engine.ts

import * as turf from '@turf/turf';
import { Feature, LineString, Point } from '@turf/turf';

interface TurnInstruction {
  distance: number; // 距離轉彎點的距離 (米)
  direction: 'left' | 'right' | 'straight';
  text: string;
}

export class TurnDetectionEngine {
  private static readonly TURN_ANGLE_THRESHOLD = 45; // 轉彎角度閾值 (度)
  private static readonly LOOK_AHEAD_DISTANCE = 50; // 向前看距離 (米)
  private static readonly OFF_ROUTE_THRESHOLD = 50; // 偏離路線閾值 (米)

  /**
   * 檢測當前位置是否偏離路線。
   * @param currentLocation 當前 GPS 點位。
   * @param gpxRoute GPX 路線的 GeoJSON LineString。
   * @returns 是否偏離路線。
   */
  static isOffRoute(currentLocation: Point, gpxRoute: Feature<LineString>): boolean {
    const distance = turf.pointToLineDistance(currentLocation, gpxRoute, { units: 'meters' });
    return distance > TurnDetectionEngine.OFF_ROUTE_THRESHOLD;
  }

  /**
   * 檢測前方轉彎並生成語音指令。
   * @param currentLocation 當前 GPS 點位。
   * @param gpxRoute GPX 路線的 GeoJSON LineString。
   * @returns 轉彎指令或 null。
   */
  static detectTurn(currentLocation: Point, gpxRoute: Feature<LineString>): TurnInstruction | null {
    // 1. 找到當前位置在路線上的最近點
    const snapped = turf.nearestPointOnLine(gpxRoute, currentLocation);
    if (!snapped.properties || snapped.properties.index === undefined) return null;

    const routeCoordinates = gpxRoute.geometry.coordinates;
    const currentIndex = snapped.properties.index;

    // 2. 沿路線向前查找轉彎點
    let lookAheadPoint: Point | null = null;
    let lookAheadIndex = -1;
    let distanceToLookAhead = 0;

    for (let i = currentIndex + 1; i < routeCoordinates.length; i++) {
      const segment = turf.lineString([routeCoordinates[i - 1], routeCoordinates[i]]);
      const segmentLength = turf.length(segment, { units: 'meters' });
      distanceToLookAhead += segmentLength;

      if (distanceToLookAhead >= TurnDetectionEngine.LOOK_AHEAD_DISTANCE) {
        // 找到前方 LOOK_AHEAD_DISTANCE 處的點
        const fraction = (TurnDetectionEngine.LOOK_AHEAD_DISTANCE - (distanceToLookAhead - segmentLength)) / segmentLength;
        lookAheadPoint = turf.along(segment, fraction, { units: 'meters' });
        lookAheadIndex = i;
        break;
      }
    }

    if (!lookAheadPoint || lookAheadIndex === -1 || lookAheadIndex + 1 >= routeCoordinates.length) return null;

    // 3. 計算轉彎角度
    const prevPoint = turf.point(routeCoordinates[lookAheadIndex - 1]);
    const currentRoutePoint = turf.point(routeCoordinates[lookAheadIndex]);
    const nextPoint = turf.point(routeCoordinates[lookAheadIndex + 1]);

    const angle = turf.bearing(prevPoint, currentRoutePoint) - turf.bearing(currentRoutePoint, nextPoint);
    const normalizedAngle = (angle + 360) % 360; // 歸一化到 0-360 度

    if (Math.abs(normalizedAngle) > TurnDetectionEngine.TURN_ANGLE_THRESHOLD && Math.abs(normalizedAngle) < (360 - TurnDetectionEngine.TURN_ANGLE_THRESHOLD)) {
      let direction: 'left' | 'right' | 'straight' = 'straight';
      if (normalizedAngle > TurnDetectionEngine.TURN_ANGLE_THRESHOLD && normalizedAngle < 180) {
        direction = 'right';
      } else if (normalizedAngle > 180 && normalizedAngle < (360 - TurnDetectionEngine.TURN_ANGLE_THRESHOLD)) {
        direction = 'left';
      }

      const distanceToTurn = turf.distance(currentLocation, currentRoutePoint, { units: 'meters' });

      return {
        distance: Math.round(distanceToTurn),
        direction,
        text: `前方 ${Math.round(distanceToTurn)} 公尺，向${direction === 'left' ? '左' : '右'}轉`,
      };
    }

    return null;
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

// lib/gpx-track-manager.ts (輔助類，用於 GPX 解析)
import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@mapbox/togeojson';

export class GpxTrackManager {
  static parseGpxToGeoJSON(gpxString: string): Feature<LineString> {
    const parser = new DOMParser();
    const gpxDom = parser.parseFromString(gpxString, 'text/xml');
    const geoJson = toGeoJSON.gpx(gpxDom);

    // 假設 GPX 只有一條軌跡線
    if (geoJson.features.length > 0 && geoJson.features[0].geometry.type === 'LineString') {
      return geoJson.features[0] as Feature<LineString>;
    }
    throw new Error('Invalid GPX format or no LineString found.');
  }
}
```

## 6. GPS 數據流管理與 MMKV 集成

- **數據源**：`navigator.geolocation.watchPosition` 獲取實時 GPS 數據。
- **數據處理**：
  - 原始 GPS 數據傳遞給 `TurnDetectionEngine` 進行轉彎和偏離檢測。
  - 處理後的數據用於更新儀表板 (`dashboardData`)。
- **MMKV 寫入**：
  - 每 5-10 秒將當前 GPS 點位和儀表板關鍵數據序列化後寫入 MMKV。
  - 使用 `mmkv.setMap('current_ride_data', { ... })` 進行存儲。
- **MMKV 讀取**：
  - 應用啟動時，檢查 `mmkv.getMap('current_ride_data')`。
  - 如果存在數據，則提示用戶是否恢復騎乘，並根據用戶選擇還原狀態。

## 7. 待實現組件骨架

### 7.1. 儀表板懸浮化 (`components/dashboard-overlay.tsx`)

```tsx
// components/dashboard-overlay.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface DashboardOverlayProps {
  data: { speed: number; wattage: number; distance: number; time: number };
}

export function DashboardOverlay({ data }: DashboardOverlayProps) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface + 'E0' }]}> {/* 半透明背景 */}
      <Text style={[styles.speedText, { color: colors.foreground }]}>{data.speed} km/h</Text>
      <Text style={[styles.otherText, { color: colors.muted }]}>瓦數: {data.wattage} W</Text>
      <Text style={[styles.otherText, { color: colors.muted }]}>距離: {(data.distance / 1000).toFixed(1)} km</Text>
      <Text style={[styles.otherText, { color: colors.muted }]}>時間: {Math.floor(data.time / 60)}m {data.time % 60}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  speedText: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  otherText: {
    fontSize: 16,
    marginTop: 5,
  },
});
```

### 7.2. 頂部搜尋與轉彎提示 (`components/top-navigation-ui.tsx`)

```tsx
// components/top-navigation-ui.tsx
import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface TopNavigationUIProps {
  isNavigating: boolean;
  turnInstruction?: string; // 轉彎指令
  remainingDistance?: number; // 剩餘距離
}

export function TopNavigationUI({ isNavigating, turnInstruction, remainingDistance }: TopNavigationUIProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface + 'E0' }]}>
      {isNavigating ? (
        <View style={styles.turnInstructionContainer}>
          {/* 轉彎箭頭 (待實現) */}
          <Text style={[styles.turnInstructionText, { color: colors.foreground }]}>{turnInstruction || '直行'}</Text>
          {remainingDistance !== undefined && (
            <Text style={[styles.remainingDistanceText, { color: colors.muted }]}>{remainingDistance} 公尺</Text>
          )}
        </View>
      ) : (
        <TextInput
          style={[styles.searchBar, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]} 
          placeholder="搜尋地址或地點"
          placeholderTextColor={colors.muted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50, // 考慮 SafeArea
    left: 10,
    right: 10,
    padding: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchBar: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  turnInstructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  turnInstructionText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 10,
  },
  remainingDistanceText: {
    fontSize: 16,
    color: '#666',
  },
});
```

## 8. 待安裝依賴

```json
{
  "dependencies": {
    "@maplibre/maplibre-react-native": "^x.x.x", // 根據最新版本
    "@turf/turf": "^6.5.0",
    "expo-speech": "^x.x.x", // 根據最新版本
    "react-native-mmkv-storage": "^x.x.x", // 根據最新版本
    "@mapbox/togeojson": "^0.16.0", // 用於 GPX 解析
    "@xmldom/xmldom": "^0.8.10" // 用於 GPX 解析
  }
}
```

## 9. 結論

本架構設計基於開源免費原則，充分利用 MapLibre 的渲染能力、Turf.js 的本地空間分析、OSRM 的路由服務和 expo-speech 的語音播報，實現了高效、穩定且離線優先的導航系統。MMKV 和 Foreground Service 的引入將確保數據持久化和後台運行的可靠性。下一步將是實現原生模組和 Expo Config Plugin，並進行詳細的集成測試。

---

**Manus AI**
2026-07-01
