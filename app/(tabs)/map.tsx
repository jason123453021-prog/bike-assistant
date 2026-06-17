/**
 * 地圖導航頁面
 *
 * 功能：
 * - 全螢幕深色地圖（react-native-maps）
 * - 即時位置標記（藍點 + 方向扇形）
 * - GPX 路線疊加（紅色軌跡）
 * - 自由騎乘即時軌跡繪製（綠色）
 * - GPX 導航語音播報（偏離提示、轉彎提示、到達提示）
 * - 底部面板：騎乘時間、速度、距離、均速、坡度
 * - 回到定位按鈕
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Circle, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/use-colors";
import { useRide } from "@/lib/ride-context";
import { parseGpx, GpxPoint, GpxRoute } from "@/lib/gpx-parser";
import { speak, vibrateLight, vibrateMedium } from "@/lib/feedback-service";
import { useSettings } from "@/lib/settings-context";
import { IconSymbol } from "@/components/ui/icon-symbol";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── 導航常數 ─────────────────────────────────────────────────────────────────
const OFF_ROUTE_THRESHOLD_M = 50;   // 偏離路線超過 50m 觸發提醒
const ARRIVAL_THRESHOLD_M = 30;     // 距終點 30m 視為到達
const TURN_LOOKAHEAD_M = 150;       // 前瞻 150m 偵測轉彎
const TURN_ANGLE_DEG = 30;          // 方向改變超過 30° 視為轉彎
const REROUTE_COOLDOWN_MS = 15000;  // 偏離提醒冷卻 15 秒

// ─── 工具函數 ─────────────────────────────────────────────────────────────────

/** Haversine 距離（公尺） */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 計算兩點之間的方位角（0-360°） */
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** 找到 GPX 路線上距離當前位置最近的點索引 */
function findNearestPointIndex(
  lat: number,
  lon: number,
  points: GpxPoint[]
): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < points.length; i++) {
    const d = haversine(lat, lon, points[i].lat, points[i].lon);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}

