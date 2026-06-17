/**
 * 導航頁面（整合版）
 *
 * 功能：
 * - 全螢幕深色地圖（react-native-maps）
 * - 即時位置標記（藍點 + 方向扇形）
 * - GPX 路線疊加（紅色軌跡）
 * - 自由騎乘即時軌跡繪製（綠色）
 * - GPX 導航語音播報（偏離提示、轉彎提示、到達提示）
 * - 底部面板：可上滑展開（完整儀表板）/ 下滑收縮（僅速度+時間）
 * - 功率計算、卡路里/水分進度條、補給提醒
 * - 天氣資訊（溫度/濕度/相對風向）
 * - 自動暫停/恢復
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PanResponder } from "react-native";
import MapView, { Circle, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";

import { useColors } from "@/hooks/use-colors";
import { useRide } from "@/lib/ride-context";
import { useSettings } from "@/lib/settings-context";
import { parseGpx, GpxPoint, GpxRoute } from "@/lib/gpx-parser";
import {
  speak,
  vibrateLight,
  vibrateMedium,
  vibrateWarning,
  vibrateSuccess,
  speakSupplyReminder,
  speakAutoPause,
  speakAutoResume,
  showSupplyNotification,
  showRidingNotification,
  cancelRidingNotification,
  requestNotificationPermission,
} from "@/lib/feedback-service";
import {
  calculatePower,
  calculateCalories,
  calcAirDensity,
  calcGrade,
  haversineDistance,
  formatDuration,
} from "@/lib/power-calc";
import { fetchWeather, getHeadwindMs, getRelativeWindInfo, type WeatherData } from "@/lib/weather-service";
import {
  calculateSweatLoss,
  DEFAULT_HYDRATION_THRESHOLD_ML,
  formatSweatRate,
} from "@/lib/hydration-calc";
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from "@/lib/background-location";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SupplyModal } from "@/components/supply-modal";
import { RideSummaryModal } from "@/components/ride-summary-modal";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const OFF_ROUTE_THRESHOLD_M = 50;
const ARRIVAL_THRESHOLD_M = 30;
const TURN_LOOKAHEAD_M = 150;
const TURN_ANGLE_DEG = 30;
const REROUTE_COOLDOWN_MS = 15000;
const AUTO_PAUSE_THRESHOLD = 2;
const WEATHER_INTERVAL = 10 * 60 * 1000;
const LOCATION_INTERVAL_SEC = 3;

// 底部面板高度
const PANEL_COLLAPSED_H = 200;  // 收縮：速度 + 時間 + 按鈕
const PANEL_EXPANDED_H = 480;   // 展開：完整儀表板

// ─── 工具函數 ─────────────────────────────────────────────────────────────────

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

function findNearestPointIndex(lat: number, lon: number, points: GpxPoint[]): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < points.length; i++) {
    const d = haversine(lat, lon, points[i].lat, points[i].lon);
    if (d < minDist) { minDist = d; minIdx = i; }
  }
  return minIdx;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
  const insets = useSafeAreaInsets();
  const { state, dispatch, saveRecord } = useRide();
  const { settings } = useSettings();

  useKeepAwake();

  // Audio
  const alertPlayer = useAudioPlayer(require("../../assets/sounds/alert.mp3"));
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => { alertPlayer.release(); };
  }, []);

  // 地圖 ref
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  // 當前位置
  const [currentPos, setCurrentPos] = useState<{ lat: number; lon: number; heading: number } | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
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

  // 即時軌跡
  const [liveTrail, setLiveTrail] = useState<{ latitude: number; longitude: number }[]>([]);

  // 坡度
  const [currentGrade, setCurrentGrade] = useState(0);
  const prevAltRef = useRef<number | null>(null);
  const prevPosRef = useRef<{ lat: number; lon: number } | null>(null);

  // 天氣
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [relativeWindInfo, setRelativeWindInfo] = useState<ReturnType<typeof getRelativeWindInfo> | null>(null);
  const weatherRef = useRef<WeatherData | null>(null);
  const weatherTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const windDataRef = useRef<{ speed: number; direction: number }>({ speed: 0, direction: 0 });
  const airDensityRef = useRef<number>(calcAirDensity(25));
  const headingRef = useRef<number>(0);

  // 騎乘狀態
  const [mapRideActive, setMapRideActive] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [supplyModal, setSupplyModal] = useState<{
    visible: boolean;
    type: "calorie" | "water";
    recommendedMl?: number;
  }>({ visible: false, type: "calorie" });

  const calorieReminderSentRef = useRef(false);
  const waterReminderSentRef = useRef(false);
  const notifPermRef = useRef(false);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 進度條動畫
  const calorieAnim = useRef(new Animated.Value(0)).current;
  const waterAnim = useRef(new Animated.Value(0)).current;

  const isRiding = state.status === "active";
  const isPaused = state.status === "paused";
  const isActive = isRiding || isPaused;

  const hydrationThresholdMl = settings.waterThreshold > 0
    ? settings.waterThreshold
    : DEFAULT_HYDRATION_THRESHOLD_ML;

  // ─── 底部面板滑桿 ─────────────────────────────────────────────────────────────
  const [panelExpanded, setPanelExpanded] = useState(false);
  const panelAnim = useRef(new Animated.Value(PANEL_COLLAPSED_H)).current;

  const togglePanel = useCallback((expand: boolean) => {
    setPanelExpanded(expand);
    Animated.timing(panelAnim, {
      toValue: expand ? PANEL_EXPANDED_H : PANEL_COLLAPSED_H,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [panelAnim]);

  // PanResponder 處理上滑/下滑手勢
  const panStartY = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: (_, gs) => {
        panStartY.current = gs.y0;
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -30) {
          // 上滑 → 展開
          togglePanel(true);
        } else if (gs.dy > 30) {
          // 下滑 → 收縮
          togglePanel(false);
        }
      },
    })
  ).current;

  // ─── 天氣更新 ────────────────────────────────────────────────────────────────
  const updateWeather = useCallback(async (lat: number, lon: number) => {
    const w = await fetchWeather(lat, lon);
    if (w) {
      setWeather(w);
      weatherRef.current = w;
      windDataRef.current = { speed: w.windSpeed / 3.6, direction: w.windDirection };
      airDensityRef.current = calcAirDensity(w.temperature);
      setRelativeWindInfo(getRelativeWindInfo(headingRef.current, w.windDirection, w.windSpeed));
    }
  }, []);

  // ─── 補給提醒 ────────────────────────────────────────────────────────────────
  const triggerSupplyReminder = useCallback(
    async (type: "calorie" | "water", recommendedMl?: number) => {
      setSupplyModal({ visible: true, type, recommendedMl });
      if (settings.vibrationEnabled) vibrateWarning();
      if (settings.ttsEnabled) speakSupplyReminder(type, true);
      if (settings.soundEnabled) {
        try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
      }
      if (settings.notificationEnabled) showSupplyNotification(type);
    },
    [settings, alertPlayer]
  );

  // ─── 計時器（透過 RideContext 的 TICK 驅動） ─────────────────────────────────
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.status === "active") {
      startTimeRef.current = Date.now() - pausedElapsedRef.current * 1000;
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        dispatch({ type: "TICK", elapsed });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (state.status === "paused") {
        pausedElapsedRef.current = state.elapsed;
      }
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [state.status]);

  // ─── GPS 訂閱（地圖 + 騎乘功能整合） ────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      notifPermRef.current = await requestNotificationPermission();

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: LOCATION_INTERVAL_SEC * 1000,
          distanceInterval: 3,
        },
        (loc) => {
          if (!active) return;
          const { latitude, longitude, altitude, heading, speed } = loc.coords;
          const hdg = heading ?? 0;
          headingRef.current = hdg;

          setCurrentPos({ lat: latitude, lon: longitude, heading: hdg });

          // 地圖跟隨
          if (followUser) {
            mapRef.current?.animateCamera(
              { center: { latitude, longitude }, heading: hdg, zoom: 17 },
              { duration: 600 }
            );
          }

          // 更新相對風向
          const wd = windDataRef.current;
          if (wd.speed > 0) {
            setRelativeWindInfo(getRelativeWindInfo(hdg, wd.direction, wd.speed * 3.6));
          }

          const speedKmh = (speed ?? 0) * 3.6;
          const currentState = stateRef.current;

          // 自動暫停/恢復
          if (currentState.status === "active" && speedKmh < AUTO_PAUSE_THRESHOLD) {
            pausedElapsedRef.current = currentState.elapsed;
            dispatch({ type: "PAUSE" });
            if (settings.ttsEnabled) speakAutoPause(true);
            if (settings.vibrationEnabled) vibrateMedium();
            return;
          } else if (currentState.status === "paused" && speedKmh >= AUTO_PAUSE_THRESHOLD) {
            dispatch({ type: "RESUME" });
            if (settings.ttsEnabled) speakAutoResume(true);
            return;
          }

          // 即時軌跡（地圖繪製）
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

          // GPX 導航
          if (isNavigating && gpxRoute && gpxRoute.points.length > 0) {
            handleNavigation(latitude, longitude, speed ?? 0);
          }

          if (currentState.status !== "active") return;

          // ─── 騎乘計算 ─────────────────────────────────────────────────────
          let grade = 0;
          let ascent = 0;
          if (lastLocationRef.current) {
            const dist = haversineDistance(
              lastLocationRef.current.coords.latitude,
              lastLocationRef.current.coords.longitude,
              latitude, longitude
            );
            const altDiff = (altitude ?? 0) - (lastLocationRef.current.coords.altitude ?? 0);
            grade = calcGrade(altDiff, dist);
            ascent = Math.max(0, altDiff);
          }
          lastLocationRef.current = loc;

          const headwindMs = getHeadwindMs(headingRef.current, windDataRef.current.direction, windDataRef.current.speed * 3.6);
          const power = calculatePower({
            speedMs: speed ?? 0,
            gradePct: grade,
            windSpeedMs: headwindMs,
            riderMassKg: settings.weight,
            bikeMassKg: settings.bikeWeight ?? 10,
            airDensityKgM3: airDensityRef.current,
          });
          const calIncrement = calculateCalories(power, LOCATION_INTERVAL_SEC);

          dispatch({
            type: "LOCATION_UPDATE",
            point: { latitude, longitude, altitude: altitude ?? 0, speed: speed ?? 0, timestamp: Date.now() },
            power, calories: calIncrement, ascent,
          });

          // 水分流失
          const currentWeather = weatherRef.current;
          const sweatResult = calculateSweatLoss({
            weightKg: settings.weight,
            heightCm: settings.height,
            powerW: power,
            speedKmh,
            ascentPerInterval: ascent,
            intervalSec: LOCATION_INTERVAL_SEC,
            temperatureC: currentWeather?.temperature ?? 25,
            humidityPct: currentWeather?.humidity ?? 60,
            weatherCode: currentWeather?.weatherCode ?? 1,
          });
          dispatch({
            type: "SWEAT_UPDATE",
            sweatLossMl: sweatResult.sweatLossMl,
            sweatRatePerHour: sweatResult.sweatRatePerHour,
            intensityLabel: sweatResult.intensityLabel,
          });

          // 進度條動畫
          const newCalories = currentState.calories + calIncrement;
          const calPct = Math.min(1, newCalories / settings.calorieThreshold);
          const newSweatSince = currentState.sweatSinceLastRefill + sweatResult.sweatLossMl;
          const waterPct = Math.min(1, newSweatSince / hydrationThresholdMl);

          Animated.timing(calorieAnim, { toValue: calPct, duration: 500, useNativeDriver: false }).start();
          Animated.timing(waterAnim, { toValue: waterPct, duration: 500, useNativeDriver: false }).start();

          // 補給提醒
          if (calPct >= 1 && !calorieReminderSentRef.current) {
            calorieReminderSentRef.current = true;
            triggerSupplyReminder("calorie");
          }
          if (waterPct >= 1 && !waterReminderSentRef.current) {
            waterReminderSentRef.current = true;
            triggerSupplyReminder("water", sweatResult.recommendedRefillMl);
          }

          // 前台通知
          if (notifPermRef.current && settings.notificationEnabled && currentState.elapsed % 30 === 0) {
            showRidingNotification(speedKmh, currentState.distance, currentState.elapsed);
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
  }, [followUser, mapRideActive, isNavigating, gpxRoute, settings]);

  // ─── GPX 導航邏輯 ────────────────────────────────────────────────────────────
  const handleNavigation = useCallback(
    (lat: number, lon: number, speedMs: number) => {
      if (!gpxRoute) return;
      const pts = gpxRoute.points;
      const idx = findNearestPointIndex(lat, lon, pts);
      setNearestIdx(idx);

      const distToNearest = haversine(lat, lon, pts[idx].lat, pts[idx].lon);
      const endPt = pts[pts.length - 1];
      const dEnd = haversine(lat, lon, endPt.lat, endPt.lon);
      setDistToEnd(dEnd);

      if (!arrivedRef.current && dEnd < ARRIVAL_THRESHOLD_M) {
        arrivedRef.current = true;
        setNavInstruction("已到達終點！");
        speak("恭喜！您已到達終點！", settings.ttsEnabled);
        vibrateMedium();
        return;
      }

      const now = Date.now();
      if (distToNearest > OFF_ROUTE_THRESHOLD_M && now - lastRerouteRef.current > REROUTE_COOLDOWN_MS) {
        lastRerouteRef.current = now;
        setNavInstruction("⚠️ 偏離路線");
        speak("您已偏離路線，請返回路線", settings.ttsEnabled);
        vibrateLight();
        return;
      }

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
            if (diff > 0) { turnInstruction = "右轉"; speak("右轉", settings.ttsEnabled); }
            else { turnInstruction = "左轉"; speak("左轉", settings.ttsEnabled); }
          } else {
            const distStr = distToTurn < 100 ? "前方" : `${Math.round(distToTurn)} 公尺後`;
            turnInstruction = diff > 0 ? `${distStr}右轉` : `${distStr}左轉`;
          }
          break;
        }
      }

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
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const route = parseGpx(content);
      if (!route) {
        Alert.alert("解析失敗", "無法解析此 GPX 檔案，請確認格式是否正確。");
        return;
      }
      setGpxRoute(route);
      setNearestIdx(0);
      arrivedRef.current = false;
      setNavInstruction("路線已載入，點擊開始導航");
      if (route.points.length > 0) {
        mapRef.current?.fitToCoordinates(
          route.points.map((p) => ({ latitude: p.lat, longitude: p.lon })),
          { edgePadding: { top: 80, right: 40, bottom: PANEL_COLLAPSED_H + 40, left: 40 }, animated: true }
        );
        setFollowUser(false);
      }
    } catch {
      Alert.alert("錯誤", "匯入 GPX 失敗");
    } finally {
      setIsImporting(false);
    }
  }, []);

  // ─── 開始/停止騎乘 ────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    pausedElapsedRef.current = 0;
    dispatch({ type: "START", hydrationThresholdMl });
    calorieReminderSentRef.current = false;
    waterReminderSentRef.current = false;
    calorieAnim.setValue(0);
    waterAnim.setValue(0);
    lastLocationRef.current = null;
    setLiveTrail([]);
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

    // 啟動背景追蹤
    await startBackgroundLocationTracking();

    // 取得初始天氣
    const loc = await Location.getLastKnownPositionAsync();
    if (loc) updateWeather(loc.coords.latitude, loc.coords.longitude);
    weatherTimerRef.current = setInterval(async () => {
      const l = await Location.getLastKnownPositionAsync();
      if (l) updateWeather(l.coords.latitude, l.coords.longitude);
    }, WEATHER_INTERVAL);
  }, [dispatch, hydrationThresholdMl, gpxRoute, settings.ttsEnabled, updateWeather, calorieAnim, waterAnim]);

  const handlePause = useCallback(() => {
    pausedElapsedRef.current = state.elapsed;
    dispatch({ type: "PAUSE" });
  }, [dispatch, state.elapsed]);

  const handleResume = useCallback(() => {
    dispatch({ type: "RESUME" });
  }, [dispatch]);

  const handleStop = useCallback(() => {
    Alert.alert("結束騎乘", "確定要結束本次騎乘並儲存記錄？", [
      { text: "取消", style: "cancel" },
      {
        text: "結束",
        style: "destructive",
        onPress: async () => {
          dispatch({ type: "STOP" });
          setMapRideActive(false);
          setIsNavigating(false);
          setNavInstruction("");
          locationSubRef.current?.remove();
          locationSubRef.current = null;
          await stopBackgroundLocationTracking();
          if (weatherTimerRef.current) clearInterval(weatherTimerRef.current);
          await cancelRidingNotification();
          await saveRecord();
          setShowSummary(true);
          if (settings.vibrationEnabled) vibrateSuccess();
        },
      },
    ]);
  }, [dispatch, saveRecord, settings.vibrationEnabled]);

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

  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      locationSubRef.current?.remove();
      if (weatherTimerRef.current) clearInterval(weatherTimerRef.current);
    };
  }, []);

  // ─── 計算值 ──────────────────────────────────────────────────────────────────
  const gpxPolyline = useMemo(() => {
    if (!gpxRoute) return [];
    return gpxRoute.points.map((p) => ({ latitude: p.lat, longitude: p.lon }));
  }, [gpxRoute]);

  const passedPolyline = useMemo(() => {
    if (!gpxRoute || nearestIdx <= 0) return [];
    return gpxRoute.points.slice(0, nearestIdx + 1).map((p) => ({ latitude: p.lat, longitude: p.lon }));
  }, [gpxRoute, nearestIdx]);

  const avgSpeed = useMemo(() => {
    if (state.elapsed < 5 || state.distance < 10) return 0;
    return (state.distance / 1000) / (state.elapsed / 3600);
  }, [state.elapsed, state.distance]);

  const calorieWidth = calorieAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp" });
  const waterWidth = waterAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp" });

  const sweatCurrent = Math.round(state.sweatSinceLastRefill);
  const sweatTarget = Math.round(hydrationThresholdMl);
  const waterProgress = sweatCurrent / sweatTarget;
  const waterBarColor = waterProgress < 0.5 ? "#4FC3F7" : waterProgress < 0.8 ? "#F59E0B" : "#EF4444";

  const sweatRateLabel = isActive && state.currentSweatRatePerHour > 0
    ? formatSweatRate(state.currentSweatRatePerHour)
    : null;

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
          <Polyline coordinates={gpxPolyline} strokeColor="#FF3B30" strokeWidth={4} />
        )}
        {/* GPX 路線（已通過段：暗紅色） */}
        {passedPolyline.length > 1 && (
          <Polyline coordinates={passedPolyline} strokeColor="#8B0000" strokeWidth={4} />
        )}
        {/* 自由騎乘即時軌跡（綠色） */}
        {liveTrail.length > 1 && !gpxRoute && (
          <Polyline coordinates={liveTrail} strokeColor="#00E676" strokeWidth={3} />
        )}
        {/* GPX 起點 */}
        {gpxPolyline.length > 0 && (
          <Circle center={gpxPolyline[0]} radius={8} fillColor="#00C853" strokeColor="#fff" strokeWidth={2} />
        )}
        {/* GPX 終點 */}
        {gpxPolyline.length > 1 && (
          <Circle center={gpxPolyline[gpxPolyline.length - 1]} radius={8} fillColor="#FF3B30" strokeColor="#fff" strokeWidth={2} />
        )}
        {/* 當前位置 */}
        {currentPos && (
          <>
            <Circle
              center={{ latitude: currentPos.lat, longitude: currentPos.lon }}
              radius={30}
              fillColor="rgba(0, 122, 255, 0.15)"
              strokeColor="rgba(0, 122, 255, 0.3)"
              strokeWidth={1}
            />
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
          <Text style={styles.navText} numberOfLines={1}>{navInstruction || "沿路線前進"}</Text>
          {distToEnd !== null && (
            <Text style={styles.navDist}>
              {distToEnd < 1000 ? `${Math.round(distToEnd)} m` : `${(distToEnd / 1000).toFixed(1)} km`}
            </Text>
          )}
        </View>
      )}

      {/* ── 右側工具列 ── */}
      <View style={[styles.toolBar, { top: insets.top + 8, right: 16 }]}>
        <Pressable
          style={[styles.toolBtn, !followUser && styles.toolBtnActive]}
          onPress={handleRecenter}
        >
          <IconSymbol name="location.fill" size={20} color={followUser ? "#fff" : "#007AFF"} />
        </Pressable>
        <Pressable
          style={styles.toolBtn}
          onPress={handleImportGpx}
          disabled={isImporting || mapRideActive}
        >
          <IconSymbol name="doc.fill" size={20} color={mapRideActive ? "#555" : "#fff"} />
        </Pressable>
        {gpxRoute && !mapRideActive && (
          <Pressable style={styles.toolBtn} onPress={handleClearRoute}>
            <IconSymbol name="xmark.circle.fill" size={20} color="#FF3B30" />
          </Pressable>
        )}
      </View>

      {/* ── 底部面板（可上滑展開） ── */}
      <Animated.View
        style={[styles.panel, { height: panelAnim, paddingBottom: insets.bottom + 8 }]}
      >
        {/* 拖拉把手（觸控區域） */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.panelHandle} />
          {/* 天氣列（收縮時也顯示） */}
          {weather && (
            <View style={styles.weatherRow}>
              <Text style={styles.weatherItem}>{weather.temperature}°C</Text>
              <Text style={styles.weatherSep}>·</Text>
              <Text style={styles.weatherItem}>{weather.humidity}%</Text>
              {relativeWindInfo && (
                <>
                  <Text style={styles.weatherSep}>·</Text>
                  <Text style={[styles.weatherItem, {
                    color: relativeWindInfo.intensity === "強" ? "#EF4444"
                      : relativeWindInfo.intensity === "中" ? "#F59E0B"
                      : "rgba(255,255,255,0.5)"
                  }]}>
                    {relativeWindInfo.label}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* 主要數據：時間 + 速度 */}
        <View style={styles.mainRow}>
          <View style={styles.mainCell}>
            <Text style={styles.mainLabel}>騎乘時間</Text>
            <Text style={styles.mainValue}>{formatTime(state.elapsed)}</Text>
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

        {/* 展開後顯示的內容 */}
        {panelExpanded && (
          <>
            {/* 六格儀表板 */}
            <View style={styles.metricsGrid}>
              <MetricCell label="功率" value={`${state.currentPower}`} unit="W" accent />
              <MetricCell label="距離" value={(state.distance / 1000).toFixed(2)} unit="km" />
              <MetricCell label="爬升" value={`${Math.round(state.totalAscent)}`} unit="m" />
              <MetricCell label="均速" value={avgSpeed > 0 ? avgSpeed.toFixed(1) : "--"} unit="km/h" />
              <MetricCell label="均功率" value={`${state.avgPower}`} unit="W" accent />
              <MetricCell
                label="坡度"
                value={isActive ? `${currentGrade > 0 ? "+" : ""}${currentGrade.toFixed(1)}` : "--"}
                unit="%"
                warn={currentGrade > 5}
              />
            </View>

            {/* 卡路里進度條 */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <IconSymbol name="flame.fill" size={13} color="#F59E0B" />
                  <Text style={styles.progressLabel}>卡路里</Text>
                </View>
                <Text style={styles.progressValue}>
                  {Math.round(state.calories)} / {settings.calorieThreshold} kcal
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: calorieWidth, backgroundColor: "#F59E0B" }]} />
              </View>
            </View>

            {/* 水分進度條 */}
            <View style={[styles.progressSection, { marginTop: 8 }]}>
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <IconSymbol name="drop.fill" size={13} color={waterBarColor} />
                  <Text style={styles.progressLabel}>水分流失</Text>
                  {sweatRateLabel && (
                    <View style={[styles.ratePill, { backgroundColor: waterBarColor + "30" }]}>
                      <Text style={[styles.rateText, { color: waterBarColor }]}>{sweatRateLabel}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.progressValue}>{sweatCurrent} / {sweatTarget} ml</Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: waterWidth, backgroundColor: waterBarColor }]} />
              </View>
            </View>
          </>
        )}

        {/* 控制按鈕 */}
        <View style={styles.btnRow}>
          {!isActive ? (
            <Pressable
              style={({ pressed }) => [styles.startBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleStart}
            >
              <Text style={styles.startBtnText}>開始</Text>
            </Pressable>
          ) : (
            <View style={styles.activeButtons}>
              {isRiding ? (
                <Pressable
                  style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={handlePause}
                >
                  <IconSymbol name="pause.fill" size={22} color="#fff" />
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.controlBtn, { borderColor: "#00C853", opacity: pressed ? 0.7 : 1 }]}
                  onPress={handleResume}
                >
                  <IconSymbol name="play.fill" size={22} color="#00C853" />
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.startBtn, styles.stopBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleStop}
              >
                <Text style={styles.startBtnText}>結束</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* 展開/收縮提示 */}
        {!panelExpanded && isActive && (
          <Pressable style={styles.expandHint} onPress={() => togglePanel(true)}>
            <Text style={styles.expandHintText}>上滑查看更多</Text>
            <IconSymbol name="chevron.right" size={12} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: "-90deg" }] }} />
          </Pressable>
        )}
      </Animated.View>

      {/* ── 補給 Modal ── */}
      <SupplyModal
        visible={supplyModal.visible}
        type={supplyModal.type}
        recommendedMl={supplyModal.recommendedMl}
        onConfirm={() => {
          setSupplyModal({ ...supplyModal, visible: false });
          if (supplyModal.type === "calorie") {
            dispatch({ type: "CONSUME_CALORIES" });
            calorieAnim.setValue(0);
            calorieReminderSentRef.current = false;
          } else {
            dispatch({ type: "CONSUME_WATER" });
            waterAnim.setValue(0);
            waterReminderSentRef.current = false;
          }
          if (settings.vibrationEnabled) vibrateSuccess();
        }}
        onDismiss={() => setSupplyModal({ ...supplyModal, visible: false })}
      />

      {/* ── 騎乘摘要 Modal ── */}
      <RideSummaryModal
        visible={showSummary}
        onClose={() => {
          setShowSummary(false);
          dispatch({ type: "RESET" });
        }}
      />
    </View>
  );
}

