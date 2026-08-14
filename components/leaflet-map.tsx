/**
 * LeafletMapView
 *
 * WebView-based map component using Leaflet.js + OpenStreetMap.
 * Uses Leaflet in a WebView for Expo Go compatibility.
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
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** 顯示於地圖的導航路徑圖層；每個圖層各自管理折線、起訖點與方向箭頭。 */
export interface NavigationRouteOverlay {
  id: string;
  coordinates: LatLng[];
  color: string;
  showDirectionArrows?: boolean;
}

export interface KilometerMarker {
  kilometer: number;
  lat: number;
  lon: number;
  elevation: number;
}

/** 由本機 EXIF 或拍攝時間與 GPS 軌跡對應後顯示的照片標記。 */
export interface PhotoMapMarker {
  id: string;
  lat: number;
  lon: number;
  altitude?: number;
  label: string;
  source: "exif" | "route-time";
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
  onMapLongPress?: (lat: number, lon: number) => void;
  // Map data
  currentPos?: { lat: number; lon: number; heading: number } | null;
  gpxPolyline?: LatLng[];
  routeOverlays?: NavigationRouteOverlay[];
  passedPolyline?: LatLng[];
  liveTrail?: LatLng[];
  returnPolyline?: LatLng[];
  isOffRoute?: boolean;
  centerPinLocation?: { lat: number; lon: number } | null;
  onMapCenterChanged?: (lat: number, lon: number) => void;
  onMapMoveEnd?: (bounds: { northEast: { lat: number; lon: number }; southWest: { lat: number; lon: number } }) => void;
  kilometersMarkers?: KilometerMarker[];
  photoMarkers?: PhotoMapMarker[];
  onPhotoMarkerPress?: (id: string) => void;
}

export interface LeafletMapHandle {
  animateCamera: (opts: { center: { latitude: number; longitude: number }; zoom?: number }, anim?: { duration: number }) => void;
  fitToCoordinates: (coords: LatLng[], opts?: { edgePadding?: { top: number; right: number; bottom: number; left: number }; animated?: boolean }) => void;
  clearNavigationGraphics: () => void;
  setBearing: (bearing: number, headingUp: boolean) => void;
  setPitch: (pitch: number) => void; // 俯視角設定 (0-60 度)
  setPlaybackMarker: (lat: number, lon: number, color: string) => void; // 彩色回放標點
  animatePlaybackMarker: (lat: number, lon: number, color: string, duration: number) => void; // 平滑動畫回放標點
  highlightPlayedTrail: (coords: LatLng[], color?: string) => void; // 高亮已走過的軌跡
  addDirectionArrows: (coords: LatLng[], color?: string, interval?: number) => void; // 添加方向箭头
  refreshBaseTiles: () => void;
}