/** 格式化時間 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** 格式化距離 */
function formatDist(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

// ─── 深色地圖樣式 ─────────────────────────────────────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373755" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#484870" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0b0cc" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1b2a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2e1a" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useRide();
  const { settings } = useSettings();

  // 地圖 ref
  const mapRef = useRef<MapView>(null);

  // 當前位置
  const [currentPos, setCurrentPos] = useState<{ lat: number; lon: number; heading: number } | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // 地圖是否跟隨位置
  const [followUser, setFollowUser] = useState(true);

  // GPX 路線
  const [gpxRoute, setGpxRoute] = useState<GpxRoute | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // 導航狀態
  const [isNavigating, setIsNavigating] = useState(false);
  const [nearestIdx, setNearestIdx] = useState(0);
  const [navInstruction, setNavInstruction] = useState<string>("");
  const [distToEnd, setDistToEnd] = useState<number | null>(null);
  const lastRerouteRef = useRef<number>(0);
  const arrivedRef = useRef(false);

  // 計時器（地圖頁獨立計時）
  const [elapsed, setElapsed] = useState(0);
  const [mapRideActive, setMapRideActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 即時軌跡（自由騎乘繪製）
  const [liveTrail, setLiveTrail] = useState<{ latitude: number; longitude: number }[]>([]);

  // 坡度（即時）
  const [currentGrade, setCurrentGrade] = useState(0);
  const prevAltRef = useRef<number | null>(null);
  const prevPosRef = useRef<{ lat: number; lon: number } | null>(null);

  // ─── 計時器 ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRideActive) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mapRideActive]);

  // ─── 位置訂閱 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (loc) => {
          if (!active) return;
          const { latitude, longitude, altitude, heading, speed } = loc.coords;
          const hdg = heading ?? 0;

          setCurrentPos({ lat: latitude, lon: longitude, heading: hdg });

          // 地圖跟隨
          if (followUser) {
            mapRef.current?.animateCamera(
              { center: { latitude, longitude }, heading: hdg, zoom: 17 },
              { duration: 600 }
            );
          }

          // 即時軌跡
          if (mapRideActive) {
            setLiveTrail((prev) => [...prev, { latitude, longitude }]);
          }

          // 即時坡度
          if (prevPosRef.current && prevAltRef.current !== null && altitude !== null) {
            const d = haversine(prevPosRef.current.lat, prevPosRef.current.lon, latitude, longitude);
            if (d > 2) {
              const grade = ((altitude - prevAltRef.current) / d) * 100;
              setCurrentGrade(Math.round(grade * 10) / 10);
            }
          }
          prevPosRef.current = { lat: latitude, lon: longitude };
          if (altitude !== null) prevAltRef.current = altitude;

          // GPX 導航邏輯
          if (isNavigating && gpxRoute && gpxRoute.points.length > 0) {
            handleNavigation(latitude, longitude, speed ?? 0);
          }
        }
      );
      locationSubRef.current = sub;
    })();

    return () => {
      active = false;
      locationSubRef.current?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUser, mapRideActive, isNavigating, gpxRoute]);

  // ─── GPX 導航邏輯 ────────────────────────────────────────────────────────────
  const handleNavigation = useCallback(
    (lat: number, lon: number, speedMs: number) => {
      if (!gpxRoute) return;
      const pts = gpxRoute.points;

      // 找最近點
      const idx = findNearestPointIndex(lat, lon, pts);
      setNearestIdx(idx);

      // 距最近點距離
      const distToNearest = haversine(lat, lon, pts[idx].lat, pts[idx].lon);

      // 距終點距離
      const endPt = pts[pts.length - 1];
      const dEnd = haversine(lat, lon, endPt.lat, endPt.lon);
      setDistToEnd(dEnd);

      // 到達終點
      if (!arrivedRef.current && dEnd < ARRIVAL_THRESHOLD_M) {
        arrivedRef.current = true;
        setNavInstruction("已到達終點！");
        speak("恭喜！您已到達終點！", settings.ttsEnabled);
        vibrateMedium();
        return;
      }

      // 偏離路線
      const now = Date.now();
      if (
        distToNearest > OFF_ROUTE_THRESHOLD_M &&
        now - lastRerouteRef.current > REROUTE_COOLDOWN_MS
      ) {
        lastRerouteRef.current = now;
        setNavInstruction("⚠️ 偏離路線");
        speak("您已偏離路線，請返回路線", settings.ttsEnabled);
        vibrateLight();
        return;
      }

      // 前瞻轉彎偵測
      let lookaheadDist = 0;
      let turnInstruction = "";
      for (let i = idx + 1; i < pts.length - 1; i++) {
        lookaheadDist += haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
        if (lookaheadDist > TURN_LOOKAHEAD_M) break;

        const b1 = bearing(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
        const b2 = bearing(pts[i].lat, pts[i].lon, pts[i + 1].lat, pts[i + 1].lon);
        let diff = b2 - b1;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        if (Math.abs(diff) >= TURN_ANGLE_DEG) {
          const distToTurn = lookaheadDist;
          if (distToTurn < 50) {
            // 立即轉彎
            if (diff > 0) {
              turnInstruction = "右轉";
              speak("右轉", settings.ttsEnabled);
            } else {
              turnInstruction = "左轉";
              speak("左轉", settings.ttsEnabled);
            }
          } else {
            // 預告
            const distStr = distToTurn < 100 ? "前方" : `${Math.round(distToTurn)} 公尺後`;
            if (diff > 0) {
              turnInstruction = `${distStr}右轉`;
            } else {
              turnInstruction = `${distStr}左轉`;
            }
          }
          break;
        }
      }

      // 距終點提示
      if (dEnd < 500 && !arrivedRef.current) {
        const distStr = dEnd < 100 ? "即將" : `${Math.round(dEnd)} 公尺後`;
        setNavInstruction(`${distStr}到達終點`);
      } else if (turnInstruction) {
        setNavInstruction(turnInstruction);
      } else {
        setNavInstruction("沿路線前進");
      }
    },
    [gpxRoute, settings.ttsEnabled]
  );

  // ─── 匯入 GPX ────────────────────────────────────────────────────────────────
  const handleImportGpx = useCallback(async () => {
    try {
      setIsImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/gpx+xml", "text/xml", "application/xml", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);
      const route = parseGpx(content);

      if (!route) {
        Alert.alert("解析失敗", "無法解析此 GPX 檔案，請確認格式是否正確。");
        return;
      }

      setGpxRoute(route);
      setNearestIdx(0);
      arrivedRef.current = false;
      setNavInstruction("路線已載入，點擊開始導航");

      // 縮放至路線範圍
      if (route.points.length > 0) {
        const lats = route.points.map((p) => p.lat);
        const lons = route.points.map((p) => p.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        mapRef.current?.fitToCoordinates(
          route.points.map((p) => ({ latitude: p.lat, longitude: p.lon })),
          {
            edgePadding: { top: 80, right: 40, bottom: 280, left: 40 },
            animated: true,
          }
        );
        setFollowUser(false);
      }
    } catch (e) {
      Alert.alert("錯誤", "匯入 GPX 失敗");
    } finally {
      setIsImporting(false);
    }
  }, []);

  // ─── 開始/停止騎乘 ───────────────────────────────────────────────────────────
  const handleStartStop = useCallback(() => {
    if (mapRideActive) {
      Alert.alert("結束騎乘", "確定要結束本次地圖騎乘記錄？", [
        { text: "取消", style: "cancel" },
        {
          text: "結束",
          style: "destructive",
          onPress: () => {
            setMapRideActive(false);
            setIsNavigating(false);
            setNavInstruction("");
          },
        },
      ]);
    } else {
      setLiveTrail([]);
      setElapsed(0);
      setCurrentGrade(0);
      prevAltRef.current = null;
      prevPosRef.current = null;
      arrivedRef.current = false;
      setMapRideActive(true);
      setFollowUser(true);
      if (gpxRoute) {
        setIsNavigating(true);
        setNavInstruction("導航已啟動");
        speak("導航已啟動，沿路線前進", settings.ttsEnabled);
      }
    }
  }, [mapRideActive, gpxRoute, settings.ttsEnabled]);

  // ─── 清除路線 ────────────────────────────────────────────────────────────────
  const handleClearRoute = useCallback(() => {
    if (mapRideActive) return;
    setGpxRoute(null);
    setIsNavigating(false);
    setNavInstruction("");
    setNearestIdx(0);
    arrivedRef.current = false;
    setDistToEnd(null);
  }, [mapRideActive]);

  // ─── 回到定位 ────────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    setFollowUser(true);
    if (currentPos) {
      mapRef.current?.animateCamera(
        { center: { latitude: currentPos.lat, longitude: currentPos.lon }, zoom: 17 },
        { duration: 600 }
      );
    }
  }, [currentPos]);

  // ─── GPX 路線座標（Polyline 格式）────────────────────────────────────────────
  const gpxPolyline = useMemo(() => {
    if (!gpxRoute) return [];
    return gpxRoute.points.map((p) => ({ latitude: p.lat, longitude: p.lon }));
  }, [gpxRoute]);

  // ─── 已通過路段（較亮色）────────────────────────────────────────────────────
  const passedPolyline = useMemo(() => {
    if (!gpxRoute || nearestIdx <= 0) return [];
    return gpxRoute.points.slice(0, nearestIdx + 1).map((p) => ({
      latitude: p.lat,
      longitude: p.lon,
    }));
  }, [gpxRoute, nearestIdx]);

  // ─── 均速計算 ────────────────────────────────────────────────────────────────
  const avgSpeed = useMemo(() => {
    if (elapsed < 5 || state.distance < 10) return 0;
    return (state.distance / 1000) / (elapsed / 3600);
  }, [elapsed, state.distance]);

  // ─── 底部面板高度 ────────────────────────────────────────────────────────────
  const panelHeight = 200 + insets.bottom;
  const tabBarH = 60 + Math.max(insets.bottom, 8);

  // ─── 渲染 ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── 全螢幕地圖 ── */}
      <MapView
        ref={mapRef}
        style={[styles.map, { height: SCREEN_H - tabBarH }]}
        provider={PROVIDER_DEFAULT}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={true}
        initialRegion={{
          latitude: 25.0478,
          longitude: 121.5319,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPanDrag={() => setFollowUser(false)}
      >
        {/* GPX 路線（未通過段：紅色） */}
        {gpxPolyline.length > 0 && (
          <Polyline
            coordinates={gpxPolyline}
            strokeColor="#FF3B30"
            strokeWidth={4}
            lineDashPattern={undefined}
          />
        )}

        {/* GPX 路線（已通過段：暗紅色） */}
        {passedPolyline.length > 1 && (
          <Polyline
            coordinates={passedPolyline}
            strokeColor="#8B0000"
            strokeWidth={4}
          />
        )}

        {/* 自由騎乘即時軌跡（綠色） */}
        {liveTrail.length > 1 && !gpxRoute && (
          <Polyline
            coordinates={liveTrail}
            strokeColor="#00E676"
            strokeWidth={3}
          />
        )}

        {/* GPX 起點標記 */}
        {gpxPolyline.length > 0 && (
          <Circle
            center={gpxPolyline[0]}
            radius={8}
            fillColor="#00C853"
            strokeColor="#fff"
            strokeWidth={2}
          />
        )}

        {/* GPX 終點標記 */}
        {gpxPolyline.length > 1 && (
          <Circle
            center={gpxPolyline[gpxPolyline.length - 1]}
            radius={8}
            fillColor="#FF3B30"
            strokeColor="#fff"
            strokeWidth={2}
          />
        )}

        {/* 當前位置：方向扇形 + 藍點 */}
        {currentPos && (
          <>
            {/* 方向扇形（半透明藍色） */}
            <Circle
              center={{ latitude: currentPos.lat, longitude: currentPos.lon }}
              radius={30}
              fillColor="rgba(0, 122, 255, 0.15)"
              strokeColor="rgba(0, 122, 255, 0.3)"
              strokeWidth={1}
            />
            {/* 藍點 */}
            <Circle
              center={{ latitude: currentPos.lat, longitude: currentPos.lon }}
              radius={8}
              fillColor="#007AFF"
              strokeColor="#fff"
              strokeWidth={2.5}
            />
          </>
        )}
      </MapView>

      {/* ── 頂部導航指令條 ── */}
      {(isNavigating || navInstruction !== "") && (
        <View style={[styles.navBar, { top: insets.top + 8 }]}>
          <IconSymbol name="location.fill" size={16} color="#fff" />
          <Text style={styles.navText} numberOfLines={1}>
            {navInstruction || "沿路線前進"}
          </Text>
          {distToEnd !== null && (
            <Text style={styles.navDist}>{formatDist(distToEnd)}</Text>
          )}
        </View>
      )}

      {/* ── 右側工具列 ── */}
      <View style={[styles.toolBar, { top: insets.top + 8, right: 16 }]}>
        {/* 回到定位 */}
        <Pressable
          style={[styles.toolBtn, !followUser && styles.toolBtnActive]}
          onPress={handleRecenter}
        >
          <IconSymbol name="location.fill" size={20} color={followUser ? "#fff" : "#007AFF"} />
        </Pressable>

        {/* 匯入 GPX */}
        <Pressable
          style={styles.toolBtn}
          onPress={handleImportGpx}
          disabled={isImporting || mapRideActive}
        >
          <IconSymbol name="doc.fill" size={20} color={mapRideActive ? "#555" : "#fff"} />
        </Pressable>

        {/* 清除路線 */}
        {gpxRoute && !mapRideActive && (
          <Pressable style={styles.toolBtn} onPress={handleClearRoute}>
            <IconSymbol name="xmark.circle.fill" size={20} color="#FF3B30" />
          </Pressable>
        )}
      </View>

      {/* ── 底部面板 ── */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + 8 }]}>
        {/* 拖拉指示條 */}
        <View style={styles.panelHandle} />

        {/* 路線名稱 */}
        {gpxRoute && (
          <Text style={styles.routeName} numberOfLines={1}>
            {gpxRoute.name}
          </Text>
        )}

        {/* 主要數據：時間 + 速度 */}
        <View style={styles.mainRow}>
          <View style={styles.mainCell}>
            <Text style={styles.mainLabel}>騎乘時間</Text>
            <Text style={styles.mainValue}>{formatTime(elapsed)}</Text>
          </View>
          <View style={styles.mainDivider} />
          <View style={styles.mainCell}>
            <Text style={styles.mainLabel}>速度</Text>
            <Text style={styles.mainValue}>
              {state.currentSpeed > 0 ? state.currentSpeed.toFixed(1) : "--"}
              <Text style={styles.mainUnit}> km/h</Text>
            </Text>
          </View>
        </View>

        {/* 次要數據：距離 + 均速 + 坡度 */}
        <View style={styles.subRow}>
          <View style={styles.subCell}>
            <Text style={styles.subLabel}>距離</Text>
            <Text style={styles.subValue}>
              {state.distance > 0 ? (state.distance / 1000).toFixed(2) : "--"}
            </Text>
            <Text style={styles.subUnit}>km</Text>
          </View>
          <View style={styles.subCell}>
            <Text style={styles.subLabel}>平均速度</Text>
            <Text style={styles.subValue}>
              {avgSpeed > 0 ? avgSpeed.toFixed(1) : "--"}
            </Text>
            <Text style={styles.subUnit}>km/h</Text>
          </View>
          <View style={styles.subCell}>
            <Text style={styles.subLabel}>坡度</Text>
            <Text style={[styles.subValue, currentGrade > 5 && { color: "#FF9500" }, currentGrade > 10 && { color: "#FF3B30" }]}>
              {mapRideActive ? `${currentGrade > 0 ? "+" : ""}${currentGrade.toFixed(1)}` : "--"}
            </Text>
            <Text style={styles.subUnit}>%</Text>
          </View>
        </View>

        {/* 開始/停止按鈕 */}
        <View style={styles.btnRow}>
          <Pressable
            style={[styles.startBtn, mapRideActive && styles.stopBtn]}
            onPress={handleStartStop}
          >
            <Text style={styles.startBtnText}>
              {mapRideActive ? "停止" : "開始"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── 樣式 ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a",
  },
  map: {
    width: SCREEN_W,
  },

  // 導航指令條
  navBar: {
    position: "absolute",
    left: 16,
    right: 80,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  navText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  navDist: {
    color: "#00E676",
    fontSize: 12,
    fontWeight: "700",
  },

  // 右側工具列
  toolBar: {
    position: "absolute",
    gap: 10,
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  toolBtnActive: {
    backgroundColor: "rgba(0,122,255,0.2)",
    borderColor: "#007AFF",
  },

  // 底部面板
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0d0d1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  panelHandle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 10,
  },
  routeName: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 6,
  },

  // 主要數據行
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  mainCell: {
    flex: 1,
    alignItems: "center",
  },
  mainDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  mainLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    marginBottom: 2,
  },
  mainValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  mainUnit: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.5)",
  },

  // 次要數據行
  subRow: {
    flexDirection: "row",
    marginBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
  },
  subCell: {
    flex: 1,
    alignItems: "center",
  },
  subLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    marginBottom: 2,
  },
  subValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  subUnit: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    marginTop: 1,
  },

  // 按鈕
  btnRow: {
    alignItems: "center",
  },
  startBtn: {
    width: 160,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#00C853",
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: {
    backgroundColor: "#FF3B30",
  },
  startBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