// ─── 子元件 ───────────────────────────────────────────────────────────────────

function MetricCell({ label, value, unit, accent, warn }: {
  label: string; value: string; unit: string; accent?: boolean; warn?: boolean;
}) {
  const color = accent ? "#00E676" : warn ? "#F59E0B" : "#fff";
  return (
    <View style={metricStyles.cell}>
      <Text style={[metricStyles.value, { color }]}>{value}</Text>
      <Text style={metricStyles.unit}>{unit}</Text>
      <Text style={metricStyles.label}>{label}</Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  cell: { flex: 1, alignItems: "center", paddingVertical: 8 },
  value: { fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  unit: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 },
  label: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 },
});

// ─── 樣式 ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  map: { width: SCREEN_W },

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
  navText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "600" },
  navDist: { color: "#00E676", fontSize: 12, fontWeight: "700" },

  toolBar: { position: "absolute", gap: 10 },
  toolBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  toolBtnActive: { backgroundColor: "rgba(0,122,255,0.2)", borderColor: "#007AFF" },

  // 底部面板
  panel: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#0d0d1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  panelHandle: {
    width: 36, height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    marginBottom: 6,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  weatherItem: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  weatherSep: { color: "rgba(255,255,255,0.2)", fontSize: 11 },

  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  mainCell: { flex: 1, alignItems: "center" },
  mainDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.1)" },
  mainLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 2 },
  mainValue: { color: "#fff", fontSize: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
  mainUnit: { fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.5)" },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 4,
    marginBottom: 8,
  },

  progressSection: {},
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  progressLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  progressLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  progressValue: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  progressTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  ratePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  rateText: { fontSize: 10, fontWeight: "600" },

  btnRow: { alignItems: "center", marginTop: 10 },
  activeButtons: { flexDirection: "row", alignItems: "center", gap: 12 },
  startBtn: {
    width: 160, height: 48, borderRadius: 24,
    backgroundColor: "#00C853",
    alignItems: "center", justifyContent: "center",
  },
  stopBtn: { backgroundColor: "#FF3B30" },
  startBtnText: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: 1 },
  controlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },

  expandHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 6,
  },
  expandHintText: { color: "rgba(255,255,255,0.3)", fontSize: 11 },
});
