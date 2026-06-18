/**
 * 導航頁面（整合版）
 *
 * 功能：
 * - 全螢幕深色地圖（react-native-maps）
 * - 即時位置標記（藍點）
 * - GPX 路線疊加（從路線頁共享 Context 讀取，紅色軌跡）
 * - 自由騎乘即時軌跡繪製（綠色）
 * - GPX 導航語音播報（偏離提示、轉彎提示、到達提示）
 * - 底部面板（螢幕下方三分之一）：
 *     收縮狀態：時間、速度、距離、坡度、功率（六格）
 *     展開狀態：加入卡路里/水分進度條、補給提醒
 * - 功率計算、補給提醒
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
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LeafletMapView, { type LeafletMapHandle } from "@/components/leaflet-map";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";

import { useColors } from "@/hooks/use-colors";
import { useRide } from "@/lib/ride-context";
import { useSettings } from "@/lib/settings-context";
import { useGpx } from "@/lib/gpx-context";
import { type GpxPoint } from "@/lib/gpx-parser";
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
  stopSpeech,
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
import { fetchBikeRoute, formatRouteDistance, formatRouteDuration, type RouteCoordinate, type TurnStep } from "@/lib/route-service";
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
import { SimplifiedNavOverlay } from "@/components/simplified-nav-overlay";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useFriendNav } from "@/lib/friend-nav-context";

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

// 底部面板高度：螢幕下方三分之一（收縮）/ 五分之三（展開）
const PANEL_COLLAPSED_H = Math.round(SCREEN_H / 3);
const PANEL_EXPANDED_H = Math.round(SCREEN_H * 0.62);

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
  const { state, dispatch, saveRecord, updateRecordName, saveSnapshot, clearSnapshot, checkSnapshot } = useRide();
  const { settings } = useSettings();
  const { sharedRoute, clearSharedRoute } = useGpx();

  useKeepAwake();

  // Audio
  const alertPlayer = useAudioPlayer(require("../../assets/sounds/alert.mp3"));
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => { alertPlayer.release(); };
  }, []);

  // 地圖 ref
  const mapRef = useRef<LeafletMapHandle>(null);

  // 當前位置
  const [currentPos, setCurrentPos] = useState<{ lat: number; lon: number; heading: number } | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const [followUser, setFollowUser] = useState(true);

  // 地圖方向模式：true = 車頭朝前（heading-up），false = 指北（north-up）
  const [headingUp, setHeadingUp] = useState(false);

  // 功率平滑：5 點滑動平均
  const powerWindowRef = useRef<number[]>([]);

  // 自動暫停連續計數（需連續 3 次低速才暫停，避免 GPS 抖動誤觸發）
  const lowSpeedCountRef = useRef(0);
  const AUTO_PAUSE_CONSECUTIVE = 3;

  // 崩潰恢復
  const [showRecoveryAlert, setShowRecoveryAlert] = useState(false);
  const [recoverySnapshot, setRecoverySnapshot] = useState<Partial<import("@/lib/ride-context").RideState> | null>(null);

  // GPX 路線（從共享 Context 讀取，不再有本地匯入）
  const gpxRoute = sharedRoute;

  // 導航狀態
  const [isNavigating, setIsNavigating] = useState(false);
  const [nearestIdx, setNearestIdx] = useState(0);
  const [navInstruction, setNavInstruction] = useState<string>("");
  const [distToEnd, setDistToEnd] = useState<number | null>(null);
  const lastRerouteRef = useRef<number>(0);
  const arrivedRef = useRef(false);

  // 偏離路線狀態
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [offRouteDist, setOffRouteDist] = useState(0);
  // 回歸路徑（OSRM 計算後的多點折線）
  const [returnPolyline, setReturnPolyline] = useState<{ latitude: number; longitude: number }[]>([]);
  const [returnBearing, setReturnBearing] = useState<string>("");
  const showReturnRef = useRef(false);
  // OSRM 路由計算結果
  const [routeDistM, setRouteDistM] = useState<number | null>(null);
  const [routeDurSec, setRouteDurSec] = useState<number | null>(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const isFetchingRouteRef = useRef(false); // ref 版本，避免 closure 問題
  const lastRouteFetchRef = useRef<number>(0);
  const ROUTE_FETCH_COOLDOWN_MS = 30000; // 最少 30 秒才重新計算一次（避免 API 過載）
  const routeFetchFailCountRef = useRef(0); // 連續失敗次數
  // 偏離指引開關（預設開啟）
  const [guidanceEnabled, setGuidanceEnabled] = useState(true);
  // 用 ref 追蹤指引開關狀態，讓非同步回調（OSRM Promise）也能讀到最新值
  const guidanceEnabledRef = useRef(true);
  // 自行車道優先開關（預設開啟）
  const [preferCycleway, setPreferCycleway] = useState(true);
  const preferCyclewayRef = useRef(true);
  // 回歸路由轉彎步驟
  const [returnSteps, setReturnSteps] = useState<TurnStep[]>([]);
  const [currentReturnStepIdx, setCurrentReturnStepIdx] = useState(0);

  // 當共享路線更新時，自動適配地圖視角
  useEffect(() => {
    if (gpxRoute && gpxRoute.points.length > 0) {
      setNearestIdx(0);
      arrivedRef.current = false;
      setNavInstruction("路線已載入，點擊開始即可啟動導航");
      const coords = gpxRoute.points.map((p) => ({ latitude: p.lat, longitude: p.lon }));
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: PANEL_COLLAPSED_H + 40, left: 40 },
          animated: true,
        });
        setFollowUser(false);
      }, 400);
    } else {
      setNavInstruction("");
      setIsNavigating(false);
      setDistToEnd(null);
    }
  }, [gpxRoute]);

  // 即時軌跡
  const [liveTrail, setLiveTrail] = useState<{ latitude: number; longitude: number }[]>([]);

  // 坡度
  const [currentGrade, setCurrentGrade] = useState(0);
  const prevAltRef = useRef<number | null>(null);
  const prevPosRef = useRef<{ lat: number; lon: number } | null>(null);
  // 坡度平滑：7 點滑動平均，消除 GPS 高度抖動
  const gradeWindowRef = useRef<number[]>([]);

  // 天氣
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [relativeWindInfo, setRelativeWindInfo] = useState<ReturnType<typeof getRelativeWindInfo> | null>(null);
  const weatherRef = useRef<WeatherData | null>(null);
  const weatherTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const windDataRef = useRef<{ speed: number; direction: number }>({ speed: 0, direction: 0 });
  const airDensityRef = useRef<number>(calcAirDensity(25));
  const prevSpeedMsRef = useRef<number>(0); // 用於計算加速阻力
  const headingRef = useRef<number>(0);
  // 車頭朝前精度改善：7 點循環平均（消除 GPS heading 抖動）
  const headingWindowRef = useRef<number[]>([]);
  // 上一個 GPS 位置（用於低速時計算方位角）
  const prevGpsForBearingRef = useRef<{ lat: number; lon: number } | null>(null);

  // 騎乘狀態
  const [mapRideActive, setMapRideActive] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  // 補給提醒分別管理（支援兩種同時顯示）
  const [calorieAlert, setCalorieAlert] = useState(false);
  const [waterAlert, setWaterAlert] = useState(false);
  const [supplyRecommendedMl, setSupplyRecommendedMl] = useState<number | undefined>(undefined);

  const calorieReminderSentRef = useRef(false);
  const waterReminderSentRef = useRef(false);
  const notifPermRef = useRef(false);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 進度條動畫
  const calorieAnim = useRef(new Animated.Value(0)).current;
  const waterAnim = useRef(new Animated.Value(0)).current;

  const { user, isAuthenticated } = useAuth();
  const { pendingNav, clearFriendNav } = useFriendNav();

  // 好友詳細卡片
  const [tappedFriend, setTappedFriend] = useState<{
    userId: string; name: string; lat: number; lon: number;
    speed: number; isMoving: boolean;
  } | null>(null);

  // 好友導航狀態
  const [friendNavDest, setFriendNavDest] = useState<{
    name: string; lat: number; lon: number;
  } | null>(null);
  const [friendNavPolyline, setFriendNavPolyline] = useState<{ latitude: number; longitude: number }[]>([]);
  const [friendNavSteps, setFriendNavSteps] = useState<TurnStep[]>([]);
  const [friendNavStepIdx, setFriendNavStepIdx] = useState(0);
  const [friendNavDistM, setFriendNavDistM] = useState<number | null>(null);
  const [friendNavDurSec, setFriendNavDurSec] = useState<number | null>(null);
  const [isFetchingFriendNav, setIsFetchingFriendNav] = useState(false);
  const [friendNavPreferCycleway, setFriendNavPreferCycleway] = useState(true);
  const friendNavDestRef = useRef<{ lat: number; lon: number } | null>(null);

  // 精簡導航模式
  const [simplifiedNavVisible, setSimplifiedNavVisible] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  const isRiding = state.status === "active";
  const isPaused = state.status === "paused";
  const isActive = isRiding || isPaused;

  // 隊伍遙測：查詢好友即時位置（每 5 秒更新）
  const teamQuery = trpc.friends.getFriendsLocations.useQuery(
    undefined,
    {
      enabled: isAuthenticated && settings.teamTelemetryEnabled && isActive,
      refetchInterval: 5000,
    }
  );

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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -30) togglePanel(true);
        else if (gs.dy > 30) togglePanel(false);
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
      if (type === "calorie") {
        setCalorieAlert(true);
      } else {
        setWaterAlert(true);
        if (recommendedMl) setSupplyRecommendedMl(recommendedMl);
      }
      if (settings.vibrationEnabled) vibrateWarning();
      if (settings.ttsEnabled) speakSupplyReminder(type, true);
      if (settings.soundEnabled) {
        try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
      }
      if (settings.notificationEnabled) showSupplyNotification(type);
    },
    [settings, alertPlayer]
  );

  // ─── 計時器 ──────────────────────────────────────────────────────────────────
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

  // ─── 崩潰恢復檢查 ──────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const snapshot = await checkSnapshot();
      if (snapshot && snapshot.elapsed && snapshot.elapsed > 30) {
        setRecoverySnapshot(snapshot);
        setShowRecoveryAlert(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── GPS 訂閱 ──────────────────────────────────────────────────────────────────────────────
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
          const speedKmhRaw = (speed ?? 0) * 3.6;

          // ── 車頭朝前精度改善 ─────────────────────────────────────────────────────────────────────
          // 策略：速度 > 5 km/h 且 GPS heading 有效時使用 GPS heading
          //         速度 ≤ 5 km/h 時改用兩點間 bearing（低速 GPS heading 不準）
          let rawHdg = heading ?? -1;
          if (rawHdg < 0 || speedKmhRaw <= 5) {
            // 低速或 heading 無效：用上一個 GPS 位置計算方位角
            const prev = prevGpsForBearingRef.current;
            if (prev) {
              const d = haversine(prev.lat, prev.lon, latitude, longitude);
              if (d >= 5) { // 至少移動 5m 才更新方位角
                rawHdg = bearing(prev.lat, prev.lon, latitude, longitude);
              } else {
                rawHdg = headingRef.current; // 保持上一次的方向
              }
            } else {
              rawHdg = headingRef.current;
            }
          }
          // 更新 GPS 位置參考點
          prevGpsForBearingRef.current = { lat: latitude, lon: longitude };
          // 7 點循環平均：消除 GPS heading 抖動（角度卷繞處理）
          headingWindowRef.current.push(rawHdg);
          if (headingWindowRef.current.length > 7) headingWindowRef.current.shift();
          // 角度平均：轉換為向量再平均，避免 350°/10° 平均出 180° 的問題
          const sinSum = headingWindowRef.current.reduce((s, h) => s + Math.sin((h * Math.PI) / 180), 0);
          const cosSum = headingWindowRef.current.reduce((s, h) => s + Math.cos((h * Math.PI) / 180), 0);
          const hdg = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
          headingRef.current = hdg;
          setCurrentPos({ lat: latitude, lon: longitude, heading: hdg });
          if (followUser) {
            mapRef.current?.animateCamera(
              { center: { latitude, longitude }, zoom: 17 }
            );
          }
          // 車頭朝前模式：僅在騎乘中且速度足夠時更新地圖方向
          const currentState0 = stateRef.current;
          if (headingUp && hdg !== 0 && currentState0.status === "active" && speedKmhRaw >= 2) {
            mapRef.current?.setBearing(hdg, true);
          }

          const wd = windDataRef.current;
          if (wd.speed > 0) {
            setRelativeWindInfo(getRelativeWindInfo(hdg, wd.direction, wd.speed * 3.6));
          }

          const speedKmh = (speed ?? 0) * 3.6;
          const currentState = stateRef.current;

          // 自動暫停/恢復（連續 3 次低速才暫停，避免 GPS 抖動誤觸發）
          if (currentState.status === "active") {
            if (speedKmh < AUTO_PAUSE_THRESHOLD) {
              lowSpeedCountRef.current += 1;
              if (lowSpeedCountRef.current >= AUTO_PAUSE_CONSECUTIVE) {
                lowSpeedCountRef.current = 0;
                pausedElapsedRef.current = currentState.elapsed;
                dispatch({ type: "PAUSE" });
                // 暫停時強制歸零速度與功率
                dispatch({ type: "LOCATION_UPDATE", point: { latitude, longitude, altitude: altitude ?? 0, speed: 0, timestamp: Date.now() }, power: 0, calories: 0, ascent: 0 });
                if (settings.ttsEnabled) speakAutoPause(true);
                if (settings.vibrationEnabled) vibrateMedium();
                return;
              }
            } else {
              lowSpeedCountRef.current = 0;
            }
          } else if (currentState.status === "paused" && speedKmh >= AUTO_PAUSE_THRESHOLD) {
            lowSpeedCountRef.current = 0;
            dispatch({ type: "RESUME" });
            if (settings.ttsEnabled) speakAutoResume(true);
            return;
          }

          // 即時軌跡
          if (mapRideActive) {
            setLiveTrail((prev) => [...prev, { latitude, longitude }]);
          }

          // 即時坡度：最小距離 10m、異常値過濾、7 點滑動平均
          if (prevPosRef.current && prevAltRef.current !== null && altitude !== null) {
            const d = haversine(prevPosRef.current.lat, prevPosRef.current.lon, latitude, longitude);
            if (d >= 10) {
              const rawGrade = ((altitude - prevAltRef.current) / d) * 100;
              // 過濾 GPS 异常値（超過 ±30% 視為誤差）
              if (Math.abs(rawGrade) <= 30) {
                gradeWindowRef.current.push(rawGrade);
                if (gradeWindowRef.current.length > 7) gradeWindowRef.current.shift();
                const smoothed = gradeWindowRef.current.reduce((a, b) => a + b, 0) / gradeWindowRef.current.length;
                setCurrentGrade(Math.round(smoothed * 10) / 10);
              }
              // 更新參考點（僅在距離足夠時更新）
              prevPosRef.current = { lat: latitude, lon: longitude };
              if (altitude !== null) prevAltRef.current = altitude;
            }
          } else {
            // 初始化參考點
            prevPosRef.current = { lat: latitude, lon: longitude };
            if (altitude !== null) prevAltRef.current = altitude;
          }

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
          const currentSpeedMs = speed ?? 0;
          const rawPower = calculatePower({
            speedMs: currentSpeedMs,
            prevSpeedMs: prevSpeedMsRef.current,
            intervalSec: LOCATION_INTERVAL_SEC,
            gradePct: grade,
            windSpeedMs: headwindMs,
            riderMassKg: settings.weight,
            bikeMassKg: settings.bikeWeight ?? 10,
            airDensityKgM3: airDensityRef.current,
          });
          prevSpeedMsRef.current = currentSpeedMs;
          // 5 點滑動平均：平滑功率，消除 GPS 抖動造成的瞬間高峰
          powerWindowRef.current.push(rawPower);
          if (powerWindowRef.current.length > 5) powerWindowRef.current.shift();
          const power = Math.round(
            powerWindowRef.current.reduce((a, b) => a + b, 0) / powerWindowRef.current.length
          );
          const calIncrement = calculateCalories(power, LOCATION_INTERVAL_SEC);

          dispatch({
            type: "LOCATION_UPDATE",
            point: { latitude, longitude, altitude: altitude ?? 0, speed: speed ?? 0, timestamp: Date.now() },
            power, calories: calIncrement, ascent,
          });

          const sweatResult = calculateSweatLoss({
            weightKg: settings.weight,
            heightCm: settings.height,
            powerW: power,
            speedKmh,
            ascentPerInterval: ascent,
            intervalSec: LOCATION_INTERVAL_SEC,
            temperatureC: weatherRef.current?.temperature ?? 25,
            humidityPct: weatherRef.current?.humidity ?? 60,
            weatherCode: weatherRef.current?.weatherCode ?? 1,
            ageYears: settings.age ?? 32,
          });
          dispatch({
            type: "SWEAT_UPDATE",
            sweatLossMl: sweatResult.sweatLossMl,
            sweatRatePerHour: sweatResult.sweatRatePerHour,
            intensityLabel: sweatResult.intensityLabel,
          });

          const newCalories = currentState.calories + calIncrement;
          const calPct = Math.min(1, newCalories / settings.calorieThreshold);
          const newSweatSince = currentState.sweatSinceLastRefill + sweatResult.sweatLossMl;
          const waterPct = Math.min(1, newSweatSince / hydrationThresholdMl);

          Animated.timing(calorieAnim, { toValue: calPct, duration: 500, useNativeDriver: false }).start();
          Animated.timing(waterAnim, { toValue: waterPct, duration: 500, useNativeDriver: false }).start();

          if (calPct >= 1 && !calorieReminderSentRef.current) {
            calorieReminderSentRef.current = true;
            triggerSupplyReminder("calorie");
          }
          if (waterPct >= 1 && !waterReminderSentRef.current) {
            waterReminderSentRef.current = true;
            triggerSupplyReminder("water", sweatResult.recommendedRefillMl);
          }

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

      // 偏離偵測：若指引關閉則完全跳過（清除任何殘留偏離狀態）
      if (!guidanceEnabled) {
        if (isOffRoute) {
          setIsOffRoute(false);
          setReturnPolyline([]);
          setReturnBearing("");
          setRouteDistM(null);
          setRouteDurSec(null);
          setReturnSteps([]);
        }
        // 指引關閉時跳過偏離偵測，直接進入轉彎導航邏輯
      } else if (distToNearest > OFF_ROUTE_THRESHOLD_M) {
        // 偏離偵測：更新偏離狀態與回歸路徑
        setIsOffRoute(true);
        setOffRouteDist(Math.round(distToNearest));

        const nearPt = pts[idx];

        // 計算方位詞（直線方向，供橫幅提示用）
        const brg = bearing(lat, lon, nearPt.lat, nearPt.lon);
        const dirs = ["正北", "東北", "正東", "東南", "正南", "西南", "正西", "西北", "正北"];
        const dirIdx = Math.round(brg / 45) % 8;
        setReturnBearing(dirs[dirIdx]);

        // 非同步呼叫路由引擎，取得沿道路路徑（有冷卻時間）
        // 使用 ref 版本的 isFetchingRouteRef 避免 closure 問題
        if (now - lastRouteFetchRef.current > ROUTE_FETCH_COOLDOWN_MS && !isFetchingRouteRef.current) {
          lastRouteFetchRef.current = now;
          isFetchingRouteRef.current = true;
          setIsFetchingRoute(true);
          // 先顯示直線作為即時備用（讓使用者知道方向）
          setReturnPolyline([
            { latitude: lat, longitude: lon },
            { latitude: nearPt.lat, longitude: nearPt.lon },
          ]);
          fetchBikeRoute(
            { latitude: lat, longitude: lon },
            { latitude: nearPt.lat, longitude: nearPt.lon },
            preferCyclewayRef.current  // 自行車道優先開關
          ).then((result) => {
            isFetchingRouteRef.current = false;
            setIsFetchingRoute(false);
            if (result && result.coordinates.length > 1) {
              routeFetchFailCountRef.current = 0;
              setReturnPolyline(result.coordinates);
              setRouteDistM(result.distanceM);
              setRouteDurSec(result.durationSec);
              // 儲存轉灣步驟，從第一步開始（跳過 depart）
              const filteredSteps = result.steps.filter(s => s.instruction !== "出發，進入路線");
              setReturnSteps(filteredSteps);
              setCurrentReturnStepIdx(0);
              // 語音播報第一個轉灣指令（用 ref 檢查，避免 closure 問題）
              if (filteredSteps.length > 0 && settings.ttsEnabled && guidanceEnabledRef.current) {
                speak(`回歸路線：${filteredSteps[0].instruction}，${formatRouteDistance(filteredSteps[0].distanceM)}後`, settings.ttsEnabled);
              }
            } else {
              // API 回傳空結果：保留直線備用
              routeFetchFailCountRef.current += 1;
              // 失敗次數導致冷卻縮短，讓下次請求更快重試
              if (routeFetchFailCountRef.current >= 2) {
                lastRouteFetchRef.current = now - ROUTE_FETCH_COOLDOWN_MS + 10000; // 10秒後重試
                routeFetchFailCountRef.current = 0;
              }
            }
          }).catch(() => {
            isFetchingRouteRef.current = false;
            setIsFetchingRoute(false);
            routeFetchFailCountRef.current += 1;
            // 網路錯誤：10 秒後重試
            lastRouteFetchRef.current = now - ROUTE_FETCH_COOLDOWN_MS + 10000;
          });
        } else if (!isFetchingRouteRef.current && returnPolyline.length === 0) {
          // 尚未有路徑時先顯示直線作為備用
          setReturnPolyline([
            { latitude: lat, longitude: lon },
            { latitude: nearPt.lat, longitude: nearPt.lon },
          ]);
        } else if (!isFetchingRouteRef.current && returnPolyline.length > 0) {
          // 已有路徑：更新路徑起點為當前位置（讓路徑跟著移動）
          setReturnPolyline(prev => [
            { latitude: lat, longitude: lon },
            ...prev.slice(1),
          ]);
        }

        // 自動推進回歸步驟：檢查是否已經通過當前步驟的轉灣點
        if (returnSteps.length > 0 && currentReturnStepIdx < returnSteps.length) {
          const step = returnSteps[currentReturnStepIdx];
          const distToStep = haversine(lat, lon, step.location.latitude, step.location.longitude);
          // 如果已接近轉灣點（50m 內），推進到下一步
          if (distToStep < 50 && currentReturnStepIdx + 1 < returnSteps.length) {
            const nextStep = returnSteps[currentReturnStepIdx + 1];
            setCurrentReturnStepIdx(i => i + 1);
            if (guidanceEnabledRef.current && settings.ttsEnabled) {
              speak(`${nextStep.instruction}${nextStep.distanceM > 0 ? `，${formatRouteDistance(nextStep.distanceM)}後` : ""}`, settings.ttsEnabled);
            }
          } else if (distToStep < 150 && guidanceEnabledRef.current) {
            // 接近轉灣點時語音提醒（每個步驟只播報一次）
            // 用 REROUTE_COOLDOWN_MS 防止重複播報
          }
        }

        if (now - lastRerouteRef.current > REROUTE_COOLDOWN_MS) {
          lastRerouteRef.current = now;
          setNavInstruction("⚠️ 偏離路線");
          // 用 ref 檢查，避免按下關閉後仍播放
          if (guidanceEnabledRef.current) speak("您已偏離路線，請返回路線", settings.ttsEnabled);
          vibrateLight();
        }
        return;
      } else {
        // 回到路線範圍內，清除偏離狀態
        if (isOffRoute) {
          setIsOffRoute(false);
          setReturnPolyline([]);
          setReturnBearing("");
          setRouteDistM(null);
          setRouteDurSec(null);
          setReturnSteps([]);
          if (guidanceEnabledRef.current) speak("已回到路線，繼續前進", settings.ttsEnabled);
        }
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
            if (diff > 0) { turnInstruction = "右轉"; if (guidanceEnabledRef.current) speak("右轉", settings.ttsEnabled); }
            else { turnInstruction = "左轉"; if (guidanceEnabledRef.current) speak("左轉", settings.ttsEnabled); }
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
    [gpxRoute, settings.ttsEnabled, isOffRoute, guidanceEnabled, returnSteps, currentReturnStepIdx]
  );

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
    powerWindowRef.current = [];
    gradeWindowRef.current = [];
    lowSpeedCountRef.current = 0;
    arrivedRef.current = false;
    setIsOffRoute(false);
    setReturnPolyline([]);
    setReturnBearing("");
    setRouteDistM(null);
    setRouteDurSec(null);
    setIsFetchingRoute(false);
    isFetchingRouteRef.current = false;
    lastRouteFetchRef.current = 0;
    routeFetchFailCountRef.current = 0;
    setReturnSteps([]);
    setCurrentReturnStepIdx(0);
    setMapRideActive(true);
    setFollowUser(true);

    if (gpxRoute) {
      setIsNavigating(true);
      setNavInstruction("導航已啟動");
      speak("導航已啟動，沿路線前進", settings.ttsEnabled);
    }

    await startBackgroundLocationTracking();

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
          // 結束騎乘清空地圖軌跡
          setLiveTrail([]);
          // 結束騎乘清除崩潰恢復快照
          await clearSnapshot();
          // 先不帶名稱儲存記錄，之後在摘要 Modal 取得名稱後更新
          await saveRecord();
          setShowSummary(true);
          if (settings.vibrationEnabled) vibrateSuccess();
        },
      },
    ]);
  }, [dispatch, saveRecord, clearSnapshot, settings.vibrationEnabled]);

  // ─── 回到定位 ────────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    setFollowUser(true);
    if (currentPos) {
      mapRef.current?.animateCamera(
        { center: { latitude: currentPos.lat, longitude: currentPos.lon }, zoom: 17 }
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

  // ─── 好友導航：開始導航至好友位置 ──────────────────────────────────────────────────────────────────────────────
  const startFriendNav = useCallback(async (
    friendName: string,
    friendLat: number,
    friendLon: number,
    preferCycleway: boolean,
  ) => {
    if (!currentPos) {
      Alert.alert("導航失敗", "無法取得目前位置，請確認已開啟位置權限。");
      return;
    }
    setIsFetchingFriendNav(true);
    setFriendNavDest({ name: friendName, lat: friendLat, lon: friendLon });
    friendNavDestRef.current = { lat: friendLat, lon: friendLon };
    setFriendNavPreferCycleway(preferCycleway);
    // 先顯示直線備用路徑
    setFriendNavPolyline([
      { latitude: currentPos.lat, longitude: currentPos.lon },
      { latitude: friendLat, longitude: friendLon },
    ]);
    setFriendNavSteps([]);
    setFriendNavStepIdx(0);
    setFriendNavDistM(null);
    setFriendNavDurSec(null);
    setTappedFriend(null);
    setFollowUser(false);
    // 適配地圖視角包含自己與好友
    mapRef.current?.fitToCoordinates(
      [
        { latitude: currentPos.lat, longitude: currentPos.lon },
        { latitude: friendLat, longitude: friendLon },
      ],
      { edgePadding: { top: 80, right: 40, bottom: PANEL_COLLAPSED_H + 40, left: 40 }, animated: true }
    );
    try {
      const result = await fetchBikeRoute(
        { latitude: currentPos.lat, longitude: currentPos.lon },
        { latitude: friendLat, longitude: friendLon },
        preferCycleway,
      );
      if (result && result.coordinates.length > 1) {
        setFriendNavPolyline(result.coordinates);
        setFriendNavDistM(result.distanceM);
        setFriendNavDurSec(result.durationSec);
        const filtered = result.steps.filter(s => s.instruction !== "出發，進入路線");
        setFriendNavSteps(filtered);
        setFriendNavStepIdx(0);
        speak(`開始導航至${friendName}，${formatRouteDistance(result.distanceM)}，${formatRouteDuration(result.durationSec)}`, settings.ttsEnabled);
      } else {
        speak(`導航至${friendName}，請朝好友方向前進`, settings.ttsEnabled);
      }
    } catch {
      speak(`導航至${friendName}，請朝好友方向前進`, settings.ttsEnabled);
    } finally {
      setIsFetchingFriendNav(false);
    }
  }, [currentPos, settings.ttsEnabled]);

  const stopFriendNav = useCallback(() => {
    setFriendNavDest(null);
    friendNavDestRef.current = null;
    setFriendNavPolyline([]);
    setFriendNavSteps([]);
    setFriendNavStepIdx(0);
    setFriendNavDistM(null);
    setFriendNavDurSec(null);
    setIsFetchingFriendNav(false);
  }, []);

  // 監聽好友頁面傳來的導航請求
  useEffect(() => {
    if (!pendingNav) return;
    const { friendName, lat, lon, preferCycleway: pref } = pendingNav;
    clearFriendNav();
    setTimeout(() => {
      startFriendNav(friendName, lat, lon, pref);
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNav]);

  // ─── 騎乘進度快照（每 10 秒儲存一次，用於崩潰恢復）───────────────────────────────────────
  useEffect(() => {
    if (state.status !== "active" && state.status !== "paused") return;
    const timer = setInterval(() => {
      saveSnapshot();
    }, 10000);
    return () => clearInterval(timer);
  }, [state.status, saveSnapshot]);

  // ─── 位置上傳 mutation（隊伍遙測）────────────────────────────────────────────
  const updateLocationMutation = trpc.friends.updateMyLocation.useMutation();

  // 每次 GPS 更新時，若隊伍遙測開啟且已登入，上傳位置
  useEffect(() => {
    if (!isAuthenticated || !settings.shareLocation || !currentPos || !isActive) return;
    updateLocationMutation.mutate({
      latitude: currentPos.lat,
      longitude: currentPos.lon,
      speed: state.currentSpeed ?? 0,
      heading: currentPos.heading,
      altitude: 0,
      isGhostMode: settings.ghostMode,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPos]);

  // ─── 精簡導航閒置計時器（自動模式）─────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    lastInteractionRef.current = Date.now();
    if (simplifiedNavVisible) setSimplifiedNavVisible(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (settings.simplifiedNavMode === "auto" && isActive) {
      const idleSec = settings.simplifiedNavIdleSec ?? 30;
      idleTimerRef.current = setTimeout(() => {
        setSimplifiedNavVisible(true);
      }, idleSec * 1000);
    }
  }, [simplifiedNavVisible, settings.simplifiedNavMode, settings.simplifiedNavIdleSec, isActive]);

  // 騎乘開始時啟動閒置計時器
  useEffect(() => {
    if (isActive && settings.simplifiedNavMode === "auto") {
      resetIdleTimer();
    } else {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setSimplifiedNavVisible(false);
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, settings.simplifiedNavMode]);

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
      {/* ── 崩潰恢復強調表示 */}
      {showRecoveryAlert && recoverySnapshot && (
        <View style={[styles.recoveryBanner, { top: insets.top + 8 }]}>
          <Text style={styles.recoveryTitle}>偵測到未完成的騎乘</Text>
          <Text style={styles.recoveryDesc}>
            騎乘時間 {formatDuration(recoverySnapshot.elapsed ?? 0)}，
            距離 {((recoverySnapshot.distance ?? 0) / 1000).toFixed(2)} km
          </Text>
          <View style={styles.recoveryBtns}>
            <Pressable
              style={[styles.recoveryBtn, { backgroundColor: "#007AFF" }]}
              onPress={() => {
                if (recoverySnapshot) {
                  dispatch({ type: "RESTORE", snapshot: recoverySnapshot });
                  setMapRideActive(true);
                  setShowRecoveryAlert(false);
                  setRecoverySnapshot(null);
                  startBackgroundLocationTracking();
                }
              }}
            >
              <Text style={styles.recoveryBtnText}>繼續騎乘</Text>
            </Pressable>
            <Pressable
              style={[styles.recoveryBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
              onPress={() => {
                clearSnapshot();
                setShowRecoveryAlert(false);
                setRecoverySnapshot(null);
              }}
            >
              <Text style={styles.recoveryBtnText}>新騎乘</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── 全螢幕地圖（Leaflet WebView） ── */}
      <LeafletMapView
        ref={mapRef}
        style={[styles.map, { height: SCREEN_H - tabBarH }]}
        initialRegion={{
          latitude: 25.0478,
          longitude: 121.5319,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPanDrag={() => setFollowUser(false)}
        currentPos={currentPos}
        gpxPolyline={gpxPolyline}
        passedPolyline={passedPolyline}
        liveTrail={liveTrail}
        returnPolyline={friendNavDest ? friendNavPolyline : returnPolyline}
        isOffRoute={friendNavDest ? friendNavPolyline.length > 0 : isOffRoute}
        friendMarkers={
          isAuthenticated && settings.teamTelemetryEnabled && teamQuery.data
            ? teamQuery.data.map((f: any) => ({
                userId: f.userId,
                name: f.displayName ?? f.email?.split('@')[0] ?? '好友',
                latitude: f.latitude,
                longitude: f.longitude,
                speed: f.speed ?? 0,
                isMoving: (f.speed ?? 0) > 0.5,
              }))
            : []
        }
        onFriendTap={(friend) => setTappedFriend({
          userId: friend.userId,
          name: friend.name,
          lat: friend.lat,
          lon: friend.lon,
          speed: friend.speed,
          isMoving: friend.isMoving,
        })}
      />

      {/* ── 頂部導航指令條 ── */}
      {(isNavigating || navInstruction !== "") && !friendNavDest && (
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

      {/* ── 好友導航指令條 ── */}
      {friendNavDest && (
        <View style={[styles.navBar, { top: insets.top + 8, backgroundColor: "rgba(52,199,89,0.92)" }]}>
          <IconSymbol name="person.fill" size={16} color="#fff" />
          <View style={{ flex: 1 }}>
            {isFetchingFriendNav ? (
              <Text style={styles.navText} numberOfLines={1}>計算至 {friendNavDest.name} 的路線…</Text>
            ) : friendNavSteps.length > 0 && friendNavStepIdx < friendNavSteps.length ? (
              <Text style={styles.navText} numberOfLines={1}>
                {friendNavSteps[friendNavStepIdx].instruction}
                {friendNavSteps[friendNavStepIdx].distanceM > 0
                  ? `，${formatRouteDistance(friendNavSteps[friendNavStepIdx].distanceM)}後`
                  : ""}
              </Text>
            ) : (
              <Text style={styles.navText} numberOfLines={1}>導航至 {friendNavDest.name}</Text>
            )}
            {friendNavDistM !== null && (
              <Text style={[styles.navDist, { fontSize: 11 }]}>
                {formatRouteDistance(friendNavDistM)}
                {friendNavDurSec !== null ? `·${formatRouteDuration(friendNavDurSec)}` : ""}
                ·{friendNavPreferCycleway ? "車道優先" : "一般路"}
              </Text>
            )}
          </View>
          <Pressable
            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            onPress={stopFriendNav}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>×</Text>
          </Pressable>
        </View>
      )}

      {/* ── 右側工具列 ── */}
      <View style={[styles.toolBar, { top: insets.top + 8, right: 16 }]}>
        {/* 車頭朝前/指北切換按鈕（同時回到當前位置） */}
        <Pressable
          style={[styles.toolBtn, headingUp && styles.toolBtnActive]}
          onPress={() => {
            const next = !headingUp;
            setHeadingUp(next);
            setFollowUser(true);
            const bearing = next ? (currentPos?.heading ?? 0) : 0;
            mapRef.current?.setBearing(bearing, next);
            if (currentPos) {
              mapRef.current?.animateCamera(
                { center: { latitude: currentPos.lat, longitude: currentPos.lon }, zoom: 17 }
              );
            }
          }}
        >
          {headingUp ? (
            <IconSymbol name="arrow.up" size={20} color="#34C759" />
          ) : (
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', lineHeight: 22 }}>N</Text>
          )}
          <Text style={[styles.returnBtnLabel, { color: headingUp ? "#34C759" : "rgba(255,255,255,0.8)" }]}>
            {headingUp ? "車頭" : "指北"}
          </Text>
        </Pressable>
        {/* GPX 路線狀態指示（有路線時顯示清除按鈕） */}
        {gpxRoute && !mapRideActive && (
          <Pressable style={styles.toolBtn} onPress={clearSharedRoute}>
            <IconSymbol name="xmark.circle.fill" size={20} color="#FF3B30" />
          </Pressable>
        )}
        {/* 偏離指引開關（導航中顯示） */}
        {isNavigating && (
          <Pressable
            style={[styles.toolBtn, guidanceEnabled && styles.toolBtnActive]}
            onPress={() => {
              const next = !guidanceEnabled;
              guidanceEnabledRef.current = next; // 同步更新 ref，讓非同步回調也能立即感知
              setGuidanceEnabled(next);
              if (!next) {
                // 關閉指引：立即停止語音、清除所有偏離狀態
                stopSpeech();
                setIsOffRoute(false);
                setReturnPolyline([]);
                setReturnBearing("");
                setRouteDistM(null);
                setRouteDurSec(null);
                setReturnSteps([]);
                setCurrentReturnStepIdx(0);
                lastRerouteRef.current = 0;
              }
            }}
          >
            <IconSymbol name="location.fill" size={18} color={guidanceEnabled ? "#FF9500" : "rgba(255,255,255,0.4)"} />
            <Text style={[styles.returnBtnLabel, { color: guidanceEnabled ? "#FF9500" : "rgba(255,255,255,0.4)" }]}>
              {guidanceEnabled ? "指引" : "關閉"}
            </Text>
          </Pressable>
        )}
        {/* 自行車道優先開關（導航中顯示） */}
        {isNavigating && (
          <Pressable
            style={[styles.toolBtn, preferCycleway && styles.toolBtnActive]}
            onPress={() => {
              const next = !preferCycleway;
              preferCyclewayRef.current = next;
              setPreferCycleway(next);
              lastRouteFetchRef.current = 0;
              routeFetchFailCountRef.current = 0;
              if (isOffRoute) {
                setReturnPolyline([]);
                setIsFetchingRoute(false);
                isFetchingRouteRef.current = false;
              }
            }}
          >
            <IconSymbol name="bicycle" size={18} color={preferCycleway ? "#34C759" : "rgba(255,255,255,0.4)"} />
            <Text style={[styles.returnBtnLabel, { color: preferCycleway ? "#34C759" : "rgba(255,255,255,0.4)" }]}>
              {preferCycleway ? "車道" : "一般"}
            </Text>
          </Pressable>
        )}
        {/* 精簡導航手動觸發按鈕（騎乘中且設定為手動模式時顯示） */}
        {isActive && settings.simplifiedNavMode === "manual" && (
          <Pressable
            style={[styles.toolBtn, simplifiedNavVisible && styles.toolBtnActive]}
            onPress={() => {
              setSimplifiedNavVisible(true);
            }}
          >
            <Text style={{ fontSize: 16, color: simplifiedNavVisible ? "#FFD60A" : "rgba(255,255,255,0.8)" }}>&#9632;</Text>
            <Text style={[styles.returnBtnLabel, { color: simplifiedNavVisible ? "#FFD60A" : "rgba(255,255,255,0.8)" }]}>精簡</Text>
          </Pressable>
        )}
      </View>

      {/* ── 偏離路線提示橫幅（偏離且導航中且指引開啟顯示） ── */}
      {isOffRoute && isNavigating && guidanceEnabled && returnBearing !== "" && (
        <View style={[
          styles.offRouteBanner,
          { top: insets.top + 60 }
        ]}>
          <Text style={styles.offRouteBannerIcon}>⚠️</Text>
          <View style={styles.offRouteBannerText}>
            <Text style={styles.offRouteBannerTitle}>偏離路線 {offRouteDist} m</Text>
            {isFetchingRoute ? (
              <Text style={styles.offRouteBannerSub}>朝{returnBearing}方向前進（計算路徑中…）</Text>
            ) : returnSteps.length > 0 && currentReturnStepIdx < returnSteps.length ? (
              <>
                <Text style={styles.offRouteBannerSub}>
                  {returnSteps[currentReturnStepIdx].instruction}
                  {returnSteps[currentReturnStepIdx].distanceM > 0
                    ? `，${formatRouteDistance(returnSteps[currentReturnStepIdx].distanceM)}後`
                    : ""}
                </Text>
                {routeDistM !== null && (
                  <Text style={styles.offRouteBannerSub}>
                    回歸距離：{formatRouteDistance(routeDistM)}，預估 {routeDurSec !== null ? formatRouteDuration(routeDurSec) : ""}
                  </Text>
                )}
              </>
            ) : routeDistM !== null ? (
              <Text style={styles.offRouteBannerSub}>
                騎車回歸：{formatRouteDistance(routeDistM)}，{routeDurSec !== null ? formatRouteDuration(routeDurSec) : ""}
              </Text>
            ) : (
              <Text style={styles.offRouteBannerSub}>朝{returnBearing}方向回到路線</Text>
            )}
          </View>
        </View>
      )}

      {/* ── GPX 路線提示（無路線時） ── */}
      {!gpxRoute && !isActive && (
        <View style={[styles.noRouteBadge, { top: insets.top + 8, left: 16, right: 72 }]}>
          <IconSymbol name="map.fill" size={13} color="rgba(255,255,255,0.5)" />
          <Text style={styles.noRouteText}>前往「路線」頁面匯入 GPX 路線</Text>
        </View>
      )}

      {/* ── 底部面板（螢幕下方三分之一，可上滑展開） ── */}
      <Animated.View
        style={[styles.panel, { height: panelAnim, paddingBottom: insets.bottom + 8 }]}
      >
        {/* 拖拉把手 */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.panelHandle} />
          {/* 天氣列 */}
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
              {isPaused && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedText}>已暫停</Text>
                </View>
              )}
            </View>
          )}
          {!weather && isPaused && (
            <View style={[styles.weatherRow, { justifyContent: "center" }]}>
              <View style={styles.pausedBadge}>
                <Text style={styles.pausedText}>已暫停</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── 儀表板（依設定動態顯示欄位） ── */}
        <View style={styles.sixGrid}>
          {(settings.normalModeFields?.showElapsed ?? true) && (
            <BigMetric label="騎乘時間" value={formatDuration(state.elapsed)} unit="" wide />
          )}
          {(settings.normalModeFields?.showSpeed ?? true) && (
            <BigMetric label="速度" value={state.currentSpeed > 0 ? state.currentSpeed.toFixed(1) : "--"} unit="km/h" highlight />
          )}
          {(settings.normalModeFields?.showDistance ?? true) && (
            <BigMetric label="距離" value={(state.distance / 1000).toFixed(2)} unit="km" />
          )}
          {(settings.normalModeFields?.showGrade ?? true) && (
            <BigMetric label="坡度" value={isActive ? `${currentGrade > 0 ? "+" : ""}${currentGrade.toFixed(1)}` : "--"} unit="%" warn={currentGrade > 5} />
          )}
          {(settings.normalModeFields?.showPower ?? true) && (
            <BigMetric label="功率" value={`${state.currentPower}`} unit="W" accent />
          )}
          {(settings.normalModeFields?.showAvgSpeed ?? true) && (
            <BigMetric label="均速" value={avgSpeed > 0 ? avgSpeed.toFixed(1) : "--"} unit="km/h" />
          )}
          {(settings.normalModeFields?.showCalories ?? false) && (
            <BigMetric label="卡路里" value={`${Math.round(state.calories)}`} unit="kcal" />
          )}
        </View>

        {/* ── 展開後：總爬升 + 進度條 ── */}
        {panelExpanded && (
          <View style={styles.expandedSection}>
            {/* 總爬升資訊列 */}
            <View style={styles.ascentRow}>
              <View style={styles.ascentItem}>
                <IconSymbol name="arrow.up" size={13} color="#00C853" />
                <Text style={styles.ascentLabel}>總爬升</Text>
                <Text style={styles.ascentValue}>{Math.round(state.totalAscent)}</Text>
                <Text style={styles.ascentUnit}>m</Text>
              </View>
              <View style={styles.ascentDivider} />
              <View style={styles.ascentItem}>
                <IconSymbol name="arrow.down" size={13} color="#4FC3F7" />
                <Text style={styles.ascentLabel}>坡度</Text>
                <Text style={[styles.ascentValue, { color: currentGrade > 5 ? "#F59E0B" : currentGrade > 8 ? "#EF4444" : "rgba(255,255,255,0.9)" }]}>
                  {isActive ? `${currentGrade > 0 ? "+" : ""}${currentGrade.toFixed(1)}` : "--"}
                </Text>
                <Text style={styles.ascentUnit}>%</Text>
              </View>
              <View style={styles.ascentDivider} />
              <View style={styles.ascentItem}>
                <IconSymbol name="bolt.fill" size={13} color="#00E676" />
                <Text style={styles.ascentLabel}>最大功率</Text>
                <Text style={[styles.ascentValue, { color: "#00E676" }]}>{state.maxPower}</Text>
                <Text style={styles.ascentUnit}>W</Text>
              </View>
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
            <View style={[styles.progressSection, { marginTop: 10 }]}>
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
          </View>
        )}

        {/* ── 控制按鈕 ── */}
        <View style={styles.btnRow}>
          {!isActive ? (
            <Pressable
              style={({ pressed }) => [styles.startBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleStart}
            >
              <IconSymbol name="play.fill" size={20} color="#fff" />
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
                <IconSymbol name="stop.fill" size={18} color="#fff" />
                <Text style={styles.startBtnText}>結束</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* 展開/收縮提示 */}
        <Pressable
          style={styles.expandHint}
          onPress={() => togglePanel(!panelExpanded)}
        >
          <Text style={styles.expandHintText}>
            {panelExpanded ? "下滑收起" : "上滑查看更多"}
          </Text>
          <IconSymbol
            name="chevron.right"
            size={12}
            color="rgba(255,255,255,0.3)"
            style={{ transform: [{ rotate: panelExpanded ? "90deg" : "-90deg" }] }}
          />
        </Pressable>
      </Animated.View>

      {/* ── 補給 Modal ── */}
      <SupplyModal
        calorieAlert={calorieAlert}
        waterAlert={waterAlert}
        recommendedMl={supplyRecommendedMl}
        onConfirmCalorie={() => {
          setCalorieAlert(false);
          dispatch({ type: "CONSUME_CALORIES" });
          calorieAnim.setValue(0);
          calorieReminderSentRef.current = false;
          if (settings.vibrationEnabled) vibrateSuccess();
        }}
        onConfirmWater={() => {
          setWaterAlert(false);
          setSupplyRecommendedMl(undefined);
          dispatch({ type: "CONSUME_WATER" });
          waterAnim.setValue(0);
          waterReminderSentRef.current = false;
          if (settings.vibrationEnabled) vibrateSuccess();
        }}
        onDismiss={() => {
          setCalorieAlert(false);
          setWaterAlert(false);
        }}
      />

      {/* ── 騎乘摘要 Modal ── */}
      <RideSummaryModal
        visible={showSummary}
        onClose={(routeName) => {
          setShowSummary(false);
          if (routeName && routeName.trim() && state.records.length > 0) {
            const latestRecord = state.records[0];
            updateRecordName(latestRecord.id, routeName.trim());
          }
          dispatch({ type: "RESET" });
        }}
      />

      {/* ── 隊伍遙測橫幅（騎乘中、已登入、開啟隊伍遙測）── */}
      {isActive && isAuthenticated && settings.teamTelemetryEnabled && teamQuery.data && teamQuery.data.length > 0 && (
        <View style={[styles.teamBanner, { bottom: tabBarH + PANEL_COLLAPSED_H + 8 }]}>
          {teamQuery.data.slice(0, 3).map((friend) => {
            const distM = currentPos
              ? Math.round(haversine(currentPos.lat, currentPos.lon, friend.latitude, friend.longitude))
              : null;
            const dwellInfo = (teamQuery.data as any[]).find?.((d: any) => d.userId === friend.userId);
            return (
              <View key={friend.userId} style={styles.teamMember}>
                <View style={[styles.teamDot, { backgroundColor: friend.speed > 1 ? "#34C759" : "#FF9500" }]} />
                <Text style={styles.teamName} numberOfLines={1}>{friend.name ?? "好友"}</Text>
                {distM !== null && settings.showFriendDistance && (
                  <Text style={styles.teamDist}>
                    {distM < 1000 ? `${distM}m` : `${(distM / 1000).toFixed(1)}km`}
                  </Text>
                )}
                {friend.speed > 0 && (
                  <Text style={styles.teamSpeed}>{(friend.speed * 3.6).toFixed(0)}km/h</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── 精簡導航模式── */}
      <SimplifiedNavOverlay
        visible={simplifiedNavVisible}
        onDismiss={() => {
          setSimplifiedNavVisible(false);
          resetIdleTimer();
        }}
        speed={state.currentSpeed ?? 0}
        distance={(state.distance ?? 0) / 1000}
        remainingDist={distToEnd !== null ? distToEnd / 1000 : undefined}
        direction={navInstruction || undefined}
        currentTime={new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })}
        elapsedTime={formatDuration(state.elapsed ?? 0)}
        fields={settings.simplifiedModeFields}
      />

      {/* ── 好友詳細卡片 ── */}
      {tappedFriend !== null && (
        <View style={styles.friendCard}>
          <View style={styles.friendCardHeader}>
            <View style={[styles.friendCardDot, { backgroundColor: tappedFriend.isMoving ? "#34C759" : "#FF9500" }]} />
            <Text style={styles.friendCardName}>{tappedFriend.name}</Text>
            <Pressable
              style={styles.friendCardClose}
              onPress={() => setTappedFriend(null)}
            >
              <Text style={styles.friendCardCloseText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.friendCardBody}>
            <View style={styles.friendCardMetric}>
              <Text style={styles.friendCardMetricLabel}>狀態</Text>
              <Text style={[styles.friendCardMetricValue, { color: tappedFriend.isMoving ? "#34C759" : "#FF9500" }]}>
                {tappedFriend.isMoving ? "行進中" : "停留中"}
              </Text>
            </View>
            <View style={styles.friendCardMetric}>
              <Text style={styles.friendCardMetricLabel}>速度</Text>
              <Text style={styles.friendCardMetricValue}>
                {tappedFriend.speed > 0 ? `${(tappedFriend.speed * 3.6).toFixed(1)} km/h` : "--"}
              </Text>
            </View>
            <View style={styles.friendCardMetric}>
              <Text style={styles.friendCardMetricLabel}>距我</Text>
              <Text style={styles.friendCardMetricValue}>
                {currentPos
                  ? (() => {
                      const d = haversine(currentPos.lat, currentPos.lon, tappedFriend.lat, tappedFriend.lon);
                      return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
                    })()
                  : "--"}
              </Text>
            </View>
          </View>
          {/* 導航前往按鈕區 */}
          <View style={styles.friendCardNavRow}>
            <Pressable
              style={styles.friendCardNavBtn}
              onPress={() => startFriendNav(tappedFriend.name, tappedFriend.lat, tappedFriend.lon, true)}
            >
              <IconSymbol name="bicycle" size={16} color="#fff" />
              <Text style={styles.friendCardNavBtnText}>車道優先</Text>
            </Pressable>
            <Pressable
              style={[styles.friendCardNavBtn, { backgroundColor: "rgba(0,122,255,0.85)" }]}
              onPress={() => startFriendNav(tappedFriend.name, tappedFriend.lat, tappedFriend.lon, false)}
            >
              <IconSymbol name="location.fill" size={16} color="#fff" />
              <Text style={styles.friendCardNavBtnText}>一般路線</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── 子元件 ───────────────────────────────────────────────────────────────────

function BigMetric({ label, value, unit, accent, highlight, warn, wide }: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  highlight?: boolean;
  warn?: boolean;
  wide?: boolean;
}) {
  const color = accent ? "#00E676" : highlight ? "#fff" : warn ? "#F59E0B" : "rgba(255,255,255,0.9)";
  const fontSize = highlight ? 32 : wide ? 26 : 22;
  return (
    <View style={[bigMetricStyles.cell, wide && bigMetricStyles.wideCell]}>
      <Text style={bigMetricStyles.label}>{label}</Text>
      <View style={bigMetricStyles.valueRow}>
        <Text style={[bigMetricStyles.value, { color, fontSize }]}>{value}</Text>
        {unit ? <Text style={bigMetricStyles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const bigMetricStyles = StyleSheet.create({
  cell: {
    width: "33.33%",
    alignItems: "center",
    paddingVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(255,255,255,0.06)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  wideCell: {},
  label: { color: "rgba(255,255,255,0.38)", fontSize: 10, marginBottom: 3, letterSpacing: 0.3 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  value: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  unit: { fontSize: 10, color: "rgba(255,255,255,0.35)" },
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
  returnBtn: {
    backgroundColor: "rgba(255,149,0,0.2)",
    borderColor: "#FF9500",
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: "column",
    gap: 2,
  },
  returnBtnLabel: { color: "#FF9500", fontSize: 10, fontWeight: "700" },

  // 偏離路線提示橫幅
  offRouteBanner: {
    position: "absolute",
    left: 16,
    right: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,149,0,0.88)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  offRouteBannerIcon: { fontSize: 18 },
  offRouteBannerText: { flex: 1 },
  offRouteBannerTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  offRouteBannerSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 1 },

  noRouteBadge: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  noRouteText: { color: "rgba(255,255,255,0.5)", fontSize: 11 },

  // 底部面板
  panel: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#0d0d1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
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
    marginBottom: 2,
  },
  weatherItem: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
  weatherSep: { color: "rgba(255,255,255,0.2)", fontSize: 11 },
  pausedBadge: {
    backgroundColor: "rgba(245,158,11,0.2)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  pausedText: { color: "#F59E0B", fontSize: 11, fontWeight: "600" },

  // 六格儀表板
  sixGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
    marginTop: 2,
  },

  // 展開區域
  expandedSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
    marginTop: 4,
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

  // 控制按鈕
  btnRow: { alignItems: "center", marginTop: 10, marginBottom: 2 },
  activeButtons: { flexDirection: "row", alignItems: "center", gap: 12 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 32,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#00C853",
    justifyContent: "center",
  },
  stopBtn: { backgroundColor: "#FF3B30" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.5 },
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
    paddingTop: 4,
  },
  expandHintText: { color: "rgba(255,255,255,0.25)", fontSize: 10 },

  // 總爬升資訊列
  ascentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  ascentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  ascentDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  ascentLabel: { color: "rgba(255,255,255,0.38)", fontSize: 10 },
  ascentValue: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "700" },
  ascentUnit: { color: "rgba(255,255,255,0.35)", fontSize: 10 },
  // 崩潰恢復橫幅
  recoveryBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.88)",
    borderRadius: 14,
    padding: 16,
    zIndex: 200,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.5)",
  },
  recoveryTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  recoveryDesc: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginBottom: 12,
  },
  recoveryBtns: {
    flexDirection: "row",
    gap: 10,
  },
  recoveryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  recoveryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  // 隊伍遙測橫幅
  teamBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 150,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  teamMember: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 60,
  },
  teamDist: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
  },
  teamSpeed: {
    color: "#34C759",
    fontSize: 11,
    fontWeight: "600",
  },
  // 好友詳細卡片
  friendCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    backgroundColor: "rgba(18,18,18,0.96)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    zIndex: 300,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  friendCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  friendCardDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  friendCardName: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  friendCardClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  friendCardCloseText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 20,
    lineHeight: 24,
  },
  friendCardBody: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  friendCardMetric: {
    alignItems: "center",
    gap: 4,
  },
  friendCardMetricLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
  },
  friendCardMetricValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  friendCardNavRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
  },
  friendCardNavBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(52,199,89,0.85)",
    borderRadius: 10,
    paddingVertical: 10,
  },
  friendCardNavBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
