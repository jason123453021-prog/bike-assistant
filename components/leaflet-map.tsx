/**
 * LeafletMapView
 *
 * WebView-based map component using Leaflet.js + OpenStreetMap.
 * Replaces react-native-maps for Expo Go compatibility.
 *
 * Supports:
 * - Dark tile layer (CartoDB Dark Matter)
 * - Current position marker (blue dot)
 * - GPX route polyline (red)
 * - Passed route polyline (dark red)
 * - Live trail polyline (green)
 * - Return route polyline (orange)
 * - Start/end circle markers
 * - animateToPosition(lat, lon, zoom)
 * - fitToCoordinates(coords)
 * - onPanDrag callback
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, Platform } from "react-native";
import { WebView } from "react-native-webview";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LeafletMapProps {
  style?: object;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  onPanDrag?: () => void;
  onMapReady?: () => void;
  // Map data
  currentPos?: { lat: number; lon: number; heading: number } | null;
  gpxPolyline?: LatLng[];
  passedPolyline?: LatLng[];
  liveTrail?: LatLng[];
  returnPolyline?: LatLng[];
  isOffRoute?: boolean;
}

export interface LeafletMapHandle {
  animateCamera: (opts: { center: { latitude: number; longitude: number }; zoom?: number }, anim?: { duration: number }) => void;
  fitToCoordinates: (coords: LatLng[], opts?: { edgePadding?: { top: number; right: number; bottom: number; left: number }; animated?: boolean }) => void;
}

const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #0d0d1a; }
  .leaflet-container { background: #0d0d1a; }
</style>
</head>
<body>
<div id="map"></div>
<script>
// Init map
var map = L.map('map', {
  zoomControl: false,
  attributionControl: false,
  tap: true,
  dragging: true,
  touchZoom: true,
  doubleClickZoom: true,
  scrollWheelZoom: false,
}).setView([25.0478, 121.5319], 14);

// Dark tile layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  subdomains: 'abcd',
}).addTo(map);

// Layers
var gpxLayer = L.polyline([], { color: '#FF3B30', weight: 4, opacity: 0.9 }).addTo(map);
var passedLayer = L.polyline([], { color: '#8B0000', weight: 4, opacity: 0.9 }).addTo(map);
var trailLayer = L.polyline([], { color: '#00E676', weight: 3, opacity: 0.9 }).addTo(map);
var returnLayer = L.polyline([], { color: '#FF9500', weight: 4, opacity: 0.9 }).addTo(map);

// Markers
var posMarker = null;
var posAccMarker = null;
var startMarker = null;
var endMarker = null;
var returnEndMarker = null;

// Custom dot icon
function makeDotIcon(color, size, border) {
  return L.divIcon({
    className: '',
    html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';border:' + border + ';box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

function makeCircleIcon(color, size, borderColor) {
  return L.divIcon({
    className: '',
    html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';border:2.5px solid ' + borderColor + ';box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

// Pan drag detection
map.on('dragstart', function() {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'panDrag' }));
  }
});

// Message handler
function handleMessage(data) {
  try {
    var msg = JSON.parse(data);
    switch(msg.type) {
      case 'setCurrentPos':
        var lat = msg.lat, lon = msg.lon;
        // Accuracy circle
        if (posAccMarker) { map.removeLayer(posAccMarker); posAccMarker = null; }
        posAccMarker = L.circle([lat, lon], {
          radius: 30,
          color: 'rgba(0,122,255,0.3)',
          fillColor: 'rgba(0,122,255,0.15)',
          fillOpacity: 1,
          weight: 1,
        }).addTo(map);
        // Position dot
        if (posMarker) { map.removeLayer(posMarker); posMarker = null; }
        posMarker = L.marker([lat, lon], {
          icon: makeCircleIcon('#007AFF', 16, '#fff'),
          zIndexOffset: 1000,
        }).addTo(map);
        if (msg.follow) {
          map.setView([lat, lon], map.getZoom(), { animate: true, duration: 0.5 });
        }
        break;
      case 'setGpxPolyline':
        gpxLayer.setLatLngs(msg.coords);
        // Update start/end markers
        if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
        if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
        if (msg.coords.length > 0) {
          startMarker = L.marker(msg.coords[0], {
            icon: makeCircleIcon('#00C853', 16, '#fff'),
            zIndexOffset: 500,
          }).addTo(map);
        }
        if (msg.coords.length > 1) {
          endMarker = L.marker(msg.coords[msg.coords.length - 1], {
            icon: makeCircleIcon('#FF3B30', 16, '#fff'),
            zIndexOffset: 500,
          }).addTo(map);
        }
        break;
      case 'setPassedPolyline':
        passedLayer.setLatLngs(msg.coords);
        break;
      case 'setLiveTrail':
        trailLayer.setLatLngs(msg.coords);
        break;
      case 'setReturnPolyline':
        returnLayer.setLatLngs(msg.coords);
        if (returnEndMarker) { map.removeLayer(returnEndMarker); returnEndMarker = null; }
        if (msg.coords.length > 1) {
          returnEndMarker = L.circle(msg.coords[msg.coords.length - 1], {
            radius: 12,
            color: '#FF9500',
            fillColor: 'rgba(255,149,0,0.3)',
            fillOpacity: 1,
            weight: 2,
          }).addTo(map);
        }
        break;
      case 'clearReturnPolyline':
        returnLayer.setLatLngs([]);
        if (returnEndMarker) { map.removeLayer(returnEndMarker); returnEndMarker = null; }
        break;
      case 'animateCamera':
        map.setView([msg.lat, msg.lon], msg.zoom || map.getZoom(), { animate: true, duration: 0.6 });
        break;
      case 'fitToCoordinates':
        if (msg.coords && msg.coords.length > 0) {
          var bounds = L.latLngBounds(msg.coords);
          var pad = msg.padding || { top: 80, right: 40, bottom: 200, left: 40 };
          map.fitBounds(bounds, {
            paddingTopLeft: [pad.left, pad.top],
            paddingBottomRight: [pad.right, pad.bottom],
            animate: true,
            duration: 0.8,
          });
        }
        break;
      case 'setZoom':
        map.setZoom(msg.zoom);
        break;
    }
  } catch(e) {}
}

// Listen for messages from React Native
document.addEventListener('message', function(e) { handleMessage(e.data); });
window.addEventListener('message', function(e) { handleMessage(e.data); });

// Notify ready
setTimeout(function() {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  }
}, 300);
</script>
</body>
</html>`;

const LeafletMapView = forwardRef<LeafletMapHandle, LeafletMapProps>(
  (
    {
      style,
      initialRegion,
      onPanDrag,
      onMapReady,
      currentPos,
      gpxPolyline,
      passedPolyline,
      liveTrail,
      returnPolyline,
      isOffRoute,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    const followUserRef = useRef(true);

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      animateCamera: (opts, _anim) => {
        if (!webViewRef.current) return;
        followUserRef.current = true;
        webViewRef.current.postMessage(
          JSON.stringify({
            type: "animateCamera",
            lat: opts.center.latitude,
            lon: opts.center.longitude,
            zoom: opts.zoom ?? 17,
          })
        );
      },
      fitToCoordinates: (coords, opts) => {
        if (!webViewRef.current || coords.length === 0) return;
        followUserRef.current = false;
        const mapped = coords.map((c) => [c.latitude, c.longitude]);
        webViewRef.current.postMessage(
          JSON.stringify({
            type: "fitToCoordinates",
            coords: mapped,
            padding: opts?.edgePadding,
          })
        );
      },
    }));

    // Send current position
    useEffect(() => {
      if (!isReady || !webViewRef.current) return;
      if (currentPos) {
        webViewRef.current.postMessage(
          JSON.stringify({
            type: "setCurrentPos",
            lat: currentPos.lat,
            lon: currentPos.lon,
            follow: followUserRef.current,
          })
        );
      }
    }, [currentPos, isReady]);

    // Send GPX polyline
    useEffect(() => {
      if (!isReady || !webViewRef.current) return;
      const coords = (gpxPolyline ?? []).map((c) => [c.latitude, c.longitude]);
      webViewRef.current.postMessage(
        JSON.stringify({ type: "setGpxPolyline", coords })
      );
    }, [gpxPolyline, isReady]);

    // Send passed polyline
    useEffect(() => {
      if (!isReady || !webViewRef.current) return;
      const coords = (passedPolyline ?? []).map((c) => [c.latitude, c.longitude]);
      webViewRef.current.postMessage(
        JSON.stringify({ type: "setPassedPolyline", coords })
      );
    }, [passedPolyline, isReady]);

    // Send live trail
    useEffect(() => {
      if (!isReady || !webViewRef.current) return;
      const coords = (liveTrail ?? []).map((c) => [c.latitude, c.longitude]);
      webViewRef.current.postMessage(
        JSON.stringify({ type: "setLiveTrail", coords })
      );
    }, [liveTrail, isReady]);

    // Send return polyline
    useEffect(() => {
      if (!isReady || !webViewRef.current) return;
      if (!isOffRoute || !returnPolyline || returnPolyline.length === 0) {
        webViewRef.current.postMessage(
          JSON.stringify({ type: "clearReturnPolyline" })
        );
      } else {
        const coords = returnPolyline.map((c) => [c.latitude, c.longitude]);
        webViewRef.current.postMessage(
          JSON.stringify({ type: "setReturnPolyline", coords })
        );
      }
    }, [returnPolyline, isOffRoute, isReady]);

    const handleMessage = (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === "ready") {
          setIsReady(true);
          onMapReady?.();
          // Send initial region
          if (initialRegion && webViewRef.current) {
            const zoom = initialRegion.latitudeDelta
              ? Math.round(Math.log2(360 / initialRegion.latitudeDelta))
              : 14;
            webViewRef.current.postMessage(
              JSON.stringify({
                type: "animateCamera",
                lat: initialRegion.latitude,
                lon: initialRegion.longitude,
                zoom,
              })
            );
          }
        } else if (msg.type === "panDrag") {
          followUserRef.current = false;
          onPanDrag?.();
        }
      } catch {}
    };

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          style={styles.webView}
          source={{ html: LEAFLET_HTML }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          // Allow loading external resources (Leaflet CDN)
          mixedContentMode="always"
          allowsInlineMediaPlayback
          // Android: allow file access
          allowFileAccess
          allowUniversalAccessFromFileURLs
          // Disable built-in zoom controls
          scalesPageToFit={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }
);

LeafletMapView.displayName = "LeafletMapView";

export default LeafletMapView;

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  webView: {
    flex: 1,
    backgroundColor: "#0d0d1a",
  },
});
