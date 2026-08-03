/**
 * EnhancedLeafletMap
 *
 * 增強版 Leaflet 地圖組件，包含：
 * - OSRM 導航路線規劃
 * - 離線防護與崩潰攔截
 * - 錯誤邊界
 * - 完整的 GPS、GPX、實時軌跡支援
 */

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";
import { StyleSheet, View, Platform, ActivityIndicator, Text } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useColors } from "@/hooks/use-colors";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface EnhancedMapRef {
  animateToPosition: (lat: number, lon: number, zoom?: number) => void;
  fitToCoordinates: (coords: LatLng[]) => void;
  addGPXRoute: (coordinates: LatLng[], color?: string) => void;
  addLiveTrail: (coordinates: LatLng[]) => void;
  addOSRMRoute: (startLat: number, startLon: number, endLat: number, endLon: number) => void;
  clearRoutes: () => void;
  setCurrentPosition: (lat: number, lon: number, heading?: number) => void;
}

interface MapState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
}

const EnhancedLeafletMap = forwardRef<EnhancedMapRef, { style?: any }>(({ style }, ref) => {
  const colors = useColors();
  const webViewRef = useRef<WebView>(null);
  const [mapState, setMapState] = useState<MapState>({
    isLoading: true,
    hasError: false,
    errorMessage: "",
  });

  // 生成 Leaflet HTML
  const generateMapHTML = useCallback(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/@turf/turf@6/turf.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .loading { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: #1a1a1a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    try {
      // 初始化地圖
      const map = L.map('map').setView([22.3193, 114.1694], 13);
      
      // 添加 CartoDB Dark Matter 瓦片層
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors, © CartoDB',
        maxZoom: 19,
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      }).addTo(map);

      // 存儲所有圖層
      const layers = {
        gpxRoute: null,
        liveTrail: null,
        osrmRoute: null,
        currentMarker: null,
        markers: []
      };

      // 處理來自 React Native 的消息
      window.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch(data.type) {
            case 'animateToPosition':
              map.flyTo([data.lat, data.lon], data.zoom || 15, { duration: 1 });
              break;
              
            case 'fitToCoordinates':
              if (data.coords && data.coords.length > 0) {
                const bounds = L.latLngBounds(data.coords.map(c => [c.latitude, c.longitude]));
                map.fitBounds(bounds, { padding: [50, 50] });
              }
              break;
              
            case 'addGPXRoute':
              if (layers.gpxRoute) map.removeLayer(layers.gpxRoute);
              const gpxCoords = data.coordinates.map(c => [c.latitude, c.longitude]);
              layers.gpxRoute = L.polyline(gpxCoords, {
                color: data.color || '#FF0000',
                weight: 3,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);
              break;
              
            case 'addLiveTrail':
              if (layers.liveTrail) map.removeLayer(layers.liveTrail);
              const liveCoords = data.coordinates.map(c => [c.latitude, c.longitude]);
              layers.liveTrail = L.polyline(liveCoords, {
                color: '#00FF00',
                weight: 2,
                opacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);
              break;
              
            case 'addOSRMRoute':
              // 調用 OSRM 服務獲取路線
              const osrmUrl = \`https://router.project-osrm.org/route/v1/bike/\${data.startLon},\${data.startLat};\${data.endLon},\${data.endLat}?overview=full&geometries=geojson\`;
              fetch(osrmUrl)
                .then(r => r.json())
                .then(result => {
                  if (result.routes && result.routes[0]) {
                    if (layers.osrmRoute) map.removeLayer(layers.osrmRoute);
                    const routeCoords = result.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                    layers.osrmRoute = L.polyline(routeCoords, {
                      color: '#0066FF',
                      weight: 3,
                      opacity: 0.8,
                      lineCap: 'round',
                      lineJoin: 'round'
                    }).addTo(map);
                  }
                })
                .catch(err => console.error('OSRM Error:', err));
              break;
              
            case 'setCurrentPosition':
              if (layers.currentMarker) map.removeLayer(layers.currentMarker);
              layers.currentMarker = L.circleMarker([data.lat, data.lon], {
                radius: 8,
                fillColor: '#0066FF',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
              }).addTo(map);
              break;
              
            case 'clearRoutes':
              [layers.gpxRoute, layers.liveTrail, layers.osrmRoute].forEach(layer => {
                if (layer) map.removeLayer(layer);
              });
              layers.gpxRoute = null;
              layers.liveTrail = null;
              layers.osrmRoute = null;
              break;
          }
        } catch (err) {
          console.error('Map Error:', err);
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'error',
            message: err.message
          }));
        }
      });

      // 地圖加載完成
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ready' }));
    } catch (err) {
      console.error('Map Init Error:', err);
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'error',
        message: err.message
      }));
    }
  </script>
</body>
</html>
    `;
  }, []);

  // 處理 WebView 消息
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === "ready") {
        setMapState({ isLoading: false, hasError: false, errorMessage: "" });
      } else if (data.type === "error") {
        setMapState({
          isLoading: false,
          hasError: true,
          errorMessage: data.message || "地圖初始化失敗",
        });
      }
    } catch (err) {
      console.error("WebView Message Error:", err);
    }
  };

  // 暴露 API 給外部組件
  useImperativeHandle(ref, () => ({
    animateToPosition: (lat: number, lon: number, zoom?: number) => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({type: 'animateToPosition', lat: ${lat}, lon: ${lon}, zoom: ${zoom || 15}}), '*');`
      );
    },
    fitToCoordinates: (coords: LatLng[]) => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({type: 'fitToCoordinates', coords: ${JSON.stringify(coords)}}), '*');`
      );
    },
    addGPXRoute: (coordinates: LatLng[], color?: string) => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({type: 'addGPXRoute', coordinates: ${JSON.stringify(coordinates)}, color: '${color || "#FF0000"}'}), '*');`
      );
    },
    addLiveTrail: (coordinates: LatLng[]) => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({type: 'addLiveTrail', coordinates: ${JSON.stringify(coordinates)}}), '*');`
      );
    },
    addOSRMRoute: (startLat: number, startLon: number, endLat: number, endLon: number) => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({type: 'addOSRMRoute', startLat: ${startLat}, startLon: ${startLon}, endLat: ${endLat}, endLon: ${endLon}}), '*');`
      );
    },
    clearRoutes: () => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({type: 'clearRoutes'}), '*');`
      );
    },
    setCurrentPosition: (lat: number, lon: number, heading?: number) => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({type: 'setCurrentPosition', lat: ${lat}, lon: ${lon}, heading: ${heading || 0}}), '*');`
      );
    },
  }), []);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.webView}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        scrollEnabled={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setMapState({
            isLoading: false,
            hasError: true,
            errorMessage: nativeEvent.description || "地圖加載失敗",
          });
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>
              加載地圖中...
            </Text>
          </View>
        )}
      />
      
      {mapState.hasError && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {mapState.errorMessage}
          </Text>
        </View>
      )}
    </View>
  );
});

EnhancedLeafletMap.displayName = "EnhancedLeafletMap";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  webView: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
});

export default EnhancedLeafletMap;
