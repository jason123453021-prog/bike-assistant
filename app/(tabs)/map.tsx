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
  useReducer,
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
import * as Battery from "expo-battery";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";

import { useColors } from "@/hooks/use-colors";
import { useRide } from "@/lib/ride-context";
import { useSettings, DEFAULT_FIELD_ORDER, type NormalFieldKey } from "@/lib/settings-context";
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
import { getSensorDataManager } from "@/lib/sensor-data-manager";
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
import { BackgroundLocationTracking } from "@/lib/native-modules";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SupplyModal } from "@/components/supply-modal";
import { RideSummaryModal } from "@/components/ride-summary-modal";
import { SimplifiedNavOverlay } from "@/components/simplified-nav-overlay";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useFriendNav } from "@/lib/friend-nav-context";
import { ForegroundServiceManager } from "@/lib/foreground-service";
import { EmotionalUXManager } from "@/lib/emotional-ux";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const OFF_ROUTE_THRESHOLD_M = 50;
const ARRIVAL_THRESHOLD_M = 30;
const TURN_LOOKAHEAD_M = 150;
const TURN_ANGLE_DEG = 30;
const REROUTE_COOLDOWN_MS = 15000;
const AUTO_PAUSE_THRESHOLD = 1.5; // 自動暫停速度閾值（km/h）
const AUTO_PAUSE_RESUME_THRESHOLD = 3; // 自動恢復速度閾值（km/h）- 高於暫停閾值，避免頻繁切換
const WEATHER_INTERVAL = 10 * 60 * 1000;
const LOCATION_INTERVAL_SEC = 3;
const GPS_DRIFT_FILTER_M = 3; // GPS 漂移過濾：距離小於此值時視為漂移，不更新速度

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

  // Audio — 使用混音模式，不中斷背景音樂（iOS: mixWithOthers；Android: duckOthers 僅短暫降低背景音量）
  const alertPlayer = useAudioPlayer(require("../../assets/sounds/alert.mp3"));
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",   // iOS: 與背景音樂混音，不中斷
      interruptionModeAndroid: "duckOthers", // Android: 短暫降低背景音量後恢復
      shouldPlayInBackground: false,
    }).catch(() => {});
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
  // 俯視角設定（0-60 度）
  const [mapPitch, setMapPitch] = useState(0);

  // 功率平滑：5 點滑動平均
  const powerWindowRef = useRef<number[]>([]);

  // 感測器數據管理
  const sensorManagerRef = useRef(getSensorDataManager());
  const [sensorData, setSensorData] = useState({
    heartRate: null as number | null,
    power: null as number | null,
    cadence: null as number | null,
    maxHeartRate: null as number | null,
    maxPower: null as number | null,
    maxCadence: null as number | null,
  });
  const sensorUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 感測器統計數據（用於記錄保存）
  const sensorStatsRef = useRef({
    heartRateValues: [] as number[],
    cadenceValues: [] as number[],
    maxHeartRate: 0,
    maxCadence: 0,
  });

  // 自動暫停連續計數（需連續 4 次低速才暫停，避免 GPS 抖動誤觸發）
  const lowSpeedCountRef = useRef(0);
  const AUTO_PAUSE_CONSECUTIVE = 4;
  // 速度平滑窗口（用於過濾 GPS 速度抖動）
  const speedWindowRef = useRef<number[]>([]);
  const lastValidSpeedRef = useRef<number>(0);

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
  // 強制重渲染計數器（讓 ref 變更立即反映到 UI）
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
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
          edgePadding: { top: 80, right: 40, bottom: dynamicCollapsedH + 40, left: 40 },
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
  // 車頭朝前精度改善：自適應循環平均（消除 GPS heading 抖動）
  // 低速時用 11 點平均（更平滑），高速時用 7 點平均（更靈敏）
  const headingWindowRef = useRef<number[]>([]);
  const prevSpeedRef = useRef<number>(0); // 用於判斷速度變化
  // 上一個 GPS 位置（用於低速時計算方位角）
  const prevGpsForBearingRef = useRef<{ lat: number; lon: number } | null>(null);
  // 地圖旋轉動畫（平滑過渡）
  const targetBearingRef = useRef<number>(0);
  const lastMapBearingRef = useRef<number>(0);

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
  // 重複提醒計時器
  const supplyRepeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // 追蹤尚未確認的補給類型（「稍後」只關閉 Modal，不清除此 ref）
  const pendingCalorieRef = useRef(false);
  const pendingWaterRef = useRef(false);
  const lastAscentRef = useRef(0); // 用於判斷下坡狀態

  // ── 自訂補給品追蹤 ──
  // 記錄每個補給品上次觸發的時間（秒）或距離（公里）
  const supplyItemsTrackerRef = useRef<Record<string, any>>({});
  // 追蹤器結構: { lastTriggerTime, lastTriggerDistance, triggered, dismissTimeoutId, repeatIntervalId }
  // 自訂補給品提醒狀態
  const [customSupplyAlerts, setCustomSupplyAlerts] = useState<Record<string, boolean>>({});
  const [activeSupplyAlerts, setActiveSupplyAlerts] = useState<string[]>([]);

  // 清除重複提醒計時器
  const clearSupplyRepeatTimer = useCallback(() => {
    if (supplyRepeatTimerRef.current) {
      clearInterval(supplyRepeatTimerRef.current);
      supplyRepeatTimerRef.current = null;
    }
    pendingCalorieRef.current = false;
    pendingWaterRef.current = false;
  }, []);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 進度條動畫
  const calorieAnim = useRef(new Animated.Value(0)).current;
  const waterAnim = useRef(new Animated.Value(0)).current;

  const handleConfirmCustomSupply = useCallback((id: string, type: "time" | "distance") => {
    setCustomSupplyAlerts(prev => ({ ...prev, [id]: false }));
    setActiveSupplyAlerts(prev => prev.filter(alertId => alertId !== id));
    const tracker = supplyItemsTrackerRef.current[id];
    if (tracker?.dismissTimeoutId) clearTimeout(tracker.dismissTimeoutId);
    if (tracker?.repeatIntervalId) clearInterval(tracker.repeatIntervalId);
    supplyItemsTrackerRef.current[id] = {
      lastTriggerTime: type === "time" ? state.elapsed : supplyItemsTrackerRef.current[id]?.lastTriggerTime || 0,
      lastTriggerDistance: type === "distance" ? (state.distance / 1000) : supplyItemsTrackerRef.current[id]?.lastTriggerDistance || 0,
      triggered: false,
      dismissTimeoutId: null,
      repeatIntervalId: null,
    };
    speak(`已確認補給${settings.supplyItems.find(s => s.id === id)?.name}`, settings.ttsEnabled);
    vibrateLight();
  }, [state.elapsed, state.distance, settings.supplyItems, settings.ttsEnabled]);

  const sortedActiveAlerts = useMemo(() => {
    return activeSupplyAlerts.sort((a, b) => {
      const indexA = settings.supplyItems.findIndex(item => item.id === a);
      const indexB = settings.supplyItems.findIndex(item => item.id === b);
      return indexA - indexB;
    });
  }, [activeSupplyAlerts, settings.supplyItems]);
  
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
      enabled: isAuthenticated && settings.teamTelemetryEnabled,
      refetchInterval: 5000,
    }
  );

  const hydrationThresholdMl = settings.waterThreshold > 0
    ? settings.waterThreshold
    : DEFAULT_HYDRATION_THRESHOLD_ML;

  // ─── 底部面板滑桿 ─────────────────────────────────────────────────────────────
  const [panelExpanded, setPanelExpanded] = useState(false);
  // ── 儀表板欄位排序：依 normalModeFieldOrder 排序，只顯示已啟用的欄位 ──
  const orderedEnabledFields = useMemo(() => {
    const f = settings.normalModeFields;
    const order: NormalFieldKey[] = settings.normalModeFieldOrder ?? DEFAULT_FIELD_ORDER;
    return order.filter((key) => f?.[key] ?? false);
  }, [settings.normalModeFields, settings.normalModeFieldOrder]);

  // 前6格顯示在收縮面板，第7格以上移至展開區
  const DASH_PANEL_MAX = 6;
  const dashPanelFields = useMemo(() => orderedEnabledFields.slice(0, DASH_PANEL_MAX), [orderedEnabledFields]);
  const dashOverflowFields = useMemo(() => orderedEnabledFields.slice(DASH_PANEL_MAX), [orderedEnabledFields]);
  const dashFieldCount = dashPanelFields.length;

  // 每行3格，每格約60px；最少1行，最多不超過 SCREEN_H/3
  const CELL_H = 60;
  const HEADER_H = 80; // 天氣列 + 暫停徽章
  const CTRL_H = 64;   // 控制按鈕列
  const dashRows = Math.ceil(dashFieldCount / 3) || 1;
  const dashGridH = dashRows * CELL_H;
  const dynamicCollapsedH = Math.min(
    HEADER_H + dashGridH + CTRL_H,
    PANEL_COLLAPSED_H
  );

  const panelAnim = useRef(new Animated.Value(dynamicCollapsedH)).current;
  const prevCollapsedH = useRef(dynamicCollapsedH);

  // 當欄位數變化時，若面板未展開則更新動畫值
  useEffect(() => {
    if (!panelExpanded && dynamicCollapsedH !== prevCollapsedH.current) {
      prevCollapsedH.current = dynamicCollapsedH;
      Animated.timing(panelAnim, {
        toValue: dynamicCollapsedH,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [dynamicCollapsedH, panelExpanded, panelAnim]);

  const togglePanel = useCallback((expand: boolean) => {
    setPanelExpanded(expand);
    Animated.timing(panelAnim, {
      toValue: expand ? PANEL_EXPANDED_H : dynamicCollapsedH,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [panelAnim, dynamicCollapsedH]);

  // 面板手勢（整個面板區域可上拉/下滑）
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

      // 記錄尚未確認的補給類型
      if (type === "calorie") pendingCalorieRef.current = true;
      else pendingWaterRef.current = true;

      // 單次提醒自動關閉功能
      const autoDismissSeconds = type === "calorie" ? settings.calorieAutoDismissSeconds : settings.waterAutoDismissSeconds;
      if (autoDismissSeconds && autoDismissSeconds > 0) {
        setTimeout(() => {
          if (type === "calorie") {
            setCalorieAlert(false);
            pendingCalorieRef.current = false;
          } else {
            setWaterAlert(false);
            pendingWaterRef.current = false;
          }
        }, autoDismissSeconds * 1000);
      }

      // 未關閉時重複提醒功能
      const repeatUntilDismissed = type === "calorie" ? settings.calorieRepeatUntilDismissed : settings.waterRepeatUntilDismissed;
      if (repeatUntilDismissed) {
        const repeatInterval = setInterval(() => {
          const isPending = type === "calorie" ? pendingCalorieRef.current : pendingWaterRef.current;
          if (isPending) {
            if (settings.vibrationEnabled) vibrateWarning();
            if (settings.ttsEnabled) speakSupplyReminder(type, true);
            if (settings.soundEnabled) {
              try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
            }
          } else {
            clearInterval(repeatInterval);
          }
        }, 5000);
      }

      // 啟動重複提醒計時器（若已有則不重複啟動）
      const repeatSec = settings.supplyReminderRepeatSec ?? 60;
      if (repeatSec > 0 && !supplyRepeatTimerRef.current) {
        supplyRepeatTimerRef.current = setInterval(() => {
          // 使用 pendingRef 判斷（「稍後」關閉 Modal 不會清除此 ref）
          const caloriePending = pendingCalorieRef.current;
          const waterPending = pendingWaterRef.current;
          if (!caloriePending && !waterPending) {
            clearSupplyRepeatTimer();
            return;
          }
          // 重新顯示 Modal
          if (caloriePending) setCalorieAlert(true);
          if (waterPending) setWaterAlert(true);
          // 重複音效與語音
          if (settings.ttsEnabled) {
            if (caloriePending) speakSupplyReminder("calorie", true);
            else speakSupplyReminder("water", true);
          }
          if (settings.vibrationEnabled) vibrateWarning();
          if (settings.soundEnabled) {
            try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
          }
        }, repeatSec * 1000);
      }
    },
    [settings, alertPlayer, clearSupplyRepeatTimer]
  );

  // ─── 自訂補給品觸發邏輯 ────────────────────────────────────────────────────────
  const triggerCustomSupplyReminder = useCallback(
    async (supplyItem: any) => {
      if (!supplyItem.enabled) return;

      // 初始化追蹤器
      if (!supplyItemsTrackerRef.current[supplyItem.id]) {
        supplyItemsTrackerRef.current[supplyItem.id] = {
          lastTriggerTime: 0,
          lastTriggerDistance: 0,
          triggered: false,
          dismissTimeoutId: null,
          repeatIntervalId: null,
        };
      }

      const tracker = supplyItemsTrackerRef.current[supplyItem.id];
      const currentTime = stateRef.current.elapsed;
      const currentDistance = stateRef.current.distance / 1000;

      // 粗略判斷下坡：速度 > 25 km/h 且海拔不上升
      const isDownhill = stateRef.current.currentSpeed > 25 && stateRef.current.totalAscent <= lastAscentRef.current;
      // 更新最後海拔
      lastAscentRef.current = stateRef.current.totalAscent;

      if (supplyItem.pauseOnDownhill && isDownhill && !customSupplyAlerts[supplyItem.id]) {
        // 下坡時暫停提醒但仍計數，不觸發提醒
        return;
      }

      // 根據觸發方式檢查是否應該觸發
      let shouldTrigger = false;
      if (supplyItem.triggerType === "time") {
        const targetSec = (supplyItem.triggerHours || 0) * 3600 + (supplyItem.triggerMinutes || 0) * 60 + (supplyItem.triggerSeconds || 0);
        if (targetSec > 0) {
          shouldTrigger = currentTime - tracker.lastTriggerTime >= targetSec;
        }
      } else if (supplyItem.triggerType === "distance") {
        shouldTrigger = currentDistance - tracker.lastTriggerDistance >= supplyItem.triggerValue;
      }

      if (!shouldTrigger) return;

      // 根據重複模式決定是否顯示
      if (supplyItem.repeatMode === "once" && tracker.triggered) {
        return; // 只提醒一次，已觸發過則不再提醒
      }
      if (supplyItem.repeatMode === "off") {
        return; // 不提醒
      }

      // 如果已經在提醒中且未關閉時重複提醒未啟用，則不再觸發
      if (customSupplyAlerts[supplyItem.id] && !supplyItem.repeatUntilDismissed) {
        return;
      }

      // 觸發提醒
      setCustomSupplyAlerts((prev) => ({ ...prev, [supplyItem.id]: true }));
      setActiveSupplyAlerts((prev) => {
        if (!prev.includes(supplyItem.id)) {
          return [...prev, supplyItem.id];
        }
        return prev;
      });
      tracker.triggered = true;

      // 更新觸發時間/距離
      if (supplyItem.triggerType === "time") {
        tracker.lastTriggerTime = currentTime;
      } else {
        tracker.lastTriggerDistance = currentDistance;
      }

      // 播放回饋
      if (settings.vibrationEnabled) vibrateWarning();
      if (settings.ttsEnabled) speak(`請補給 ${supplyItem.name}`);
      if (settings.soundEnabled) {
        try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
      }
      if (settings.notificationEnabled) showSupplyNotification("calorie");

      // 單次提醒自動關閉功能
      if (supplyItem.autoDismissSeconds && supplyItem.autoDismissSeconds > 0) {
        if (tracker.dismissTimeoutId) clearTimeout(tracker.dismissTimeoutId);
        tracker.dismissTimeoutId = setTimeout(() => {
          setCustomSupplyAlerts((prev) => ({ ...prev, [supplyItem.id]: false }));
          setActiveSupplyAlerts((prev) => prev.filter((id) => id !== supplyItem.id));
          tracker.dismissTimeoutId = null;
        }, supplyItem.autoDismissSeconds * 1000);
      }

      // 未關閉時重複提醒功能
      if (supplyItem.repeatUntilDismissed) {
        if (tracker.repeatIntervalId) clearInterval(tracker.repeatIntervalId);
        tracker.repeatIntervalId = setInterval(() => {
          if (customSupplyAlerts[supplyItem.id]) {
            if (settings.vibrationEnabled) vibrateWarning();
            if (settings.ttsEnabled) speak(`請補給 ${supplyItem.name}`);
            if (settings.soundEnabled) {
              try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
            }
          } else {
            if (tracker.repeatIntervalId) {
              clearInterval(tracker.repeatIntervalId);
              tracker.repeatIntervalId = null;
            }
          }
        }, 5000);
      }
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
        timerRef.current = setInterval(() => {
          dispatch({ type: "PAUSE_TICK" });
        }, 1000);
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
          // 自適應循環平均：根據速度調整平均窗口大小
          // 低速（≤5 km/h）：11 點平均，高速（>15 km/h）：7 點平均
          const windowSize = speedKmhRaw <= 5 ? 11 : speedKmhRaw >= 15 ? 7 : 9;
          headingWindowRef.current.push(rawHdg);
          if (headingWindowRef.current.length > windowSize) headingWindowRef.current.shift();
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
          // 車頭朝前模式：僅在騎乘中且速度足夠時更新地圖方向和俯視角
          const currentState0 = stateRef.current;
          if (headingUp && currentState0.status === "active" && speedKmhRaw >= 2) {
            // 平滑旋轉：計算最短旋轉路徑（避免 350° -> 10° 時旋轉 340°）
            targetBearingRef.current = hdg;
            let angleDiff = hdg - lastMapBearingRef.current;
            if (angleDiff > 180) angleDiff -= 360;
            if (angleDiff < -180) angleDiff += 360;
            
            // 只在角度變化超過 0.3° 時更新地圖，提高靈敏度
            // 速度越快，靈敏度越高（閾值越小）
            const sensitivityThreshold = speedKmhRaw >= 20 ? 0.2 : speedKmhRaw >= 10 ? 0.3 : 0.4;
            if (Math.abs(angleDiff) > sensitivityThreshold) {
              const { width, height } = Dimensions.get("window");
              const isPortrait = height > width;
              // 速度越快，平滑係數越大（更快地跟隨方向變化）
              const smoothFactor = speedKmhRaw >= 20 ? (isPortrait ? 0.7 : 0.65) : (isPortrait ? 0.6 : 0.5);
              const newBearing = (lastMapBearingRef.current + angleDiff * smoothFactor) % 360;
              lastMapBearingRef.current = newBearing;
              mapRef.current?.setBearing(newBearing, true);
            }
            
            // 根據速度動態設定俯視角（速度越快，俯視角越小）
            // 低速時保持平視（0°），高速時逐漸增加俯視角
            const pitch = speedKmhRaw >= 5 ? Math.max(0, Math.min(45, (speedKmhRaw - 5) * 1.2)) : 0;
            if (Math.abs(pitch - mapPitch) > 1) {
              setMapPitch(pitch);
              mapRef.current?.setPitch(pitch);
            }
          } else if (headingUp && mapPitch > 0) {
            // 速度不足或非車頭朝前模式時恢復上下俯視
            setMapPitch(0);
            mapRef.current?.setPitch(0);
          }

          const wd = windDataRef.current;
          if (wd.speed > 0) {
            setRelativeWindInfo(getRelativeWindInfo(hdg, wd.direction, wd.speed * 3.6));
          }

          const speedKmh = (speed ?? 0) * 3.6;
          const currentState = stateRef.current;

          // ── 自動暫停/恢復（改進版本）──────────────────────────────────────────────
          // 1. GPS 漂移過濾：距離小於 3m 時視為漂移，保持上一個有效速度
          // 2. 速度平滑：使用 5 點滑動平均過濾速度抖動
          // 3. 連續計數：需連續 4 次低速才暫停
          // 4. 不對稱閾值：暫停 1.5 km/h，恢復 3 km/h（避免頻繁切換）
          
          let smoothedSpeed = speedKmh;
          
          // GPS 漂移過濾
          if (prevPosRef.current) {
            const dist = haversine(prevPosRef.current.lat, prevPosRef.current.lon, latitude, longitude);
            if (dist < GPS_DRIFT_FILTER_M) {
              // GPS 漂移，保持上一個有效速度
              smoothedSpeed = lastValidSpeedRef.current;
            } else {
              // 有效移動，更新有效速度
              lastValidSpeedRef.current = speedKmh;
            }
          }
          
          // 速度平滑（5 點滑動平均）
          speedWindowRef.current.push(smoothedSpeed);
          if (speedWindowRef.current.length > 5) speedWindowRef.current.shift();
          const avgSpeed = speedWindowRef.current.reduce((a, b) => a + b, 0) / speedWindowRef.current.length;
          
          // 自動暫停/恢復邏輯
          if (currentState.status === "active") {
            if (avgSpeed < AUTO_PAUSE_THRESHOLD) {
              lowSpeedCountRef.current += 1;
              if (lowSpeedCountRef.current >= AUTO_PAUSE_CONSECUTIVE) {
                lowSpeedCountRef.current = 0;
                pausedElapsedRef.current = currentState.elapsed;
                dispatch({ type: "PAUSE" });
                // 暫停時強制歸零速度與功率
                dispatch({ type: "LOCATION_UPDATE", point: { latitude, longitude, altitude: altitude ?? 0, speed: 0, timestamp: Date.now() }, power: 0, calories: 0, ascent: 0 });
                if (settings.ttsEnabled) speakAutoPause(true);
                if (settings.vibrationEnabled) vibrateMedium();
                // 集成情感化 UX - 自動暫停反饋
                EmotionalUXManager.onAutoPauseTriggered('speed').catch((error: any) => console.warn("Auto pause emotional UX failed:", error));
                return;
              }
            } else {
              lowSpeedCountRef.current = 0;
            }
          } else if (currentState.status === "paused" && avgSpeed >= AUTO_PAUSE_RESUME_THRESHOLD) {
            lowSpeedCountRef.current = 0;
            dispatch({ type: "RESUME" });
            // 集成情感化 UX - 自動恢復反饋
            EmotionalUXManager.onRideResumed().catch((error: any) => console.warn("Auto resume emotional UX failed:", error));
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

          // 軌跡點始終記錄，其他數據僅在 active 狀態下更新
          if (currentState.status !== "active") {
            dispatch({
              type: "LOCATION_UPDATE",
              point: { latitude, longitude, altitude: altitude ?? 0, speed: speed ?? 0, timestamp: Date.now() },
              power: 0, calories: 0, ascent: 0,
            });
            return;
          }

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
          // 優先使用感測器功率，若無則使用計算功率
          let power = sensorData.power ?? rawPower;
          // 若使用計算功率，則進行 5 點滑動平均平滑
          if (sensorData.power === null) {
            powerWindowRef.current.push(rawPower);
            if (powerWindowRef.current.length > 5) powerWindowRef.current.shift();
            power = Math.round(
              powerWindowRef.current.reduce((a, b) => a + b, 0) / powerWindowRef.current.length
            );
          } else {
            // 使用感測器功率時，清空計算功率緩衝
            powerWindowRef.current = [];
          }
          // 使用基於功率的卡路里計算（修正後的效率係數）
          const calIncrement = calculateCalories(power, LOCATION_INTERVAL_SEC);
          
          // 備選：基於 MET 的卡路里計算（更準確，但需要體重）
          // const calIncrementMET = calculateCaloriesMET(speedKmh, settings.weight, LOCATION_INTERVAL_SEC, calcGrade(ascent, distanceM));
          // 當前使用功率法，因為功率已包含所有物理因素

          // 計算真實 GPS 距離（米）
          let distanceM = 0;
          if (lastLocationRef.current) {
            distanceM = haversineDistance(
              lastLocationRef.current.coords.latitude,
              lastLocationRef.current.coords.longitude,
              latitude, longitude
            );
          }

          dispatch({
            type: "LOCATION_UPDATE",
            point: { latitude, longitude, altitude: altitude ?? 0, speed: speed ?? 0, timestamp: Date.now() },
            power, calories: calIncrement, ascent, distanceM,
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

          // 檢查下坡狀態
          const isDownhill = currentState.currentSpeed > 25 && currentState.totalAscent <= lastAscentRef.current;
          lastAscentRef.current = currentState.totalAscent;

          // 卡路里提醒邏輯
          if (calPct >= 1 && !calorieReminderSentRef.current) {
            if (settings.caloriePauseOnDownhill && isDownhill && !calorieAlert) {
              // 下坡時暫停提醒但仍計數
            } else {
              calorieReminderSentRef.current = true;
              triggerSupplyReminder("calorie");
            }
          }

          // 水分提醒邏輯
          if (waterPct >= 1 && !waterReminderSentRef.current) {
            if (settings.waterPauseOnDownhill && isDownhill && !waterAlert) {
              // 下坡時暫停提醒但仍計數
            } else {
              waterReminderSentRef.current = true;
              triggerSupplyReminder("water", sweatResult.recommendedRefillMl);
            }
          }

          // ── 自訂補給品觸發 ──
          if (settings.supplyItems && settings.supplyItems.length > 0) {
            for (const supplyItem of settings.supplyItems) {
              triggerCustomSupplyReminder(supplyItem);
            }
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
    setCustomSupplyAlerts({}); // 重置自訂補給品提醒狀態

    // 初始化自訂補給品追蹤器
    supplyItemsTrackerRef.current = {};
    settings.supplyItems.filter(s => s.enabled).forEach(item => {
      supplyItemsTrackerRef.current[item.id] = {
        lastTriggerTime: 0,
        lastTriggerDistance: 0,
        triggered: false,
      };
    });

    // 感測器初始化
    setSensorData({
      heartRate: null,
      power: null,
      cadence: null,
      maxHeartRate: null,
      maxPower: null,
      maxCadence: null,
    });
    // 清空感測器統計數據
    sensorStatsRef.current = {
      heartRateValues: [],
      cadenceValues: [],
      maxHeartRate: 0,
      maxCadence: 0,
    };
    // 啟動感測器數據更新迴圈（每 1 秒更新一次）
    if (sensorUpdateIntervalRef.current) clearInterval(sensorUpdateIntervalRef.current);
    sensorUpdateIntervalRef.current = setInterval(() => {
      const data = sensorManagerRef.current.getSensorData();
      setSensorData({
        heartRate: data.heartRate,
        power: data.power,
        cadence: data.cadence,
        maxHeartRate: data.maxHeartRate,
        maxPower: data.maxPower,
        maxCadence: data.maxCadence,
      });
      // 記錄感測器統計數據
      if (data.heartRate !== null && data.heartRate !== undefined) {
        sensorStatsRef.current.heartRateValues.push(data.heartRate);
        sensorStatsRef.current.maxHeartRate = Math.max(sensorStatsRef.current.maxHeartRate, data.heartRate);
      }
      if (data.cadence !== null && data.cadence !== undefined) {
        sensorStatsRef.current.cadenceValues.push(data.cadence);
        sensorStatsRef.current.maxCadence = Math.max(sensorStatsRef.current.maxCadence, data.cadence);
      }
    }, 1000);

    if (gpxRoute) {
      setIsNavigating(true);
      setNavInstruction("導航已啟動");
      speak("導航已啟動，沿路線前進", settings.ttsEnabled);
    }

    await startBackgroundLocationTracking();

    // 啟動原生後台位置追蹤（Android）
    try {
      await BackgroundLocationTracking.start();
      console.log('[Map] Native background location tracking started');
    } catch (error) {
      console.warn('[Map] Native background location tracking failed:', error);
    }

    // 初始化並啟動 Foreground Service
    try {
      await ForegroundServiceManager.initialize({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 5,
      });
      await ForegroundServiceManager.startLocationTracking();
    } catch (error) {
      console.warn('Foreground Service initialization failed:', error);
    }

    // 初始化情感化 UX
    try {
      await EmotionalUXManager.initialize({
        hapticEnabled: true,
        ttsEnabled: settings.ttsEnabled,
        language: 'zh-TW',
      });
    } catch (error) {
      console.warn('Emotional UX initialization failed:', error);
    }

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
          
          // 停止原生後台位置追蹤（Android）
          try {
            await BackgroundLocationTracking.stop();
            console.log('[Map] Native background location tracking stopped');
          } catch (error) {
            console.warn('[Map] Native background location tracking stop failed:', error);
          }
          if (weatherTimerRef.current) clearInterval(weatherTimerRef.current);
          // 結束騎乘清除感測器更新迴圈
          if (sensorUpdateIntervalRef.current) clearInterval(sensorUpdateIntervalRef.current);
          sensorUpdateIntervalRef.current = null;
          setSensorData({
            heartRate: null,
            power: null,
            cadence: null,
            maxHeartRate: null,
            maxPower: null,
            maxCadence: null,
          });
          await cancelRidingNotification();
          // 結束騎乘清除補給重複提醒計時器
          clearSupplyRepeatTimer();
          setCalorieAlert(false);
          setWaterAlert(false);
          setCustomSupplyAlerts({}); // 重置自訂補給品提醒狀態
          supplyItemsTrackerRef.current = {}; // 重置自訂補給品追蹤器

          // 結束騎乘清除崩潰恢復快照
          await clearSnapshot();
          // 先不帶名稱儲存記錄，之後在摘要 Modal 取得名稱後更新
          await saveRecord(undefined, sensorStatsRef.current);
          setShowSummary(true);
          if (settings.vibrationEnabled) vibrateSuccess();
          
          // 集成情感化 UX - 騎乘完成反饋
          try {
            await EmotionalUXManager.onRideCompleted(state.elapsed, state.distance);
          } catch (error) {
            console.warn('Ride completed emotional UX failed:', error);
          }
        },
      },
    ]);
  }, [dispatch, saveRecord, clearSnapshot, settings.vibrationEnabled, clearSupplyRepeatTimer]);

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
      { edgePadding: { top: 80, right: 40, bottom: dynamicCollapsedH + 40, left: 40 }, animated: true }
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

  // 每次 GPS 更新時，若已登入且開啟分享位置，即上報位置（不限騎乘中）
  useEffect(() => {
    if (!isAuthenticated || !settings.shareLocation || !currentPos) return;
    const doUpload = async () => {
      let batteryLevel = -1;
      try {
        if (Platform.OS !== "web") {
          const level = await Battery.getBatteryLevelAsync();
          batteryLevel = Math.round(level * 100);
        }
      // 集成情感化 UX - 低電量警告
      if (batteryLevel > 0 && batteryLevel <= 20) {
        EmotionalUXManager.onLowBatteryWarning(batteryLevel).catch((error: any) => console.warn("Low battery emotional UX failed:", error));
      }
      } catch { /* 忽略電量讀取失敗 */ }
      updateLocationMutation.mutate({
        latitude: currentPos.lat,
        longitude: currentPos.lon,
        speed: state.currentSpeed ?? 0,
        heading: currentPos.heading,
        altitude: 0,
        isGhostMode: settings.ghostMode,
        batteryLevel,
      });
    };
    doUpload();
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
                name: f.name ?? f.email?.split('@')[0] ?? '好友',
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
      {/* 黑色導航橫條已移除（導航資訊已透過偶離路線提示橫幅顯示） */}

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
              const next = !guidanceEnabledRef.current; // 直接讀 ref，避免 closure 舊值
              guidanceEnabledRef.current = next;
              setGuidanceEnabled(next); // 同步 state 供其他 effect 使用
              forceRender(); // 立即重渲染，不等 React 批次更新
              if (!next) {
                // 關閉指引：立即停止語音、清除所有偷離狀態（包含 returnBearing）
                stopSpeech();
                setIsOffRoute(false);
                setReturnPolyline([]);
                setReturnBearing("");
                setRouteDistM(null);
                setRouteDurSec(null);
                setReturnSteps([]);
                setCurrentReturnStepIdx(0);
                lastRerouteRef.current = 0;
              } else {
                // 重新開啟指引：重置偷離計時器，讓偷離檢測立即重新執行
                lastRerouteRef.current = 0;
                routeFetchFailCountRef.current = 0;
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
      {isOffRoute && isNavigating && guidanceEnabledRef.current && returnBearing !== "" && (
        <View style={[
          styles.offRouteBanner,
          { top: insets.top + 8 }
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

      {/* ── GPX 路線提示（無路線時，且無導航指令條顯示時） ── */}
      {!gpxRoute && !isActive && !isNavigating && navInstruction === "" && !friendNavDest && (
        <View style={[styles.noRouteBadge, { top: insets.top + 8, left: 16, right: 72 }]}>
          <IconSymbol name="map.fill" size={13} color="rgba(255,255,255,0.5)" />
          <Text style={styles.noRouteText}>前往「路線」頁面匯入 GPX 路線</Text>
        </View>
      )}

      {/* ── 底部面板（螢幕下方三分之一，可上滑展開） ── */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.panel, { height: panelAnim, paddingBottom: insets.bottom + 8 }]}
      >
        {/* 拖拉把手 */}
        <View style={styles.handleArea}>
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

        {/* ── 儀表板（依排序動態顯示，前6格在收縮面板） ── */}
        <View style={styles.sixGrid}>
          {dashPanelFields.map((key) => (
            <DashMetric key={key} fieldKey={key} state={state} isActive={isActive} currentGrade={currentGrade} avgSpeed={avgSpeed} sensorData={sensorData} />
          ))}
        </View>

        {/* ── 展開後：總爬升 + 進度條 ── */}
        {panelExpanded && (
          <View style={styles.expandedSection}>
            {/* 超出6格的儀表板欄位（上拉展開後顯示） */}
            {dashOverflowFields.length > 0 && (
              <View style={[styles.sixGrid, { marginBottom: 8 }]}>
                {dashOverflowFields.map((key) => (
                  <DashMetric key={key} fieldKey={key} state={state} isActive={isActive} currentGrade={currentGrade} avgSpeed={avgSpeed} sensorData={sensorData} />
                ))}
              </View>
            )}
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

            {/* 自訂補給品進度條 */}
            {settings.supplyItems.filter(s => s.enabled).map(item => {
              const tracker = supplyItemsTrackerRef.current[item.id] || { lastTriggerTime: 0, lastTriggerDistance: 0, triggered: false };
              let progress = 0;
              let currentVal = 0;
              let targetVal = 0;
              let unit = "";
              
              if (item.triggerType === "time") {
                const targetSec = (item.triggerHours || 0) * 3600 + (item.triggerMinutes || 0) * 60 + (item.triggerSeconds || 0);
                if (targetSec > 0) {
                  currentVal = state.elapsed - tracker.lastTriggerTime;
                  targetVal = targetSec;
                  progress = Math.min(1, currentVal / targetVal);
                  unit = "分";
                  currentVal = Math.floor(currentVal / 60);
                  targetVal = Math.floor(targetVal / 60);
                }
              } else {
                if (item.triggerValue && item.triggerValue > 0) {
                  currentVal = (state.distance / 1000) - tracker.lastTriggerDistance;
                  targetVal = item.triggerValue;
                  progress = Math.min(1, currentVal / targetVal);
                  unit = "km";
                  currentVal = Number(currentVal.toFixed(1));
                }
              }
              
              const isAlerting = customSupplyAlerts[item.id];
              const barColor = isAlerting ? "#EF4444" : "#9C27B0";
              
              return (
                <View key={item.id} style={[styles.progressSection, { marginTop: 10 }]}>
                  <View style={styles.progressHeader}>
                    <View style={styles.progressLabelRow}>
                      <IconSymbol name="bag.fill" size={13} color={barColor} />
                      <Text style={styles.progressLabel}>{item.name}</Text>
                    </View>
                    <Text style={styles.progressValue}>{currentVal} / {targetVal} {unit}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: barColor }]} />
                  </View>
                  {isAlerting && (
                    <Pressable 
                      style={[styles.supplyConfirmBtn, { backgroundColor: barColor }]}
                      onPress={() => handleConfirmCustomSupply(item.id, item.triggerType)}
                    >
                      <Text style={styles.supplyConfirmText}>確認已補給</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

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
        customSupplyAlerts={sortedActiveAlerts.map(id => {
          const item = settings.supplyItems.find(i => i.id === id);
          return {
            id,
            name: item?.name || 'Unknown',
            onConfirm: () => handleConfirmCustomSupply(id, item?.triggerType || 'time'),
          };
        })}
        onConfirmCalorie={() => {
          setCalorieAlert(false);
          dispatch({ type: "CONSUME_CALORIES" });
          calorieAnim.setValue(0);
          calorieReminderSentRef.current = false;
          pendingCalorieRef.current = false; // 確認補給，清除待處理標記
          if (settings.vibrationEnabled) vibrateSuccess();
          // 如果水分提醒也已確認，清除重複計時器
          if (!pendingWaterRef.current) clearSupplyRepeatTimer();
        }}
        onConfirmWater={() => {
          setWaterAlert(false);
          setSupplyRecommendedMl(undefined);
          dispatch({ type: "CONSUME_WATER" });
          waterAnim.setValue(0);
          waterReminderSentRef.current = false;
          pendingWaterRef.current = false; // 確認補給，清除待處理標記
          if (settings.vibrationEnabled) vibrateSuccess();
          // 如果卡路里提醒也已確認，清除重複計時器
          if (!pendingCalorieRef.current) clearSupplyRepeatTimer();
        }}
        onDismiss={() => {
          setCalorieAlert(false);
          setWaterAlert(false);
          // 「稍後提醒」：不清除 pendingRef，重複計時器到期後會重新顯示 Modal
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

      {/* 隊伍遙測橫幅已移除（好友位置資訊已可透過點擊地圖標記查看） */}

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
        grade={currentGrade}
        power={sensorData.power ?? state.currentPower}
        avgSpeed={avgSpeed}
        calories={Math.round(state.calories)}
        pausedTime={formatDuration(state.totalPausedSec ?? 0)}
        totalAscent={state.totalAscent}
        currentAltitude={state.currentAltitude}
        fields={settings.simplifiedModeFields}
        fieldOrder={settings.simplifiedModeFieldOrder}
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

// DashMetric: 依 fieldKey 渲染對應的儀表板欄位
function DashMetric({ fieldKey, state, isActive, currentGrade, avgSpeed, sensorData }: {
  fieldKey: NormalFieldKey;
  state: any;
  isActive: boolean;
  currentGrade: number;
  avgSpeed: number;
  sensorData?: any;
}) {
  switch (fieldKey) {
    case "showElapsed":
      return <BigMetric label="騎乘時間" value={formatDuration(state.elapsed)} unit="" />;
    case "showSpeed":
      return <BigMetric label="速度" value={state.currentSpeed > 0 ? state.currentSpeed.toFixed(1) : "--"} unit="km/h" highlight />;
    case "showDistance":
      return <BigMetric label="距離" value={(state.distance / 1000).toFixed(2)} unit="km" />;
    case "showGrade":
      return <BigMetric label="坡度" value={isActive ? `${currentGrade > 0 ? "+" : ""}${currentGrade.toFixed(1)}` : "--"} unit="%" warn={currentGrade > 5} />;
    case "showPower":
      // 優先顯示感測器功率，若無則顯示計算功率
      const displayPower = sensorData.power ?? state.currentPower;
      const isSensorPower = sensorData.power !== null && sensorData.power !== undefined;
      return <BigMetric label={isSensorPower ? "功率 (感測器)" : "功率"} value={`${displayPower}`} unit="W" accent />;
    case "showAvgSpeed":
      return <BigMetric label="均速" value={avgSpeed > 0 ? avgSpeed.toFixed(1) : "--"} unit="km/h" />;
    case "showCalories":
      return <BigMetric label="卡路里" value={`${Math.round(state.calories)}`} unit="kcal" />;
    case "showPausedTime":
      return <BigMetric label="暫停時間" value={formatDuration(state.totalPausedSec)} unit="" />;
    case "showHeartRate":
      // 優先顯示平滑心率，若無則顯示 "--"
      const displayHR = sensorData?.smoothedHeartRate ?? sensorData?.heartRate ?? null;
      const isHRSensor = displayHR !== null && displayHR !== undefined;
      return <BigMetric label={isHRSensor ? "心率 (感測器)" : "心率"} value={displayHR !== null ? `${displayHR}` : "--"} unit="bpm" />;
    case "showCadence":
      // 優先顯示平滑踏頻，若無則顯示 "--"
      const displayCadence = sensorData?.smoothedCadence ?? sensorData?.cadence ?? null;
      const isCadenceSensor = displayCadence !== null && displayCadence !== undefined;
      return <BigMetric label={isCadenceSensor ? "踏頻 (感測器)" : "踏頻"} value={displayCadence !== null ? `${displayCadence}` : "--"} unit="rpm" />;
    case "showTotalAscent":
      return <BigMetric label="累計爬升" value={state.totalAscent ? state.totalAscent.toFixed(0) : "0"} unit="m" />;
    case "showCurrentAltitude":
      return <BigMetric label="目前海拔" value={state.currentAltitude ? state.currentAltitude.toFixed(0) : "--"} unit="m" />;
    case "showGradeDistribution":
      // 計算坡度分布百分比
      const totalDist = state.gradeDistribution.reduce((a: number, b: number) => a + b, 0);
      const gradePcts = totalDist > 0
        ? state.gradeDistribution.map((d: number) => ((d / totalDist) * 100).toFixed(0))
        : ["0", "0", "0", "0", "0", "0"];
      return (
        <View style={styles.gradeDistributionContainer}>
          <Text style={styles.gradeDistributionLabel}>坡度分布</Text>
          <View style={styles.gradeDistributionBars}>
            <View style={[styles.gradeBar, { width: `${Math.max(5, parseInt(gradePcts[0]))}%`, backgroundColor: "#34C759" }]} />
            <View style={[styles.gradeBar, { width: `${Math.max(5, parseInt(gradePcts[1]))}%`, backgroundColor: "#FFD60A" }]} />
            <View style={[styles.gradeBar, { width: `${Math.max(5, parseInt(gradePcts[2]))}%`, backgroundColor: "#FF9500" }]} />
            <View style={[styles.gradeBar, { width: `${Math.max(5, parseInt(gradePcts[3]))}%`, backgroundColor: "#FF6B6B" }]} />
            <View style={[styles.gradeBar, { width: `${Math.max(5, parseInt(gradePcts[4]))}%`, backgroundColor: "#FF453A" }]} />
            <View style={[styles.gradeBar, { width: `${Math.max(5, parseInt(gradePcts[5]))}%`, backgroundColor: "#8B0000" }]} />
          </View>
          <View style={styles.gradeDistributionLabels}>
            <Text style={styles.gradeDistributionLegend}>1-5%</Text>
            <Text style={styles.gradeDistributionLegend}>6-10%</Text>
            <Text style={styles.gradeDistributionLegend}>11-15%</Text>
            <Text style={styles.gradeDistributionLegend}>16-20%</Text>
            <Text style={styles.gradeDistributionLegend}>21-25%</Text>
            <Text style={styles.gradeDistributionLegend}>26%+</Text>
          </View>
        </View>
      );
    default:
      return null;
  }
}

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

  // 底部面板（統計面板移至地圖下方）
  panel: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(13, 13, 26, 0.75)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  handleArea: {
    alignItems: "center",
    paddingBottom: 8,
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
  supplyConfirmBtn: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  supplyConfirmText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  gradeDistributionContainer: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  gradeDistributionLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  gradeDistributionBars: {
    flexDirection: "row",
    height: 24,
    gap: 2,
    marginBottom: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  gradeBar: {
    flex: 1,
    borderRadius: 2,
  },
  gradeDistributionLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 2,
  },
  gradeDistributionLegend: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    flex: 1,
    textAlign: "center",
  },
});