const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/leaflet-rotate@0.2.7/dist/leaflet-rotate-src.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #f5f3ee; }
  .leaflet-container { background: #f5f3ee; }
  /* 車頭方向指示器 - 改稱圓點 */
    .heading-arrow {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #007AFF;
      filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
    }
    .marker-cluster-small {
      background-color: rgba(181, 226, 140, 0.6);
    }
    .marker-cluster-small div {
      background-color: rgba(110, 204, 57, 0.6);
    }
    .marker-cluster-medium {
      background-color: rgba(241, 211, 87, 0.6);
    }
    .marker-cluster-medium div {
      background-color: rgba(240, 194, 12, 0.6);
    }
    .marker-cluster-large {
      background-color: rgba(253, 156, 115, 0.6);
    }
    .marker-cluster-large div {
      background-color: rgba(241, 128, 23, 0.6);
    }

    .marker-cluster {
      background-clip: padding-box;
      border-radius: 20px;
    }
    .marker-cluster div {
      width: 30px;
      height: 30px;
      margin-left: 5px;
      margin-top: 5px;

      text-align: center;
      border-radius: 15px;
      font: 12px "Helvetica Neue", Arial, Helvetica, sans-serif;
    }
    .marker-cluster span {
      line-height: 30px;
    }
</style>
</head>
<body>
<div id="map"></div>
    <script>
    // Init map (with leaflet-rotate plugin)
var map = L.map('map', {
  zoomControl: false,
  attributionControl: false,
  tap: true,
  dragging: true,
  touchZoom: true,
  doubleClickZoom: true,
  scrollWheelZoom: false,
  rotate: true,        // leaflet-rotate: enable bearing rotation
  touchRotate: true,    // leaflet-rotate: enable two-finger rotation gesture
  rotateControl: false, // hide built-in rotate control UI
  bearing: 0,
}).setView([25.0478, 121.5319], 14);

var currentBearing = 0;
var headingUpMode = false;

// Tile layer: CartoDB Voyager (bright roads, good contrast for cycling)
var baseTileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
var baseTileLayer = L.tileLayer(baseTileUrl, {
  maxZoom: 19,
  subdomains: 'abcd',
}).addTo(map);

function refreshBaseTiles() {
  // 重新抓取上游圖磚，保留目前中心點、縮放及旋轉角度。
  baseTileLayer.setUrl(baseTileUrl + '?refresh=' + Date.now());
}

// Layers
var gpxLayer = L.polyline([], { color: '#FF3B30', weight: 4, opacity: 0.9 }).addTo(map);
var passedLayer = L.polyline([], { color: '#8B0000', weight: 4, opacity: 0.9 }).addTo(map);
var trailLayer = L.polyline([], { color: '#00E676', weight: 3, opacity: 0.9 }).addTo(map);
var returnLayer = L.polyline([], { color: '#FF9500', weight: 4, opacity: 0.9 }).addTo(map);
var routeOverlayPolylines = [];
var routeOverlayArrowMarkers = [];
var routeOverlayEndpointMarkers = [];
var arrowMarkers = [];

function clearRouteOverlays() {
  routeOverlayPolylines.forEach(function(layer) { map.removeLayer(layer); });
  routeOverlayArrowMarkers.forEach(function(marker) { map.removeLayer(marker); });
  routeOverlayEndpointMarkers.forEach(function(marker) { map.removeLayer(marker); });
  routeOverlayPolylines = [];
  routeOverlayArrowMarkers = [];
  routeOverlayEndpointMarkers = [];

  // 同步移除舊版單一路徑的折線與起訖標記，避免切換模式後殘留。
  gpxLayer.setLatLngs([]);
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }

  // 清理舊版 setGpxPolyline 留下、未保存引用的小方向箭頭。
  var legacyArrows = [];
  map.eachLayer(function(layer) {
    var className = layer && layer.options && layer.options.icon && layer.options.icon.options
      ? layer.options.icon.options.className
      : '';
    if (className === 'gpx-arrow' || className === 'route-direction-arrow') legacyArrows.push(layer);
  });
  legacyArrows.forEach(function(marker) { map.removeLayer(marker); });
}

// 由 React Native 的「清除所有導航圖層」動作直接呼叫；避免等待 state 渲染期間殘留數字或折線。
function clearNavigationGraphics() {
  clearRouteOverlays();
  passedLayer.setLatLngs([]);
  returnLayer.setLatLngs([]);
  if (returnEndMarker) { map.removeLayer(returnEndMarker); returnEndMarker = null; }
  arrowMarkers.forEach(function(marker) { map.removeLayer(marker); });
  arrowMarkers = [];
  kilometerMarkersLayer.forEach(function(marker) { map.removeLayer(marker); });
  kilometerMarkersLayer = [];
}

function renderRouteOverlays(layers) {
  clearRouteOverlays();
  (layers || []).forEach(function(route) {
    var coords = route.coords || [];
    if (!coords.length) return;
    var color = route.color || '#FF3B30';
    var polyline = L.polyline(coords, { color: color, weight: 4, opacity: 0.9 }).addTo(map);
    routeOverlayPolylines.push(polyline);

    var start = L.marker(coords[0], {
      icon: makeCircleIcon(color, 14, '#fff'),
      zIndexOffset: 500,
    }).addTo(map);
    routeOverlayEndpointMarkers.push(start);
    if (coords.length > 1) {
      var end = L.marker(coords[coords.length - 1], {
        icon: makeCircleIcon(color, 14, '#fff'),
        zIndexOffset: 500,
      }).addTo(map);
      routeOverlayEndpointMarkers.push(end);
    }

    if (!route.showDirectionArrows || coords.length < 2) return;
    var interval = Math.max(1, Math.floor(coords.length / 12));
    if (coords.length < 30) interval = Math.max(1, Math.floor(coords.length / 3));
    if (coords.length > 500) interval = Math.ceil(coords.length / 20);
    for (var i = interval; i < coords.length; i += interval) {
      var prev = coords[i - 1];
      var curr = coords[i];
      var bearing = Math.atan2(curr[1] - prev[1], curr[0] - prev[0]) * 180 / Math.PI;
      var arrowIcon = L.divIcon({
        html: '<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid ' + color + ';transform:rotate(' + bearing + 'deg);"></div>',
        iconSize: [10, 8],
        className: 'route-direction-arrow'
      });
      var arrow = L.marker(curr, { icon: arrowIcon, zIndexOffset: 100 }).addTo(map);
      routeOverlayArrowMarkers.push(arrow);
    }
  });
}

// 里程標記層
var kilometerMarkers = [];
function makeKilometerIcon(km) {
  return L.divIcon({
    html: '<div style="width: 32px; height: 32px; background-color: #007AFF; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 2px solid white;"><span>' + km + '</span></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: 'kilometer-marker-icon'
  });
}

// Markers
var posMarker = null;
var posAccMarker = null;
var startMarker = null;
var kilometerMarkersLayer = [];
var endMarker = null;
var returnEndMarker = null;
var centerPinMarker = null; // 中心圖釘標記

// 更新位置標記（顯示方向箭頭）
var directionArrowMarker = null;
var headingUpMode = false;
function updatePosMarkerWithHeading(bearing) {
  if (!posMarker) return;
  var lat = posMarker.getLatLng().lat;
  var lon = posMarker.getLatLng().lng;
  map.removeLayer(posMarker);
  posMarker = null;
  if (bearing !== null && bearing !== undefined) {
    if (directionArrowMarker) { map.removeLayer(directionArrowMarker); directionArrowMarker = null; }
    var arrowBearing = headingUpMode ? 0 : bearing;
    var arrowIcon = L.divIcon({
      html: '<div style="width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-bottom: 20px solid #007AFF; transform: rotate(' + arrowBearing + 'deg); filter: drop-shadow(0 0 3px rgba(0,0,0,0.6));"></div>',
      iconSize: [24, 20],
      iconAnchor: [12, 10],
      className: 'direction-arrow-large'
    });
    directionArrowMarker = L.marker([lat, lon], { icon: arrowIcon, zIndexOffset: 1000 }).addTo(map);
  } else {
    if (directionArrowMarker) { map.removeLayer(directionArrowMarker); directionArrowMarker = null; }
    posMarker = L.marker([lat, lon], {
      icon: makeCircleIcon('#007AFF', 16, '#fff'),
      zIndexOffset: 1000,
    }).addTo(map);
  }
}

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

// Pan drag detection and center pin update
map.on('dragstart', function() {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'panDrag' }));
  }
});

// Update center pin location when map is dragged
map.on('drag', function() {
  var center = map.getCenter();
  if (window.ReactNativeWebView && centerPinMarker) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'mapCenterChanged',
      lat: center.lat,
      lon: center.lng
    }));
  }
});

map.on('dragend', function() {
  var center = map.getCenter();
  if (window.ReactNativeWebView && centerPinMarker) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'mapCenterChanged',
      lat: center.lat,
      lon: center.lng
    }));
  }
  if (window.ReactNativeWebView) {
    var bounds = map.getBounds();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'mapMoveEnd',
      northEast: { lat: bounds.getNorthEast().lat, lon: bounds.getNorthEast().lng },
      southWest: { lat: bounds.getSouthWest().lat, lon: bounds.getSouthWest().lng }
    }));
  }
});

map.on('zoomend', function() {
  if (window.ReactNativeWebView) {
    var bounds = map.getBounds();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'mapMoveEnd',
      northEast: { lat: bounds.getNorthEast().lat, lon: bounds.getNorthEast().lng },
      southWest: { lat: bounds.getSouthWest().lat, lon: bounds.getSouthWest().lng }
    }));
  }
});

// Long press detection (700ms hold)
var longPressTimer = null;
var longPressStart = null;
var longPressCoord = null;
var MIN_DRAG_DISTANCE = 15; // pixels

function startLongPress(e) {
  var clientX = e.originalEvent.clientX || (e.originalEvent.touches && e.originalEvent.touches[0].clientX);
  var clientY = e.originalEvent.clientY || (e.originalEvent.touches && e.originalEvent.touches[0].clientY);
  longPressStart = { x: clientX, y: clientY };
  longPressCoord = e.latlng;
  longPressTimer = setTimeout(function() {
    if (window.ReactNativeWebView && longPressCoord) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapLongPress',
        lat: longPressCoord.lat,
        lon: longPressCoord.lng
      }));
    }
  }, 700);
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  longPressStart = null;
  longPressCoord = null;
}

function checkDragDistance(e) {
  if (longPressStart) {
    var clientX = e.originalEvent.clientX || (e.originalEvent.touches && e.originalEvent.touches[0].clientX);
    var clientY = e.originalEvent.clientY || (e.originalEvent.touches && e.originalEvent.touches[0].clientY);
    var dx = clientX - longPressStart.x;
    var dy = clientY - longPressStart.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MIN_DRAG_DISTANCE && longPressTimer) {
      cancelLongPress();
    }
  }
}

map.on('mousedown', startLongPress);
map.on('mousemove', checkDragDistance);
map.on('mouseup', cancelLongPress);
map.on('mouseleave', cancelLongPress);

map.on('touchstart', startLongPress);
map.on('touchmove', checkDragDistance);
map.on('touchend', cancelLongPress);
map.on('touchcancel', cancelLongPress);
map.on('touchleave', cancelLongPress);

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
        // Position marker with direction arrow
        if (posMarker) { map.removeLayer(posMarker); posMarker = null; }
        // 如果有 heading，顯示方向箭頭；否則顯示藍點
        if (msg.heading !== undefined && msg.heading !== null) {
          if (directionArrowMarker) { map.removeLayer(directionArrowMarker); directionArrowMarker = null; }
          var arrowBearing = headingUpMode ? 0 : msg.heading;
          var arrowHtml = '<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;transform:rotate(' + arrowBearing + 'deg);transition:transform 200ms ease-out;"><svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><defs><style>.arrow-fill{fill:#007AFF;}.arrow-stroke{stroke:#fff;stroke-width:1;}</style></defs><path class="arrow-fill arrow-stroke" d="M16 2 L28 28 L16 22 L4 28 Z"/></svg></div>';
          var arrowIcon = L.divIcon({
            html: arrowHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            className: 'direction-arrow-responsive'
          });
          directionArrowMarker = L.marker([lat, lon], { icon: arrowIcon, zIndexOffset: 1000 }).addTo(map);
        } else {
          posMarker = L.marker([lat, lon], {
            icon: makeCircleIcon('#007AFF', 16, '#fff'),
            zIndexOffset: 1000,
          }).addTo(map);
        }
        // 車頭朝前模式：同步地圖方向
        if (headingUpMode && msg.heading !== undefined && msg.heading !== null) {
          if (typeof map.setBearing === 'function') {
            map.setBearing(msg.heading);
          }
        }
        if (msg.follow) {
          map.setView([lat, lon], map.getZoom(), { animate: true, duration: 0.5 });
        }
        break;
      case 'setGpxPolyline':
        renderRouteOverlays([{ id: 'legacy', coords: msg.coords || [], color: '#FF3B30', showDirectionArrows: true }]);
        break;
      case 'setRouteOverlays':
        renderRouteOverlays(msg.layers || []);
        break;
      case 'clearNavigationGraphics':
        clearNavigationGraphics();
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
      case 'setBearing':
        // Use leaflet-rotate plugin's native setBearing API
        var deg = msg.bearing || 0;
        headingUpMode = msg.headingUp;
        currentBearing = deg;
        if (msg.headingUp) {
          // Rotate the map so vehicle heading points up
          if (typeof map.setBearing === 'function') {
            map.setBearing(deg);
          }
          // Update position marker with direction arrow
          updatePosMarkerWithHeading(deg);
        } else {
          // Reset to north-up
          if (typeof map.setBearing === 'function') {
            map.setBearing(0);
          }
          updatePosMarkerWithHeading(null);
        }
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
      case 'setPitch':
        var pitch = msg.pitch || 0;
        if (typeof map.setPitch === 'function') {
          map.setPitch(pitch);
        }
        break;
      case 'setPlaybackMarker':
        var lat = msg.lat, lon = msg.lon, color = msg.color || '#007AFF';
        if (posMarker) {
          posMarker.setLatLng([lat, lon]);
          posMarker.setIcon(makeCircleIcon(color, 16, '#fff'));
        } else {
          posMarker = L.marker([lat, lon], {
            icon: makeCircleIcon(color, 16, '#fff'),
            zIndexOffset: 1000,
          }).addTo(map);
        }
        break;
      case 'animatePlaybackMarker':
        var lat = msg.lat, lon = msg.lon, color = msg.color || '#007AFF', duration = msg.duration || 100;
        if (posMarker) {
          posMarker.setLatLng([lat, lon]);
          posMarker.setIcon(makeCircleIcon(color, 16, '#fff'));
        } else {
          posMarker = L.marker([lat, lon], {
            icon: makeCircleIcon(color, 16, '#fff'),
            zIndexOffset: 1000,
          }).addTo(map);
        }
        break;
      case 'highlightPlayedTrail':
        var coords = msg.coords || [];
        var color = msg.color || '#10B981';
        if (highlightedTrailPolyline) { map.removeLayer(highlightedTrailPolyline); highlightedTrailPolyline = null; }
        if (coords.length > 0) {
          highlightedTrailPolyline = L.polyline(coords, {
            color: color,
            weight: 5,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round',
            zIndexOffset: 500,
          }).addTo(map);
        }
        break;
      case 'addDirectionArrows':
        var coords = msg.coords || [];
        var color = msg.color || '#10B981';
        var interval = msg.interval || 10;
        if (arrowMarkers) {
          arrowMarkers.forEach(function(marker) { map.removeLayer(marker); });
          arrowMarkers = [];
        }
        for (var i = interval; i < coords.length; i += interval) {
          var prev = coords[i - 1];
          var curr = coords[i];
          var bearing = Math.atan2(curr[1] - prev[1], curr[0] - prev[0]) * 180 / Math.PI;
          var arrowIcon = L.divIcon({
            html: '<div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 10px solid ' + color + '; transform: rotate(' + bearing + 'deg);"></div>',
            iconSize: [12, 10],
            className: 'arrow-icon'
          });
          var arrowMarker = L.marker(curr, { icon: arrowIcon }).addTo(map);
          arrowMarkers.push(arrowMarker);
        }
        break;
      case 'setCenterPin':
        if (centerPinMarker) { map.removeLayer(centerPinMarker); centerPinMarker = null; }
        if (msg.lat && msg.lon) {
          centerPinMarker = L.marker([msg.lat, msg.lon], {
            icon: makeCircleIcon('#FFD60A', 20, '#fff'),
            zIndexOffset: 900,
          }).addTo(map);
        }
        break;
      case 'setKilometerMarkers':
        // 移除舊的里程標記
        kilometerMarkersLayer.forEach(function(marker) { map.removeLayer(marker); });
        kilometerMarkersLayer = [];
        // 添加新的里程標記
        var markers = msg.markers || [];
        markers.forEach(function(m) {
          var marker = L.marker([m.lat, m.lon], {
            icon: makeKilometerIcon(m.kilometer),
            zIndexOffset: 600,
            title: m.kilometer + ' km (高度: ' + m.elevation + 'm)'
          }).addTo(map);
          kilometerMarkersLayer.push(marker);
        });
        break;
      case 'setPhotoMarkers':
        photoMarkersLayer.forEach(function(marker) { map.removeLayer(marker); });
        photoMarkersLayer = [];
        (msg.markers || []).forEach(function(photo) {
          if (!Number.isFinite(photo.lat) || !Number.isFinite(photo.lon)) return;
          var photoIcon = L.divIcon({
            html: '<div style="width:30px;height:30px;border-radius:15px;background:#FF8A4C;border:2px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-size:15px;">&#128247;</div>',
            iconSize: [30, 30], iconAnchor: [15, 15], className: 'photo-route-marker'
          });
          var photoMarker = L.marker([photo.lat, photo.lon], { icon: photoIcon, zIndexOffset: 650 }).addTo(map);
          photoMarker.on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'photoMarkerPress', id: photo.id }));
          });
          photoMarkersLayer.push(photoMarker);
        });
        break;
      case 'setHeadingUpMode':
        headingUpMode = msg.enabled || false;
        break;
      case 'refreshBaseTiles':
        refreshBaseTiles();
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
      onMapLongPress,
      currentPos,
      gpxPolyline,
      routeOverlays,
      passedPolyline,
      liveTrail,
      returnPolyline,
      isOffRoute,
      centerPinLocation,
      onMapCenterChanged,
      kilometersMarkers,
      onMapMoveEnd,
      photoMarkers,
      onPhotoMarkerPress,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    const followUserRef = useRef(true);

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      setBearing: (bearing: number, headingUp: boolean) => {
        if (!webViewRef.current) return;
        webViewRef.current.postMessage(
          JSON.stringify({ type: "setBearing", bearing, headingUp })
        );
        webViewRef.current.postMessage(
          JSON.stringify({ type: "setHeadingUpMode", enabled: headingUp })
        );
      },
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
      clearNavigationGraphics: () => {
        if (!webViewRef.current) return;
        webViewRef.current.postMessage(JSON.stringify({ type: "clearNavigationGraphics" }));
      },
      setPitch: (pitch: number) => {
        if (!webViewRef.current) return;
        webViewRef.current.postMessage(
          JSON.stringify({ type: "setPitch", pitch: Math.max(0, Math.min(60, pitch)) })
        );
      },
      setPlaybackMarker: (lat: number, lon: number, color: string) => {
        if (!webViewRef.current) return;
        webViewRef.current.postMessage(
          JSON.stringify({ type: "setPlaybackMarker", lat, lon, color })
        );
      },
      animatePlaybackMarker: (lat: number, lon: number, color: string, duration: number) => {
        if (!webViewRef.current) return;
        webViewRef.current.postMessage(
          JSON.stringify({ type: "animatePlaybackMarker", lat, lon, color, duration })
        );
      },
      highlightPlayedTrail: (coords: LatLng[], color = '#10B981') => {
        if (!webViewRef.current) return;
        const mapped = coords.map((c) => [c.latitude, c.longitude]);
        webViewRef.current.postMessage(
          JSON.stringify({ type: "highlightPlayedTrail", coords: mapped, color })
        );
      },
      addDirectionArrows: (coords: LatLng[], color = '#10B981', interval = 10) => {
        if (!webViewRef.current) return;
        const mapped = coords.map((c) => [c.latitude, c.longitude]);
        webViewRef.current.postMessage(
          JSON.stringify({ type: "addDirectionArrows", coords: mapped, color, interval })
        );
      },
      refreshBaseTiles: () => {
        if (!webViewRef.current) return;
        webViewRef.current.postMessage(JSON.stringify({ type: "refreshBaseTiles" }));
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
            heading: currentPos.heading,
            follow: followUserRef.current,
          })
        );
      }
    }, [currentPos, isReady]);

    // Send route overlays. When supplied, this replaces the legacy single GPX layer.
    useEffect(() => {
      if (!isReady || !webViewRef.current) return;
      if (routeOverlays !== undefined) {
        webViewRef.current.postMessage(
          JSON.stringify({
            type: "setRouteOverlays",
            layers: routeOverlays.map((route) => ({
              id: route.id,
              coords: route.coordinates.map((c) => [c.latitude, c.longitude]),
              color: route.color,
              showDirectionArrows: route.showDirectionArrows ?? false,
            })),
          }),
        );
        return;
      }
      const coords = (gpxPolyline ?? []).map((c) => [c.latitude, c.longitude]);
      webViewRef.current.postMessage(
        JSON.stringify({ type: "setGpxPolyline", coords })
      );
    }, [gpxPolyline, isReady, routeOverlays]);

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

    // Send kilometer markers (supports clearing when empty)
    useEffect(() => {
      if (!isReady || !webViewRef.current) return;
      webViewRef.current.postMessage(
        JSON.stringify({ type: "setKilometerMarkers", markers: kilometersMarkers || [] })
      );
    }, [kilometersMarkers, isReady]);

    useEffect(() => {
      if (!isReady || !webViewRef.current) return;
      webViewRef.current.postMessage(
        JSON.stringify({ type: "setPhotoMarkers", markers: photoMarkers || [] })
      );
    }, [photoMarkers, isReady]);

    // Send center pin location
    useEffect(() => {
      if (!isReady || !webViewRef.current) return;
      if (centerPinLocation) {
        webViewRef.current.postMessage(
          JSON.stringify({ type: "setCenterPin", lat: centerPinLocation.lat, lon: centerPinLocation.lon })
        );
      } else {
        webViewRef.current.postMessage(
          JSON.stringify({ type: "setCenterPin", lat: null, lon: null })
        );
      }
    }, [centerPinLocation, isReady]);

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
        } else if (msg.type === "mapLongPress") {
          onMapLongPress?.(msg.lat, msg.lon);
        } else if (msg.type === "mapCenterChanged") {
          onMapCenterChanged?.(msg.lat, msg.lon);
        } else if (msg.type === "mapMoveEnd") {
          onMapMoveEnd?.({
            northEast: { lat: msg.northEast.lat, lon: msg.northEast.lon },
            southWest: { lat: msg.southWest.lat, lon: msg.southWest.lon },
          });
        } else if (msg.type === "photoMarkerPress" && typeof msg.id === "string") {
          onPhotoMarkerPress?.(msg.id);
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
