/**
 * 導航頁面（整合版）
 *
 * 功能：
 * - 全螢幕深色 Leaflet 地圖
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
  AppState,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import LeafletMapView, { type LeafletMapHandle, type NavigationRouteOverlay } from "@/components/leaflet-map";
import * as Location from "expo-location";
import * as Battery from "expo-battery";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import Svg, { Circle } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";
import { useRide } from "@/lib/ride-context";
import { deriveAutoPersonalMetrics } from "@/lib/auto-personal-metrics";
import { calculateAgeFromBirthday } from "@/lib/personal-profile";
import { useSettings, DEFAULT_FIELD_ORDER, type NormalFieldKey } from "@/lib/settings-context";
import { useGpx } from "@/lib/gpx-context";

import { type GpxPoint, type GpxRoute } from "@/lib/gpx-parser";
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
  calculatePersonalizedCalories,
} from "@/lib/personalized-ride-calculations";
import { createSupplyPlan, type SupplyPlan } from "@/lib/smart-supply-plan";
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  setBackgroundLocationTrackingMode,
  initBackgroundState,
  getBackgroundTrackPoints,
  getBackgroundState,
  updateBackgroundEnvironment,
  clearBackgroundData,
  acknowledgeBackgroundSupplyInterval,
  acknowledgeBackgroundSupplyReminder,
  type GpsAccuracyLevel,
} from "@/lib/background-location";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SupplyModal } from "@/components/supply-modal";
import { RideSummaryModal } from "@/components/ride-summary-modal";
import { SimplifiedNavOverlay } from "@/components/simplified-nav-overlay";
import { EmotionalUXManager } from "@/lib/emotional-ux";
import {
  type CompassData,
  type GPSVector,
  getFinalDirection,
  smoothHeading,
} from "@/lib/compass-gps-optimizer";
import {
  addTrackPoint,
  completeRideSession,
  createNewRideSession,
  initializeRideSession,
  saveRideSessionSnapshot,
  type RideSession,
} from "@/lib/ride-recovery/ride-session-recovery";
import { SmartPowerSavingManager } from "@/lib/power-saving/smart-power-saving-system";
import { getDueSupplyIntervals, type SupplyIntervalKind } from "@/lib/supply-interval";
import {
  consumeSupplyNotificationActions,
  scheduleSupplySnooze,
  subscribeToSupplyNotificationActions,
  type SupplyNotificationAction,
  type SupplyNotificationKind,
} from "@/lib/supply-notification-actions";
import {
  applyPinnedNavigationDecision,
  hasExistingNavigationLayers,
  type PinnedNavigationLayer,
} from "@/lib/pinned-navigation-layers";
import { shouldTrackRideHeading, shouldTrackRideLocation } from "@/lib/ride-tracking-lifecycle";
import { shouldEnterIdleMonitor, shouldResumeFromIdleMonitor, type RideLocationTrackingMode } from "@/lib/idle-auto-pause";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const ARRIVAL_THRESHOLD_M = 30;
const TURN_LOOKAHEAD_M = 150;
const TURN_ANGLE_DEG = 30;
const AUTO_PAUSE_THRESHOLD = 1.5; // 自動暫停速度閾值（km/h）
const AUTO_PAUSE_RESUME_THRESHOLD = 3; // 自動恢復速度閾值（km/h）- 高於暫停閾值，避免頻繁切換
const WEATHER_INTERVAL = 10 * 60 * 1000;
const LOCATION_INTERVAL_SEC = 3;
const GPS_DRIFT_FILTER_M = 3; // GPS 漂移過濾：距離小於此值時視為漂移，不更新速度
const AUTO_RECENTER_AFTER_INTERACTION_MS = 12_000;

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

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { state, dispatch, saveRecord, updateRideActivity, saveSnapshot, clearSnapshot, checkSnapshot } = useRide();
  const { settings } = useSettings();
  const { sharedRoute, clearSharedRoute } = useGpx();
  const autoPersonalMetrics = useMemo(() => deriveAutoPersonalMetrics(state.records, {
    ftpW: settings.ftp,
    age: settings.age,
    birthday: settings.birthday,
    maxHeartRate: settings.maxHeartRate,
    restingHeartRate: settings.restingHeartRate,
  }), [state.records, settings.age, settings.birthday, settings.ftp, settings.maxHeartRate, settings.restingHeartRate]);
  const estimateFtpW = settings.autoPersonalMetricsEnabled ? autoPersonalMetrics.ftpW : settings.ftp;
  const estimateAgeYears = calculateAgeFromBirthday(settings.birthday) ?? settings.age;

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
  const currentPosRef = useRef<{ lat: number; lon: number; heading: number } | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const idlePauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const idleMonitorLastPositionRef = useRef<{ lat: number; lon: number } | null>(null);
  const [rideLocationTrackingMode, setRideLocationTrackingMode] = useState<RideLocationTrackingMode>("full");
  const recoverySessionRef = useRef<RideSession | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [touchGuardEnabled, setTouchGuardEnabled] = useState(false);
  const powerSavingManagerRef = useRef(SmartPowerSavingManager.getInstance());
  const autoRecenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!settings.touchGuardEnabled) setTouchGuardEnabled(false);
  }, [settings.touchGuardEnabled]);

  useEffect(() => {
    currentPosRef.current = currentPos;
  }, [currentPos]);

  const scheduleAutoRecenter = useCallback(() => {
    setFollowUser(false);
    if (autoRecenterTimerRef.current) clearTimeout(autoRecenterTimerRef.current);
    autoRecenterTimerRef.current = setTimeout(() => {
      const position = currentPosRef.current;
      if (!position) return;
      // 不傳入 zoom，也不修改 bearing：保留使用者手動調整的縮放與角度。
      mapRef.current?.animateCamera({ center: { latitude: position.lat, longitude: position.lon } }, { duration: 350 });
      setFollowUser(true);
    }, AUTO_RECENTER_AFTER_INTERACTION_MS);
  }, []);

  // 導航固定採車頭朝前：以行進方向優先、低速時以平滑羅盤輔助。
  const headingUp = true;
  // 俯視角設定（0-60 度）
  const [mapPitch, setMapPitch] = useState(0);

  // 功率平滑：5 點滑動平均
  const powerWindowRef = useRef<number[]>([]);

  // 自動暫停連續計數（需連續 4 次低速才暫停，避免 GPS 抖動誤觸發）
  const lowSpeedCountRef = useRef(0);
  const AUTO_PAUSE_CONSECUTIVE = 4;
  // 速度平滑窗口（用於過濾 GPS 速度抖動）
  const speedWindowRef = useRef<number[]>([]);
  const lastValidSpeedRef = useRef<number>(0);

  // 崩潰恢復
  const [showRecoveryAlert, setShowRecoveryAlert] = useState(false);
  const [recoverySnapshot, setRecoverySnapshot] = useState<Partial<import("@/lib/ride-context").RideState> | null>(null);

  // 匯入 GPX 與釘選 OSRM 路徑分開保存，讓使用者可選擇清除或並存顯示。
  const [pinnedNavigationLayers, setPinnedNavigationLayers] = useState<PinnedNavigationLayer<GpxRoute>[]>([]);
  const [activeNavigationRoute, setActiveNavigationRoute] = useState<GpxRoute | null>(null);
  const gpxRoute = activeNavigationRoute ?? sharedRoute ?? pinnedNavigationLayers[pinnedNavigationLayers.length - 1]?.route ?? null;
  const hasExistingRouteLayers = hasExistingNavigationLayers(Boolean(sharedRoute), pinnedNavigationLayers.length);

  // 導航狀態
  const [isNavigating, setIsNavigating] = useState(false);
  const [nearestIdx, setNearestIdx] = useState(0);
  const [navInstruction, setNavInstruction] = useState<string>("");
  const [distToEnd, setDistToEnd] = useState<number | null>(null);
  const arrivedRef = useRef(false);
  // 釘選 OSRM 路徑一律採自行車道優先；不提供偏離後自動重新規劃。
  const preferCycleway = true;

  useEffect(() => {
    if (sharedRoute) setActiveNavigationRoute(sharedRoute);
  }, [sharedRoute]);

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
  const environmentSummaryRef = useRef({
    sampleCount: 0,
    temperatureTotal: 0,
    humidityTotal: 0,
    windSpeedTotal: 0,
    headwindTotal: 0,
    precipitationTotal: 0,
    latestWeatherCode: undefined as number | undefined,
    hadLiveWeather: false,
  });
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

  // 騎乘狀態與背景監聽
  const [mapRideActive, setMapRideActive] = useState(false);
  const [isAppForeground, setIsAppForeground] = useState(true);
  const touchGuardHintOpacity = useRef(new Animated.Value(0)).current;
  const [touchGuardHoldProgress, setTouchGuardHoldProgress] = useState(0);
  const touchGuardHoldStartedAtRef = useRef<number | null>(null);
  const touchGuardHoldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showTouchGuardUnlockSuccess, setShowTouchGuardUnlockSuccess] = useState(false);
  const touchGuardUnlockSuccessOpacity = useRef(new Animated.Value(0)).current;
  const touchGuardUnlockSuccessScale = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppForeground(nextState === "active");
    });
    return () => subscription.remove();
  }, []);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryRecordId, setSummaryRecordId] = useState<string | null>(null);
  // 補給提醒分別管理（支援兩種同時顯示）
  const [calorieAlert, setCalorieAlert] = useState(false);
  const [waterAlert, setWaterAlert] = useState(false);
  const [supplyRecommendedMl, setSupplyRecommendedMl] = useState<number | undefined>(undefined);
  const [supplyRecommendation, setSupplyRecommendation] = useState<SupplyPlan | undefined>(undefined);

  const calorieReminderSentRef = useRef(false);
  const waterReminderSentRef = useRef(false);
  const notifPermRef = useRef(false);
  // 重複提醒計時器
  const supplyRepeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // 追蹤尚未確認的補給類型（「稍後」只關閉 Modal，不清除此 ref）
  const pendingCalorieRef = useRef(false);
  const pendingWaterRef = useRef(false);
  const supplySnoozedUntilRef = useRef<Record<"calorie" | "water", number>>({ calorie: 0, water: 0 });
  const lastAscentRef = useRef(0); // 用於判斷下坡狀態
  const rideStartLocationRef = useRef<{ lat: number; lon: number } | null>(null); // 記錄騎乘開始座標
  const lastTurnSpokenRef = useRef<number>(0); // 追蹤上次播報轉彎的時間
  // 電子羅盤訂閱 ref
  const compassHeadingRef = useRef<CompassData | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  // 轉彎指示增強狀態
  const [turnDirection, setTurnDirection] = useState<'left' | 'right' | 'arrive' | null>(null);
  const [turnDistanceM, setTurnDistanceM] = useState<number>(0);

  // ── 地圖釘選功能（按鈕 + 中心圖釘） ──
  const [pinSelectMode, setPinSelectMode] = useState(false); // 釘選模式是否啟動
  const [centerPinLocation, setCenterPinLocation] = useState<{ lat: number; lon: number } | null>(null); // 中心圖釘的位置
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [pinnedLocationLabel, setPinnedLocationLabel] = useState<string | null>(null);
  const [showPinCard, setShowPinCard] = useState(false);
  const [isFetchingPinRoute, setIsFetchingPinRoute] = useState(false);
  const [pinRouteInfo, setPinRouteInfo] = useState<{ distM: number; durSec: number; polyline: { latitude: number; longitude: number }[] } | null>(null);
  const [pinAddress, setPinAddress] = useState("");
  const [isResolvingPinAddress, setIsResolvingPinAddress] = useState(false);

  const clearAllNavigationLayers = useCallback(() => {
    // 立即通知 Leaflet 清空已繪製圖層與數字標記，避免等待 React state 更新而短暫殘留。
    mapRef.current?.clearNavigationGraphics();
    clearSharedRoute();
    setPinnedNavigationLayers([]);
    setActiveNavigationRoute(null);
    setNearestIdx(0);
    setIsNavigating(false);
    setMapRideActive(false);
    setDistToEnd(null);
    setNavInstruction("");
    setPinnedLocation(null);
    setPinnedLocationLabel(null);
    setCenterPinLocation(null);
    setShowPinCard(false);
    setPinRouteInfo(null);
    arrivedRef.current = false;
  }, [clearSharedRoute]);

  const startPinnedNavigationRoute = useCallback((route: GpxRoute, announcement: string) => {
    const nextLayer: PinnedNavigationLayer<GpxRoute> = {
      id: `pinned-${Date.now()}`,
      route,
    };
    const commitRoute = (clearExisting: boolean) => {
      if (clearExisting) clearSharedRoute();
      setPinnedNavigationLayers((previous) => applyPinnedNavigationDecision(previous, nextLayer, clearExisting));
      setActiveNavigationRoute(route);
      setIsNavigating(true);
      setMapRideActive(true);
      setFollowUser(true);
      setNearestIdx(0);
      arrivedRef.current = false;
      speak(announcement, settings.ttsEnabled);
    };

    if (!hasExistingNavigationLayers(Boolean(sharedRoute), pinnedNavigationLayers.length)) {
      commitRoute(false);
      return;
    }

    Alert.alert(
      "清除先前導航路徑？",
      "地圖已有 GPX 或釘選導航路徑。清除會完整移除所有舊路徑、起訖標記與方向箭頭；保留則新舊路徑會以不同顏色一起顯示。",
      [
        { text: "取消", style: "cancel" },
        { text: "保留並開始", onPress: () => commitRoute(false) },
        { text: "清除並開始", style: "destructive", onPress: () => commitRoute(true) },
      ],
    );
  }, [clearSharedRoute, pinnedNavigationLayers.length, settings.ttsEnabled, sharedRoute]);

  const handleResolvePinAddress = useCallback(async () => {
    const address = pinAddress.trim();
    if (!address) {
      Alert.alert("輸入地址", "請輸入目的地地址、地標或店家名稱。");
      return;
    }
    setIsResolvingPinAddress(true);
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        const requested = await Location.requestForegroundPermissionsAsync();
        if (requested.status !== "granted") {
          Alert.alert("需要定位權限", "地址導航需要前景定位權限，才能將目的地接入現有導航流程。");
          return;
        }
      }
      const results = await Location.geocodeAsync(address);
      const destination = results[0];
      if (!destination) {
        Alert.alert("找不到地址", "請補上城市、區域或門牌後再搜尋，也可直接移動地圖中心圖釘選點。");
        return;
      }
      const nextLocation = { lat: destination.latitude, lon: destination.longitude };
      setPinnedLocation(nextLocation);
      setPinnedLocationLabel(address);
      setPinRouteInfo(null);
      setShowPinCard(true);
      setPinSelectMode(false);
      setCenterPinLocation(null);
      mapRef.current?.animateCamera({ center: { latitude: nextLocation.lat, longitude: nextLocation.lon }, zoom: 16 }, { duration: 360 });
    } catch {
      Alert.alert("地址搜尋暫時不可用", "請確認網路與定位服務後再試；離線時仍可直接移動地圖，以中心圖釘選擇目的地。");
    } finally {
      setIsResolvingPinAddress(false);
    }
  }, [pinAddress]);

  // ── 自訂補給品追蹤 ──
  // 記錄每個補給品上次觸發的時間（秒）或距離（公里）
  const supplyItemsTrackerRef = useRef<Record<string, any>>({});
  // 追蹤器結構: { lastTriggerTime, lastTriggerDistance, triggered, dismissTimeoutId, repeatIntervalId }
  // 自訂補給品提醒狀態
  const [customSupplyAlerts, setCustomSupplyAlerts] = useState<Record<string, boolean>>({});
  const [activeSupplyAlerts, setActiveSupplyAlerts] = useState<string[]>([]);
  // 通用補給間隔：與自訂補給品分開追蹤，確認後只重置對應類型的基準。
  const intervalSupplyTrackerRef = useRef({ lastTimeSec: 0, lastDistanceKm: 0 });
  const intervalSupplyAlertsRef = useRef<Partial<Record<SupplyIntervalKind, boolean>>>({});
  const [intervalSupplyAlerts, setIntervalSupplyAlerts] = useState<Partial<Record<SupplyIntervalKind, boolean>>>({});
  const intervalSupplyRepeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalSnoozedUntilRef = useRef<Partial<Record<SupplyIntervalKind, number>>>({});

  // 清除重複提醒計時器
  const clearSupplyRepeatTimer = useCallback(() => {
    if (supplyRepeatTimerRef.current) {
      clearInterval(supplyRepeatTimerRef.current);
      supplyRepeatTimerRef.current = null;
    }
    pendingCalorieRef.current = false;
    pendingWaterRef.current = false;
  }, []);
  const clearIntervalSupplyRepeatTimer = useCallback(() => {
    if (intervalSupplyRepeatTimerRef.current) {
      clearInterval(intervalSupplyRepeatTimerRef.current);
      intervalSupplyRepeatTimerRef.current = null;
    }
  }, []);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);
  const lastBgSyncTsRef = useRef<number>(0); // 背景軌跡去重：記錄上次同步的最大時間戳
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

  const handleConfirmIntervalSupply = useCallback((kind: SupplyIntervalKind) => {
    const current = stateRef.current;
    if (kind === "time") intervalSupplyTrackerRef.current.lastTimeSec = current.elapsed;
    else intervalSupplyTrackerRef.current.lastDistanceKm = current.distance / 1000;
    void acknowledgeBackgroundSupplyInterval(kind);

    const nextAlerts = { ...intervalSupplyAlertsRef.current, [kind]: false };
    intervalSupplyAlertsRef.current = nextAlerts;
    setIntervalSupplyAlerts(nextAlerts);
    if (!nextAlerts.time && !nextAlerts.distance) clearIntervalSupplyRepeatTimer();
    if (settings.ttsEnabled) speak("已確認補給");
    if (settings.vibrationEnabled) vibrateSuccess();
  }, [clearIntervalSupplyRepeatTimer, settings.ttsEnabled, settings.vibrationEnabled]);

  const handleConfirmCalorieSupply = useCallback(() => {
    setCalorieAlert(false);
    dispatch({ type: "CONSUME_CALORIES" });
    dispatch({
      type: "SUPPLY_CONFIRMED",
      confirmation: {
        type: "energy",
        timestamp: Date.now(),
        elapsedSec: stateRef.current.elapsed,
        recommendedEnergyKcal: supplyRecommendation?.energyRecommendationKcal,
        recommendedCarbohydrateG: supplyRecommendation?.carbohydrateRecommendationG,
        source: supplyRecommendation?.source,
        reason: supplyRecommendation?.reason,
      },
    });
    calorieAnim.setValue(0);
    calorieReminderSentRef.current = false;
    pendingCalorieRef.current = false;
    if (!pendingWaterRef.current) setSupplyRecommendation(undefined);
    supplySnoozedUntilRef.current.calorie = 0;
    void acknowledgeBackgroundSupplyReminder("calorie");
    if (settings.vibrationEnabled) vibrateSuccess();
    if (!pendingWaterRef.current) clearSupplyRepeatTimer();
  }, [clearSupplyRepeatTimer, dispatch, settings.vibrationEnabled, supplyRecommendation]);

  const handleConfirmWaterSupply = useCallback(() => {
    setWaterAlert(false);
    setSupplyRecommendedMl(undefined);
    dispatch({ type: "CONSUME_WATER" });
    dispatch({
      type: "SUPPLY_CONFIRMED",
      confirmation: {
        type: "water",
        timestamp: Date.now(),
        elapsedSec: stateRef.current.elapsed,
        recommendedWaterMl: supplyRecommendation?.waterRecommendationMl ?? supplyRecommendedMl,
        source: supplyRecommendation?.source,
        reason: supplyRecommendation?.reason,
      },
    });
    waterAnim.setValue(0);
    waterReminderSentRef.current = false;
    pendingWaterRef.current = false;
    if (!pendingCalorieRef.current) setSupplyRecommendation(undefined);
    supplySnoozedUntilRef.current.water = 0;
    void acknowledgeBackgroundSupplyReminder("water");
    if (settings.vibrationEnabled) vibrateSuccess();
    if (!pendingCalorieRef.current) clearSupplyRepeatTimer();
  }, [clearSupplyRepeatTimer, dispatch, settings.vibrationEnabled, supplyRecommendation, supplyRecommendedMl]);

  const handleSnoozeSupply = useCallback((kind: SupplyNotificationKind) => {
    const until = Date.now() + 5 * 60 * 1000;
    if (kind === "calorie" || kind === "water") {
      supplySnoozedUntilRef.current[kind] = until;
      if (kind === "calorie") setCalorieAlert(false);
      else setWaterAlert(false);
      if (supplyRepeatTimerRef.current) {
        clearInterval(supplyRepeatTimerRef.current);
        supplyRepeatTimerRef.current = null;
      }
    } else {
      const intervalKind: SupplyIntervalKind = kind === "interval-time" ? "time" : "distance";
      intervalSnoozedUntilRef.current[intervalKind] = until;
      const nextAlerts = { ...intervalSupplyAlertsRef.current, [intervalKind]: false };
      intervalSupplyAlertsRef.current = nextAlerts;
      setIntervalSupplyAlerts(nextAlerts);
      clearIntervalSupplyRepeatTimer();
    }
    void scheduleSupplySnooze(kind);
  }, [clearIntervalSupplyRepeatTimer]);

  const processSupplyNotificationAction = useCallback((action: SupplyNotificationAction) => {
    if (action.action === "snooze") {
      handleSnoozeSupply(action.kind);
      return;
    }
    if (action.kind === "calorie") handleConfirmCalorieSupply();
    else if (action.kind === "water") handleConfirmWaterSupply();
    else handleConfirmIntervalSupply(action.kind === "interval-time" ? "time" : "distance");
  }, [handleConfirmCalorieSupply, handleConfirmIntervalSupply, handleConfirmWaterSupply, handleSnoozeSupply]);

  useEffect(() => {
    const processQueuedActions = async () => {
      const actions = await consumeSupplyNotificationActions();
      actions.forEach(processSupplyNotificationAction);
    };
    void processQueuedActions();
    return subscribeToSupplyNotificationActions(() => { void processQueuedActions(); });
  }, [processSupplyNotificationAction]);

  const sortedActiveAlerts = useMemo(() => {
    return activeSupplyAlerts.sort((a, b) => {
      const indexA = settings.supplyItems.findIndex(item => item.id === a);
      const indexB = settings.supplyItems.findIndex(item => item.id === b);
      return indexA - indexB;
    });
  }, [activeSupplyAlerts, settings.supplyItems]);
  
  // 精簡導航模式
  const [simplifiedNavVisible, setSimplifiedNavVisible] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  const isRiding = state.status === "active";
  const isPaused = state.status === "paused";
  const isActive = isRiding || isPaused;
  const touchGuardHoldLabel = settings.touchGuardUnlockHoldMs >= 1000
    ? `${(settings.touchGuardUnlockHoldMs / 1000).toFixed(settings.touchGuardUnlockHoldMs % 1000 === 0 ? 0 : 1)} 秒`
    : `${settings.touchGuardUnlockHoldMs} 毫秒`;
  const isAutoPauseMonitoring = isPaused && rideLocationTrackingMode === "idle_monitor";
  const isAutoPausePending = isPaused && rideLocationTrackingMode === "full";

  useEffect(() => {
    touchGuardHintOpacity.stopAnimation();
    touchGuardHintOpacity.setValue(0);
    if (!touchGuardEnabled || !isActive) return;

    const animation = Animated.sequence([
      Animated.timing(touchGuardHintOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(touchGuardHintOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [isActive, touchGuardEnabled, touchGuardHintOpacity]);

  const resetTouchGuardHoldProgress = useCallback(() => {
    if (touchGuardHoldTimerRef.current) {
      clearInterval(touchGuardHoldTimerRef.current);
      touchGuardHoldTimerRef.current = null;
    }
    touchGuardHoldStartedAtRef.current = null;
    setTouchGuardHoldProgress(0);
  }, []);

  const beginTouchGuardHoldProgress = useCallback(() => {
    if (!touchGuardEnabled || !isActive) return;
    resetTouchGuardHoldProgress();
    touchGuardHoldStartedAtRef.current = Date.now();
    setTouchGuardHoldProgress(0.001);
    touchGuardHoldTimerRef.current = setInterval(() => {
      const startedAt = touchGuardHoldStartedAtRef.current;
      if (!startedAt) return;
      const progress = Math.min(1, (Date.now() - startedAt) / settings.touchGuardUnlockHoldMs);
      setTouchGuardHoldProgress(progress);
    }, 33);
  }, [isActive, resetTouchGuardHoldProgress, settings.touchGuardUnlockHoldMs, touchGuardEnabled]);

  const showTouchGuardUnlockSuccessFeedback = useCallback(() => {
    touchGuardUnlockSuccessOpacity.stopAnimation();
    touchGuardUnlockSuccessScale.stopAnimation();
    touchGuardUnlockSuccessOpacity.setValue(0);
    touchGuardUnlockSuccessScale.setValue(0.82);
    setShowTouchGuardUnlockSuccess(true);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(touchGuardUnlockSuccessOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(touchGuardUnlockSuccessScale, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
      Animated.delay(420),
      Animated.parallel([
        Animated.timing(touchGuardUnlockSuccessOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(touchGuardUnlockSuccessScale, { toValue: 1.08, duration: 260, useNativeDriver: true }),
      ]),
    ]).start(() => setShowTouchGuardUnlockSuccess(false));
  }, [touchGuardUnlockSuccessOpacity, touchGuardUnlockSuccessScale]);

  const completeTouchGuardUnlock = useCallback(() => {
    if (!touchGuardEnabled) return;
    if (touchGuardHoldTimerRef.current) {
      clearInterval(touchGuardHoldTimerRef.current);
      touchGuardHoldTimerRef.current = null;
    }
    touchGuardHoldStartedAtRef.current = null;
    setTouchGuardHoldProgress(1);
    if (settings.vibrationEnabled) vibrateLight();
    showTouchGuardUnlockSuccessFeedback();
    setTouchGuardEnabled(false);
  }, [settings.vibrationEnabled, showTouchGuardUnlockSuccessFeedback, touchGuardEnabled]);

  useEffect(() => () => {
    resetTouchGuardHoldProgress();
    touchGuardUnlockSuccessOpacity.stopAnimation();
    touchGuardUnlockSuccessScale.stopAnimation();
  }, [resetTouchGuardHoldProgress, touchGuardUnlockSuccessOpacity, touchGuardUnlockSuccessScale]);

  useEffect(() => {
    const manager = powerSavingManagerRef.current;
    if (isActive) manager.start();
    else manager.stop();
    return () => manager.stop();
  }, [isActive]);

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
      void updateBackgroundEnvironment({
        temperatureC: w.temperature,
        humidityPct: w.humidity,
        windSpeedKmh: w.windSpeed,
        windDirection: w.windDirection,
        weatherCode: w.weatherCode,
        precipitationProb: w.precipitationProb,
      });
    }
  }, []);

  // ─── 補給提醒 ────────────────────────────────────────────────────────────────
  const triggerSupplyReminder = useCallback(
    async (type: "calorie" | "water", recommendation?: SupplyPlan) => {
      if (supplySnoozedUntilRef.current[type] > Date.now()) return;
      powerSavingManagerRef.current.onSupplyReminder();
      setTouchGuardEnabled(false);
      if (type === "calorie") {
        setCalorieAlert(true);
      } else {
        setWaterAlert(true);
        if (recommendation?.waterRecommendationMl) setSupplyRecommendedMl(recommendation.waterRecommendationMl);
      }
      if (recommendation) setSupplyRecommendation(recommendation);
      if (settings.vibrationEnabled) vibrateWarning();
      if (settings.ttsEnabled) speakSupplyReminder(type, true);
      if (settings.soundEnabled) {
        try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
      }
      if (settings.notificationEnabled) {
        void showSupplyNotification(type, recommendation ? {
          energyKcal: recommendation.energyRecommendationKcal,
          carbohydrateG: recommendation.carbohydrateRecommendationG,
          waterMl: recommendation.waterRecommendationMl,
          reason: recommendation.reason,
        } : undefined);
      }

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
          if (isPending && supplySnoozedUntilRef.current[type] <= Date.now()) {
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
          const now = Date.now();
          const caloriePending = pendingCalorieRef.current && supplySnoozedUntilRef.current.calorie <= now;
          const waterPending = pendingWaterRef.current && supplySnoozedUntilRef.current.water <= now;
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

  const triggerIntervalSupplyReminder = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== "active") return;

    const dueKinds = getDueSupplyIntervals(
      {
        enabled: settings.supplyIntervalReminderEnabled,
        timeEnabled: settings.supplyTimeIntervalEnabled,
        timeMinutes: settings.supplyTimeIntervalMinutes,
        distanceEnabled: settings.supplyDistanceIntervalEnabled,
        distanceKm: settings.supplyDistanceIntervalKm,
      },
      intervalSupplyTrackerRef.current,
      current.elapsed,
      current.distance / 1000,
      {
        ...intervalSupplyAlertsRef.current,
        time: Boolean(intervalSupplyAlertsRef.current.time || (intervalSnoozedUntilRef.current.time ?? 0) > Date.now()),
        distance: Boolean(intervalSupplyAlertsRef.current.distance || (intervalSnoozedUntilRef.current.distance ?? 0) > Date.now()),
      },
    );
    if (dueKinds.length === 0) return;

    const nextAlerts = { ...intervalSupplyAlertsRef.current };
    dueKinds.forEach((kind) => { nextAlerts[kind] = true; });
    intervalSupplyAlertsRef.current = nextAlerts;
    setIntervalSupplyAlerts(nextAlerts);
    powerSavingManagerRef.current.onSupplyReminder();
    setTouchGuardEnabled(false);
    if (settings.vibrationEnabled) vibrateWarning();
    if (settings.ttsEnabled) speak("請補給");
    if (settings.soundEnabled) {
      try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
    }
    if (settings.notificationEnabled) dueKinds.forEach((kind) => {
      void showSupplyNotification(kind === "time" ? "interval-time" : "interval-distance");
    });

    const repeatSec = settings.supplyReminderRepeatSec;
    if (repeatSec > 0 && !intervalSupplyRepeatTimerRef.current) {
      intervalSupplyRepeatTimerRef.current = setInterval(() => {
        const alerts = intervalSupplyAlertsRef.current;
        const snoozed = (intervalSnoozedUntilRef.current.time ?? 0) > Date.now() || (intervalSnoozedUntilRef.current.distance ?? 0) > Date.now();
        if ((!alerts.time && !alerts.distance) || snoozed) {
          clearIntervalSupplyRepeatTimer();
          return;
        }
        if (settings.vibrationEnabled) vibrateWarning();
        if (settings.ttsEnabled) speak("請補給");
        if (settings.soundEnabled) {
          try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
        }
      }, repeatSec * 1000);
    }
  }, [alertPlayer, clearIntervalSupplyRepeatTimer, settings]);

  useEffect(() => {
    if (state.status !== "active") return;
    const checkInterval = setInterval(triggerIntervalSupplyReminder, 10_000);
    return () => clearInterval(checkInterval);
  }, [state.status, triggerIntervalSupplyReminder]);

  useEffect(() => () => clearIntervalSupplyRepeatTimer(), [clearIntervalSupplyRepeatTimer]);

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
      const persistentSession = await initializeRideSession();
      if (persistentSession?.isActive && persistentSession.trackPoints.length > 0) {
        recoverySessionRef.current = persistentSession;
        const recoveredRoute = persistentSession.trackPoints.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude ?? 0,
          speed: point.speed ?? 0,
          timestamp: point.timestamp,
        }));
        const lastPoint = persistentSession.trackPoints.at(-1);
        dispatch({
          type: "RESTORE",
          snapshot: {
            elapsed: Math.round(persistentSession.stats.totalTime / 1000),
            distance: persistentSession.stats.totalDistance,
            totalAscent: persistentSession.stats.totalElevationGain,
            route: recoveredRoute,
            currentAltitude: lastPoint?.altitude ?? 0,
            currentSpeed: (lastPoint?.speed ?? 0) * 3.6,
            calories: persistentSession.stats.caloriesBurned,
            totalCalories: persistentSession.stats.caloriesBurned,
            totalSweatMl: persistentSession.stats.waterLoss,
            sweatSinceLastRefill: persistentSession.stats.waterLoss,
          },
        });
        setLiveTrail(recoveredRoute.map((point) => ({ latitude: point.latitude, longitude: point.longitude })));
        setMapRideActive(true);
        return;
      }
      const snapshot = await checkSnapshot();
      if (snapshot && snapshot.elapsed && snapshot.elapsed > 30) {
        setRecoverySnapshot(snapshot);
        setShowRecoveryAlert(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 靜止逾時後切換為低功耗監測；重新移動由低頻 GPS 自動恢復完整紀錄 ───────────────
  useEffect(() => {
    const canMonitorIdle = mapRideActive
      && state.status === "paused"
      && settings.idleAutoPauseEnabled;

    if (!canMonitorIdle) {
      if (state.status === "active") pausedAtRef.current = null;
      if (idlePauseTimerRef.current) clearTimeout(idlePauseTimerRef.current);
      idlePauseTimerRef.current = null;
      return;
    }

    if (pausedAtRef.current === null) pausedAtRef.current = Date.now();
    if (rideLocationTrackingMode === "idle_monitor") return;

    const pausedAtMs = pausedAtRef.current;
    const delayMs = Math.max(0, settings.idleAutoPauseSeconds * 1000 - (Date.now() - pausedAtMs));
    idlePauseTimerRef.current = setTimeout(() => {
      if (!shouldEnterIdleMonitor(
        { enabled: settings.idleAutoPauseEnabled, idleTimeoutSeconds: settings.idleAutoPauseSeconds },
        true,
        pausedAtMs,
        Date.now(),
      )) return;

      locationSubRef.current?.remove();
      locationSubRef.current = null;
      idleMonitorLastPositionRef.current = currentPosRef.current
        ? { lat: currentPosRef.current.lat, lon: currentPosRef.current.lon }
        : null;
      setRideLocationTrackingMode("idle_monitor");
      void setBackgroundLocationTrackingMode(settings.gpsAccuracy || "standard", "idle_monitor");
      if (settings.ttsEnabled) speak("偵測到靜止，已切換為省電定位監測", true);
    }, delayMs);

    return () => {
      if (idlePauseTimerRef.current) clearTimeout(idlePauseTimerRef.current);
      idlePauseTimerRef.current = null;
    };
  }, [mapRideActive, rideLocationTrackingMode, settings.gpsAccuracy, settings.idleAutoPauseEnabled, settings.idleAutoPauseSeconds, settings.ttsEnabled, state.status]);

  // ─── GPS 訂閱 ──────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // 依據 lifecycle 規則：未開始騎乘時僅在 App 前台定位（支援釘選導航與目前位置）；
    // 開始騎乘後不論前台、背景或鎖屏皆持續定位紀錄軌跡。
    if (!shouldTrackRideLocation(mapRideActive, isAppForeground)) {
      locationSubRef.current?.remove();
      locationSubRef.current = null;
      return;
    }
    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      notifPermRef.current = await requestNotificationPermission();

      const isIdleMonitor = rideLocationTrackingMode === "idle_monitor";
      const sub = await Location.watchPositionAsync(
        {
          accuracy: isIdleMonitor ? Location.Accuracy.Balanced : Location.Accuracy.BestForNavigation,
          timeInterval: isIdleMonitor ? 60_000 : LOCATION_INTERVAL_SEC * 1000,
          distanceInterval: isIdleMonitor ? 18 : 3,
        },
        (loc) => {
          if (!active) return;
          const { latitude, longitude, altitude, heading, speed } = loc.coords;
          const speedKmhRaw = (speed ?? 0) * 3.6;

          if (isIdleMonitor) {
            const previous = idleMonitorLastPositionRef.current;
            const movementM = previous ? haversine(previous.lat, previous.lon, latitude, longitude) : 0;
            idleMonitorLastPositionRef.current = { lat: latitude, lon: longitude };
            if (shouldResumeFromIdleMonitor(speedKmhRaw, movementM)) {
              pausedAtRef.current = null;
              setRideLocationTrackingMode("full");
              dispatch({ type: "RESUME" });
              void setBackgroundLocationTrackingMode(settings.gpsAccuracy || "standard", "full");
              if (settings.ttsEnabled) speak("已偵測到重新移動，恢復騎乘紀錄", true);
            }
            return;
          }

          // ── 車頭朝前精度改善（融合電子羅盤 + GPS）──────────────────────────────────────────────────────
          // 策略：
          //   1. 速度 > 5 km/h 且 GPS heading 有效 → 使用 GPS heading
          //   2. 速度 ≤ 5 km/h 且羅盤可用（精度 < 30°）→ 使用羅盤
          //   3. 兩者都可用 → 混合模式（GPS 60% + 羅盤 40%）
          //   4. 都不可用 → 兩點 bearing 或保持上次方向
          let rawHdg = heading ?? -1;
          const gpsHeadingValid = rawHdg >= 0 && speedKmhRaw > 5;
          const compassData = compassHeadingRef.current;
          const compassValid = compassData && compassData.accuracy < 30 && (Date.now() - compassData.timestamp < 2000);

          if (headingUp && compassValid && gpsHeadingValid) {
            // 混合模式：使用 compass-gps-optimizer 融合
            const gpsVec: GPSVector = { bearing: rawHdg, accuracy: 10, speed: (speed ?? 0), timestamp: Date.now() };
            const result = getFinalDirection(compassData, gpsVec);
            rawHdg = result.heading;
          } else if (headingUp && compassValid && !gpsHeadingValid) {
            // 低速時用羅盤（更即時的方向感知）
            rawHdg = smoothHeading(compassData.heading, headingRef.current, 0.35);
          } else if (gpsHeadingValid) {
            // GPS heading 有效，直接使用
            // rawHdg 已是 GPS heading
          } else {
            // 低速且羅盤不可用：用兩點 bearing
            const prev = prevGpsForBearingRef.current;
            if (prev) {
              const d = haversine(prev.lat, prev.lon, latitude, longitude);
              if (d >= 5) {
                rawHdg = bearing(prev.lat, prev.lon, latitude, longitude);
              } else {
                rawHdg = headingRef.current;
              }
            } else {
              rawHdg = headingRef.current;
            }
          }
          // 更新 GPS 位置參考點
          prevGpsForBearingRef.current = { lat: latitude, lon: longitude };
          // 自適應循環平均：根據速度調整平均窗口大小
          // 羅盤模式時窗口更小（更靈敏），因為羅盤已經提供即時方向
          const useCompassMode = headingUp && compassValid;
          const windowSize = useCompassMode
            ? (speedKmhRaw <= 5 ? 5 : 3)
            : (speedKmhRaw <= 5 ? 11 : speedKmhRaw >= 15 ? 7 : 9);
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
          let distanceM = 0;
          if (lastLocationRef.current) {
            distanceM = haversineDistance(
              lastLocationRef.current.coords.latitude,
              lastLocationRef.current.coords.longitude,
              latitude, longitude
            );
            const altDiff = (altitude ?? 0) - (lastLocationRef.current.coords.altitude ?? 0);
            grade = calcGrade(altDiff, distanceM);
            ascent = Math.max(0, altDiff);
          }
          lastLocationRef.current = loc;

          const headwindMs = getHeadwindMs(headingRef.current, windDataRef.current.direction, windDataRef.current.speed * 3.6);
          const currentWeather = weatherRef.current;
          if (currentWeather) {
            const summary = environmentSummaryRef.current;
            summary.sampleCount += 1;
            summary.temperatureTotal += currentWeather.temperature;
            summary.humidityTotal += currentWeather.humidity;
            summary.windSpeedTotal += currentWeather.windSpeed;
            summary.headwindTotal += headwindMs;
            summary.precipitationTotal += currentWeather.precipitationProb;
            summary.latestWeatherCode = currentWeather.weatherCode;
            summary.hadLiveWeather = true;
          }
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
          // 純本機功率：以 GPS 速度、坡度、風況與重量進行五點平滑推算。
          powerWindowRef.current.push(rawPower);
          if (powerWindowRef.current.length > 5) powerWindowRef.current.shift();
          const power = Math.round(
            powerWindowRef.current.reduce((a, b) => a + b, 0) / powerWindowRef.current.length
          );
          // 以物理推算功率；缺少功率時以體重、速度與坡度的 MET 模型回退。
          const calorieResult = calculatePersonalizedCalories({
            powerW: power,
            hasMeasuredPower: power > 0,
            speedKmh,
            gradePct: grade,
            riderWeightKg: settings.weight,
            ftpW: estimateFtpW,
            intervalSec: LOCATION_INTERVAL_SEC,
            temperatureC: currentWeather?.temperature,
            humidityPct: currentWeather?.humidity,
            weatherCode: currentWeather?.weatherCode,
            precipitationProb: currentWeather?.precipitationProb,
            headwindMs,
          });
          const calIncrement = calorieResult.kcal;

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
            ftpW: estimateFtpW,
            headwindMs,
            precipitationProb: currentWeather?.precipitationProb ?? 0,
            ageYears: estimateAgeYears ?? 32,
            calibrationMultiplier: settings.sweatRateCalibrationMultiplier,
          });
          dispatch({
            type: "SWEAT_UPDATE",
            sweatLossMl: sweatResult.sweatLossMl,
            sweatRatePerHour: sweatResult.sweatRatePerHour,
            intensityLabel: sweatResult.intensityLabel,
          });

          const recoverySession = recoverySessionRef.current;
          if (recoverySession) {
            const trackPoint = {
              timestamp: loc.timestamp ?? Date.now(),
              latitude,
              longitude,
              altitude: altitude ?? undefined,
              speed: speed ?? undefined,
              accuracy: loc.coords.accuracy ?? undefined,
              heading: hdg,
            };
            addTrackPoint(recoverySession, trackPoint, recoverySession.trackPoints.at(-1));
            recoverySession.stats.caloriesBurned += calIncrement;
            recoverySession.stats.waterLoss += sweatResult.sweatLossMl;
            void saveRideSessionSnapshot(recoverySession);
          }

          const supplyPlan = createSupplyPlan({
            mode: settings.supplyCalculationMode,
            calorieThresholdKcal: settings.calorieThreshold,
            waterThresholdMl: hydrationThresholdMl,
            elapsedSec: currentState.elapsed,
            riderWeightKg: settings.weight,
            ftpW: estimateFtpW,
            intensityFactor: calorieResult.intensityFactor,
            sweatRatePerHour: sweatResult.sweatRatePerHour,
            environmentLoad: sweatResult.environmentLoad,
            weatherAvailable: Boolean(currentWeather),
          });
          const newCalories = currentState.calories + calIncrement;
          const calPct = Math.min(1, newCalories / supplyPlan.calorieTriggerKcal);
          const newSweatSince = currentState.sweatSinceLastRefill + sweatResult.sweatLossMl;
          const waterPct = Math.min(1, newSweatSince / supplyPlan.waterTriggerMl);

          Animated.timing(calorieAnim, { toValue: calPct, duration: 500, useNativeDriver: false }).start();
          Animated.timing(waterAnim, { toValue: waterPct, duration: 500, useNativeDriver: false }).start();

          // 檢查下坡狀態
          const isDownhill = currentState.currentSpeed > 25 && currentState.totalAscent <= lastAscentRef.current;
          lastAscentRef.current = currentState.totalAscent;

          // 卡路里提醒邏輯
          if (calPct >= 1 && !calorieReminderSentRef.current) {
            console.log(`[補給] 卡路里達到${supplyPlan.source}閾值: ${newCalories}/${supplyPlan.calorieTriggerKcal} (${(calPct*100).toFixed(1)}%)`);
            if (settings.caloriePauseOnDownhill && isDownhill && !calorieAlert) {
              // 下坡時暫停提醒但仍計數
              console.log('[補給] 下坡時暫停卡路里提醒');
            } else {
              calorieReminderSentRef.current = true;
              console.log('[補給] 觸發卡路里提醒');
              triggerSupplyReminder("calorie", supplyPlan);
            }
          }

          // 水分提醒邏輯
          if (waterPct >= 1 && !waterReminderSentRef.current) {
            console.log(`[補給] 水分達到${supplyPlan.source}閾值: ${newSweatSince}/${supplyPlan.waterTriggerMl} (${(waterPct*100).toFixed(1)}%)`);
            if (settings.waterPauseOnDownhill && isDownhill && !waterAlert) {
              // 下坡時暫停提醒但仍計數
              console.log('[補給] 下坡時暫停水分提醒');
            } else {
              waterReminderSentRef.current = true;
              console.log('[補給] 觸發水分提醒');
              triggerSupplyReminder("water", supplyPlan);
            }
          }

          // ── 自訂補給品觸發 ──
          if (settings.supplyItems && settings.supplyItems.length > 0) {
            for (const supplyItem of settings.supplyItems) {
              triggerCustomSupplyReminder(supplyItem);
            }
          }
          triggerIntervalSupplyReminder();

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
  }, [followUser, mapRideActive, isNavigating, gpxRoute, rideLocationTrackingMode, settings]);

  // ─── 電子羅盤訂閱（只在騎乘中的車頭朝前模式啟用）────────────────────────────────────────
  useEffect(() => {
    if (!shouldTrackRideHeading(mapRideActive, headingUp)) {
      // 待機或非車頭朝前模式時不訂閱羅盤，節省電量
      headingSubRef.current?.remove();
      headingSubRef.current = null;
      return;
    }
    let active = true;
    (async () => {
      try {
        const sub = await Location.watchHeadingAsync((heading) => {
          if (!active) return;
          compassHeadingRef.current = {
            heading: heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading,
            accuracy: heading.accuracy ?? 999,
            timestamp: Date.now(),
          };
        });
        headingSubRef.current = sub;
      } catch (e) {
        // 羅盤不可用（例如 Web 平台），静默失敗
        console.warn('watchHeadingAsync not available:', e);
      }
    })();
    return () => {
      active = false;
      headingSubRef.current?.remove();
      headingSubRef.current = null;
    };
  }, [headingUp, mapRideActive]);

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

      let lookaheadDist = 0;
      let turnInstruction = "";
      let detectedTurnDir: 'left' | 'right' | null = null;
      let detectedTurnDist = 0;
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
          detectedTurnDir = diff > 0 ? 'right' : 'left';
          detectedTurnDist = distToTurn;
          if (distToTurn < 50) {
            // 只在路口時播報（避免重複播報）
            const now = Date.now();
            if (now - lastTurnSpokenRef.current > 10000) {
              turnInstruction = diff > 0 ? "右轉" : "左轉";
              speak(turnInstruction, settings.ttsEnabled);
              lastTurnSpokenRef.current = now;
            } else {
              turnInstruction = diff > 0 ? "右轉" : "左轉";
            }
          } else {
            const distStr = distToTurn < 100 ? "前方" : `${Math.round(distToTurn)} 公尺後`;
            turnInstruction = diff > 0 ? `${distStr}右轉` : `${distStr}左轉`;
          }
          break;
        }
      }

      if (dEnd < 500 && !arrivedRef.current) {
        powerSavingManagerRef.current.onTurnGuidance();
        const distStr = dEnd < 100 ? "即將" : `${Math.round(dEnd)} 公尺後`;
        setNavInstruction(`${distStr}到達終點`);
        setTurnDirection('arrive');
        setTurnDistanceM(dEnd);
      } else if (turnInstruction) {
        powerSavingManagerRef.current.onTurnGuidance();
        setNavInstruction(turnInstruction);
        setTurnDirection(detectedTurnDir);
        setTurnDistanceM(detectedTurnDist);
      } else {
        setNavInstruction("沿路線前進");
        setTurnDirection(null);
        setTurnDistanceM(0);
      }
    },
    [gpxRoute, settings.ttsEnabled]
  );

  // ─── 開始/停止騎乘 ────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (idlePauseTimerRef.current) clearTimeout(idlePauseTimerRef.current);
    idlePauseTimerRef.current = null;
    pausedAtRef.current = null;
    idleMonitorLastPositionRef.current = null;
    setRideLocationTrackingMode("full");
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
    environmentSummaryRef.current = {
      sampleCount: 0,
      temperatureTotal: 0,
      humidityTotal: 0,
      windSpeedTotal: 0,
      headwindTotal: 0,
      precipitationTotal: 0,
      latestWeatherCode: undefined,
      hadLiveWeather: false,
    };
    lowSpeedCountRef.current = 0;
    arrivedRef.current = false;
    setMapRideActive(true);
    setFollowUser(true);
    setTouchGuardEnabled(settings.touchGuardEnabled);
    setCustomSupplyAlerts({}); // 重置自訂補給品提醒狀態
    recoverySessionRef.current = createNewRideSession();
    void saveRideSessionSnapshot(recoverySessionRef.current);

    // 記錄騎乘開始座標（用於「回起點」功能）
    if (currentPos) {
      rideStartLocationRef.current = { lat: currentPos.lat, lon: currentPos.lon };
    }

    // 初始化自訂補給品追蹤器
    supplyItemsTrackerRef.current = {};
    settings.supplyItems.filter(s => s.enabled).forEach(item => {
      supplyItemsTrackerRef.current[item.id] = {
        lastTriggerTime: 0,
        lastTriggerDistance: 0,
        triggered: false,
      };
    });
    intervalSupplyTrackerRef.current = { lastTimeSec: 0, lastDistanceKm: 0 };
    intervalSupplyAlertsRef.current = {};
    setIntervalSupplyAlerts({});
    clearIntervalSupplyRepeatTimer();

    if (gpxRoute) {
      setIsNavigating(true);
      setNavInstruction("導航已啟動");
      speak("導航已啟動，沿路線前進", settings.ttsEnabled);
    }

    // 初始化背景狀態（確保背景中能計算距離和觸發補給提醒）
    const lastPos = await Location.getLastKnownPositionAsync();
    await initBackgroundState({
      calorieThreshold: settings.calorieThreshold,
      waterThreshold: hydrationThresholdMl,
      supplyCalculationMode: settings.supplyCalculationMode,
      currentLat: lastPos?.coords.latitude ?? 0,
      currentLon: lastPos?.coords.longitude ?? 0,
      supplyIntervalReminderEnabled: settings.supplyIntervalReminderEnabled,
      supplyTimeIntervalEnabled: settings.supplyTimeIntervalEnabled,
      supplyTimeIntervalMinutes: settings.supplyTimeIntervalMinutes,
      supplyDistanceIntervalEnabled: settings.supplyDistanceIntervalEnabled,
      supplyDistanceIntervalKm: settings.supplyDistanceIntervalKm,
      riderProfile: {
        weightKg: settings.weight,
        heightCm: settings.height,
        ageYears: estimateAgeYears ?? 32,
        ftpW: estimateFtpW,
        bikeWeightKg: settings.bikeWeight ?? 10,
        sweatRateCalibrationMultiplier: settings.sweatRateCalibrationMultiplier,
      },
      environment: weatherRef.current
        ? {
          temperatureC: weatherRef.current.temperature,
          humidityPct: weatherRef.current.humidity,
          windSpeedKmh: weatherRef.current.windSpeed,
          windDirection: weatherRef.current.windDirection,
          weatherCode: weatherRef.current.weatherCode,
          precipitationProb: weatherRef.current.precipitationProb,
        }
        : undefined,
    });
    await startBackgroundLocationTracking(settings.gpsAccuracy || "standard");

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
  }, [dispatch, hydrationThresholdMl, gpxRoute, settings, updateWeather, calorieAnim, waterAnim]);

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
          if (idlePauseTimerRef.current) clearTimeout(idlePauseTimerRef.current);
          idlePauseTimerRef.current = null;
          pausedAtRef.current = null;
          idleMonitorLastPositionRef.current = null;
          setRideLocationTrackingMode("full");
          locationSubRef.current?.remove();
          locationSubRef.current = null;
          await stopBackgroundLocationTracking();
          await clearBackgroundData(); // 清除背景軌跡數據避免存儲空間增長
          lastBgSyncTsRef.current = 0; // 重置去重時間戳
          
          if (weatherTimerRef.current) clearInterval(weatherTimerRef.current);
          await cancelRidingNotification();
          // 結束騎乘清除補給重複提醒計時器
          clearSupplyRepeatTimer();
          setCalorieAlert(false);
          setWaterAlert(false);
          setCustomSupplyAlerts({}); // 重置自訂補給品提醒狀態
          supplyItemsTrackerRef.current = {}; // 重置自訂補給品追蹤器
          intervalSupplyTrackerRef.current = { lastTimeSec: 0, lastDistanceKm: 0 };
          intervalSupplyAlertsRef.current = {};
          setIntervalSupplyAlerts({});
          clearIntervalSupplyRepeatTimer();

          // 結束騎乘清除崩潰恢復快照
          await clearSnapshot();
          if (recoverySessionRef.current) {
            await completeRideSession(recoverySessionRef.current);
            recoverySessionRef.current = null;
          }
          // 先不帶名稱儲存記錄，之後在摘要 Modal 取得名稱後更新；個人設定與環境摘要只保存在裝置上。
          const environmentSummary = environmentSummaryRef.current;
          const sampleCount = environmentSummary.sampleCount;
            const savedRecordId = await saveRecord(undefined, {
              riderWeightKg: settings.weight,
              bikeWeightKg: settings.bikeWeight ?? 10,
              ftpW: estimateFtpW,
            autoRpeEnabled: settings.autoRpeEnabled,
            environment: {
              sampleCount,
              averageTemperatureC: sampleCount ? environmentSummary.temperatureTotal / sampleCount : undefined,
              averageHumidityPct: sampleCount ? environmentSummary.humidityTotal / sampleCount : undefined,
              averageWindSpeedKmh: sampleCount ? environmentSummary.windSpeedTotal / sampleCount : undefined,
              averageHeadwindMs: sampleCount ? environmentSummary.headwindTotal / sampleCount : undefined,
              averagePrecipitationProb: sampleCount ? environmentSummary.precipitationTotal / sampleCount : undefined,
              weatherCode: environmentSummary.latestWeatherCode,
              source: environmentSummary.hadLiveWeather ? "live-weather" : "offline-fallback",
            },
          });
          setSummaryRecordId(savedRecordId);
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
  }, [dispatch, saveRecord, clearSnapshot, settings, state.records, clearSupplyRepeatTimer]);

  // ─── 回到定位 ────────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (autoRecenterTimerRef.current) clearTimeout(autoRecenterTimerRef.current);
    setFollowUser(true);
    if (currentPos) {
      mapRef.current?.animateCamera(
        { center: { latitude: currentPos.lat, longitude: currentPos.lon } },
        { duration: 300 },
      );
    }
  }, [currentPos]);

  // ─── 前台恢復背景數據（AppState 監聽） ───────────────────────────────────────────────────────
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active' &&
        mapRideActive
      ) {
        try {
          const bgState = await getBackgroundState();
          const bgTrack = await getBackgroundTrackPoints();
          if (bgState?.trackingMode === "full" && rideLocationTrackingMode === "idle_monitor") {
            pausedAtRef.current = null;
            setRideLocationTrackingMode("full");
            dispatch({ type: "RESUME" });
            if (settings.ttsEnabled) speak("已偵測到重新移動，恢復騎乘紀錄", true);
          }
          if (bgState && bgTrack.length > 0) {
            // 去重：只合併時間戳大於上次同步的軌跡點
            const newPoints = bgTrack.filter(pt => pt.ts > lastBgSyncTsRef.current);
            if (newPoints.length > 0) {
              for (const pt of newPoints) {
                dispatch({
                  type: "LOCATION_UPDATE",
                  point: { latitude: pt.lat, longitude: pt.lon, altitude: 0, speed: 0, timestamp: pt.ts },
                  power: 0,
                  calories: 0,
                  ascent: 0,
                });
              }
              // 更新最大同步時間戳
              lastBgSyncTsRef.current = Math.max(...newPoints.map(p => p.ts));
            }
            console.log(`[AppState] 已合併 ${newPoints.length}/${bgTrack.length} 個背景軌跡點（去重後）`);
            // 檢查背景中是否觸發了補給提醒
            if (bgState.calorieReminderSent && !calorieReminderSentRef.current) {
              calorieReminderSentRef.current = true;
              setCalorieAlert(true);
              pendingCalorieRef.current = true;
            }
            if (bgState.waterReminderSent && !waterReminderSentRef.current) {
              waterReminderSentRef.current = true;
              setWaterAlert(true);
              pendingWaterRef.current = true;
            }
            const restoredIntervalAlerts: Partial<Record<SupplyIntervalKind, boolean>> = {
              time: bgState.intervalTimeReminderSent || false,
              distance: bgState.intervalDistanceReminderSent || false,
            };
            if (restoredIntervalAlerts.time || restoredIntervalAlerts.distance) {
              intervalSupplyAlertsRef.current = restoredIntervalAlerts;
              setIntervalSupplyAlerts(restoredIntervalAlerts);
              setTouchGuardEnabled(false);
            }
          }
        } catch (e) {
          console.warn('[AppState] 恢復背景數據失敗:', e);
        }
      }
      appStateRef.current = nextState;
    });
    return () => { subscription.remove(); };
  }, [mapRideActive, dispatch, rideLocationTrackingMode, settings.ttsEnabled]);


  // ─── GPS 精度即時切換（騎乘中更改設定時自動重啟背景追蹤）────────────────────────────
  const prevGpsAccuracyRef = useRef<GpsAccuracyLevel>(settings.gpsAccuracy || "standard");
  useEffect(() => {
    const currentAccuracy: GpsAccuracyLevel = settings.gpsAccuracy || "standard";
    if (mapRideActive && currentAccuracy !== prevGpsAccuracyRef.current) {
      prevGpsAccuracyRef.current = currentAccuracy;
      (async () => {
        await stopBackgroundLocationTracking();
        await startBackgroundLocationTracking(currentAccuracy);
        console.log(`[GPS] 即時切換背景 GPS 精度為: ${currentAccuracy}`);
      })();
    } else {
      prevGpsAccuracyRef.current = currentAccuracy;
    }
  }, [settings.gpsAccuracy, mapRideActive]);

  // ─── 電量低自動降級 GPS 精度 ──────────────────────────────────────────────────────
  const batteryDegradedRef = useRef(false);
  useEffect(() => {
    if (!mapRideActive || Platform.OS === "web") return;
    let cancelled = false;
    const checkBattery = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        const pct = Math.round(level * 100);
        if (pct > 0 && pct <= 20 && !batteryDegradedRef.current) {
          batteryDegradedRef.current = true;
          const currentAccuracy: GpsAccuracyLevel = settings.gpsAccuracy || "standard";
          if (currentAccuracy !== "power_saving") {
            await stopBackgroundLocationTracking();
            await startBackgroundLocationTracking("power_saving");
            Alert.alert("低電量提示", `電量剩餘 ${pct}%，已自動將背景 GPS 切換為省電模式以延長續航。`);
            console.log(`[GPS] 電量 ${pct}%，自動降級為 power_saving`);
          }
        } else if (pct > 30 && batteryDegradedRef.current) {
          // 電量恢復超過 30%，自動回升為用戶原本設定的精度
          batteryDegradedRef.current = false;
          const userAccuracy: GpsAccuracyLevel = settings.gpsAccuracy || "standard";
          await stopBackgroundLocationTracking();
          await startBackgroundLocationTracking(userAccuracy);
          Alert.alert("電量已恢復", `電量已回升至 ${pct}%，已自動恢復背景 GPS 為「${userAccuracy === "power_saving" ? "省電" : userAccuracy === "standard" ? "標準" : "高精度"}」模式。`);
          console.log(`[GPS] 電量 ${pct}%，自動回升為 ${userAccuracy}`);
        }
      } catch { /* 忽略電量讀取失敗 */ }
    };
    checkBattery();
    const interval = setInterval(() => { if (!cancelled) checkBattery(); }, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [mapRideActive, settings.gpsAccuracy]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      locationSubRef.current?.remove();
      if (weatherTimerRef.current) clearInterval(weatherTimerRef.current);
      if (autoRecenterTimerRef.current) clearTimeout(autoRecenterTimerRef.current);
    };
  }, []);

  // ─── 騎乘進度快照（每 10 秒儲存一次，用於崩潰恢復）───────────────────────────────────────
  useEffect(() => {
    if (state.status !== "active" && state.status !== "paused") return;
    const timer = setInterval(() => {
      saveSnapshot();
    }, 10000);
    return () => clearInterval(timer);
  }, [state.status, saveSnapshot]);

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

  // ─── 按鍵控制補給提醒（已移除，使用 UI 按鈕替代）────────────────────────────────────────────────────────
  // react-native-key-event 與新版 Gradle 不兼容，補給提醒可通過 UI 按鈕關閉

  // ─── 計算值 ──────────────────────────────────────────────────────────────────
  const gpxPolyline = useMemo(() => {
    if (!gpxRoute) return [];
    return gpxRoute.points.map((p) => ({ latitude: p.lat, longitude: p.lon }));
  }, [gpxRoute]);

  const routeOverlays = useMemo<NavigationRouteOverlay[]>(() => {
    const overlays: NavigationRouteOverlay[] = [];
    if (sharedRoute) {
      overlays.push({
        id: "imported-gpx",
        coordinates: sharedRoute.points.map((point) => ({ latitude: point.lat, longitude: point.lon })),
        color: "#FF3B30",
        showDirectionArrows: activeNavigationRoute === sharedRoute,
      });
    }
    const pinColors = ["#007AFF", "#AF52DE", "#FF9500", "#34C759"];
    pinnedNavigationLayers.forEach((layer, index) => {
      overlays.push({
        id: layer.id,
        coordinates: layer.route.points.map((point) => ({ latitude: point.lat, longitude: point.lon })),
        color: pinColors[index % pinColors.length],
        // 釘選導航採乾淨折線顯示，避免留下難辨識的小箭頭。
        showDirectionArrows: false,
      });
    });
    return overlays;
  }, [activeNavigationRoute, pinnedNavigationLayers, sharedRoute]);

  const passedPolyline = useMemo(() => {
    if (!gpxRoute || nearestIdx <= 0) return [];
    return gpxRoute.points.slice(0, nearestIdx + 1).map((p) => ({ latitude: p.lat, longitude: p.lon }));
  }, [gpxRoute, nearestIdx]);

  // 計算里程標記（每 1 公里一個）
  const kilometersMarkers = useMemo(() => {
    if (!gpxRoute || gpxRoute.points.length === 0) return [];
    const { calculateKilometerMarkers } = require('@/lib/kilometer-markers');
    return calculateKilometerMarkers(gpxRoute);
  }, [gpxRoute]);

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
    <View
      style={styles.container}
      onTouchStart={() => powerSavingManagerRef.current.onUserInteraction()}
    >
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
                  startBackgroundLocationTracking(settings.gpsAccuracy || "standard");
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
        onPanDrag={scheduleAutoRecenter}
        onMapLongPress={(lat, lon) => {
          setPinnedLocation({ lat, lon });
          setPinnedLocationLabel(null);
          setPinRouteInfo(null);
          setShowPinCard(true);
          scheduleAutoRecenter();
          // 視覺回饋：縮放到釘選位置
          mapRef.current?.animateCamera(
            { center: { latitude: lat, longitude: lon }, zoom: 18 },
            { duration: 300 }
          );
        }}
        currentPos={currentPos}
        gpxPolyline={gpxPolyline}
        routeOverlays={routeOverlays}
        passedPolyline={passedPolyline}
        liveTrail={liveTrail}
        returnPolyline={[]}
        isOffRoute={false}
        centerPinLocation={pinSelectMode ? centerPinLocation : null}
        onMapCenterChanged={(lat, lon) => {
          if (pinSelectMode) {
            setCenterPinLocation({ lat, lon });
          }
        }}
        kilometersMarkers={kilometersMarkers}
        onMapMoveEnd={scheduleAutoRecenter}
      />

      {pinSelectMode && (
        <View style={[styles.pinAddressBar, { top: insets.top + 10 }]}>
          <TextInput
            value={pinAddress}
            onChangeText={setPinAddress}
            placeholder="輸入地址、地標或店家名稱"
            placeholderTextColor="rgba(255,255,255,0.52)"
            style={styles.pinAddressInput}
            returnKeyType="search"
            autoCorrect={false}
            onSubmitEditing={() => { void handleResolvePinAddress(); }}
          />
          <Pressable
            style={[styles.pinAddressSearchButton, isResolvingPinAddress && styles.pinAddressSearchButtonDisabled]}
            disabled={isResolvingPinAddress}
            onPress={() => { void handleResolvePinAddress(); }}
          >
            <Text style={styles.pinAddressSearchText}>{isResolvingPinAddress ? "搜尋中" : "搜尋"}</Text>
          </Pressable>
        </View>
      )}

      {/* ── 右側工具列 ── */}
      <View style={[styles.toolBar, { top: insets.top + 8, right: 16 }]}>
        {/* 立即回到目前位置：取消等待，但不重設使用者縮放或旋轉。 */}
        <Pressable
          style={[styles.toolBtn, styles.toolBtnActive]}
          onPress={handleRecenter}
        >
          <IconSymbol name="location.fill" size={20} color="#34C759" />
          <Text style={[styles.returnBtnLabel, { color: "#34C759" }]}>定位</Text>
        </Pressable>
        {isActive && settings.touchGuardEnabled && (
          <Pressable
            style={[styles.toolBtn, touchGuardEnabled && styles.touchGuardToolBtnActive]}
            onPress={() => {
              if (!touchGuardEnabled) setTouchGuardEnabled(true);
            }}
            onPressIn={() => {
              if (touchGuardEnabled) beginTouchGuardHoldProgress();
            }}
            onPressOut={resetTouchGuardHoldProgress}
            onLongPress={() => {
              completeTouchGuardUnlock();
            }}
            delayLongPress={settings.touchGuardUnlockHoldMs}
          >
            <Text style={{ color: touchGuardEnabled ? "#34C759" : "rgba(255,255,255,0.8)", fontSize: 16, fontWeight: "800" }}>
              {touchGuardEnabled ? "鎖" : "開"}
            </Text>
            <Text style={[styles.returnBtnLabel, { color: touchGuardEnabled ? "#34C759" : "rgba(255,255,255,0.8)" }]}>觸控</Text>
          </Pressable>
        )}
        {/* GPX 路線狀態指示（有路線時顯示清除按鈕） */}
        {hasExistingRouteLayers && !mapRideActive && (
          <Pressable
            style={styles.toolBtn}
            onPress={() => {
              Alert.alert(
                "清除所有導航圖層？",
                "這會完整清除匯入 GPX、所有釘選導航路徑、起訖標記與方向箭頭。",
                [
                  { text: "取消", style: "cancel" },
                  { text: "清除", style: "destructive", onPress: clearAllNavigationLayers },
                ],
              );
            }}
          >
            <IconSymbol name="xmark.circle.fill" size={20} color="#FF3B30" />
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
        {/* 釘選按鈕（中心圖釘釋選導航位置） */}
        <Pressable
          style={[styles.toolBtn, pinSelectMode && styles.toolBtnActive]}
          onPress={() => {
            if (pinSelectMode) {
              if (centerPinLocation) {
                setPinnedLocation(centerPinLocation);
                setPinnedLocationLabel(null);
                setPinRouteInfo(null);
                setShowPinCard(true);
                setPinSelectMode(false);
                setCenterPinLocation(null);
              }
            } else {
              if (currentPos) {
                setCenterPinLocation({ lat: currentPos.lat, lon: currentPos.lon });
                setPinAddress("");
                setPinnedLocationLabel(null);
                setPinSelectMode(true);
              }
            }
          }}
        >
          <IconSymbol name="mappin.circle.fill" size={20} color={pinSelectMode ? "#FFD60A" : "#fff"} />
          <Text style={[styles.returnBtnLabel, { color: pinSelectMode ? "#FFD60A" : "rgba(255,255,255,0.8)" }]}>
            {pinSelectMode ? "確認" : "釘選"}
          </Text>
        </Pressable>
      </View>

      {/* ── 轉彎指示橫幅（導航中且有轉彎指示時顯示在地圖上方） ── */}
      {isNavigating && turnDirection && navInstruction !== "沿路線前進" && (
        <View style={[
          styles.turnBanner,
          { top: insets.top + 8 },
          turnDirection === 'arrive' && styles.turnBannerArrive,
        ]}>
          <View style={styles.turnBannerIcon}>
            {turnDirection === 'left' && (
              <Text style={styles.turnArrowText}>⬅️</Text>
            )}
            {turnDirection === 'right' && (
              <Text style={styles.turnArrowText}>➡️</Text>
            )}
            {turnDirection === 'arrive' && (
              <Text style={styles.turnArrowText}>🏁</Text>
            )}
          </View>
          <View style={styles.turnBannerContent}>
            <Text style={styles.turnBannerTitle} numberOfLines={1}>{navInstruction}</Text>
            {turnDistanceM > 0 && turnDirection !== 'arrive' && (
              <Text style={styles.turnBannerDist}>
                {turnDistanceM < 100 ? `${Math.round(turnDistanceM)} m` : `${Math.round(turnDistanceM)} m`}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* ── 導航中「沿路線前進」提示（無轉彎時顯示簡潔橫條） ── */}
      {isNavigating && !turnDirection && navInstruction === "沿路線前進" && (
        <View style={[styles.straightBanner, { top: insets.top + 8 }]}> 
          <Text style={styles.straightBannerIcon}>⬆️</Text>
          <Text style={styles.straightBannerText}>沿路線前進</Text>
          {distToEnd !== null && (
            <Text style={styles.straightBannerDist}>剩餘 {formatRouteDistance(distToEnd)}</Text>
          )}
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
            <DashMetric key={key} fieldKey={key} state={state} isActive={isActive} currentGrade={currentGrade} avgSpeed={avgSpeed} />
          ))}
        </View>

        {/* ── 展開後：總爬升 + 進度條 ── */}
        {panelExpanded && (
          <View style={styles.expandedSection}>
            {/* 超出6格的儀表板欄位（上拉展開後顯示） */}
            {dashOverflowFields.length > 0 && (
              <View style={[styles.sixGrid, { marginBottom: 8 /* internal spacing */ }]}>
                {dashOverflowFields.map((key) => (
                  <DashMetric key={key} fieldKey={key} state={state} isActive={isActive} currentGrade={currentGrade} avgSpeed={avgSpeed} />
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
        recommendedEnergyKcal={supplyRecommendation?.energyRecommendationKcal}
        recommendedCarbohydrateG={supplyRecommendation?.carbohydrateRecommendationG}
        recommendationReason={supplyRecommendation?.reason}
        customSupplyAlerts={[
          ...sortedActiveAlerts.map(id => {
            const item = settings.supplyItems.find(i => i.id === id);
            return {
              id,
              name: item?.name || 'Unknown',
              onConfirm: () => handleConfirmCustomSupply(id, item?.triggerType || 'time'),
            };
          }),
          ...(intervalSupplyAlerts.time ? [{
            id: "supply-interval-time",
            name: `時間間隔補給（每 ${settings.supplyTimeIntervalMinutes} 分鐘）`,
            onConfirm: () => handleConfirmIntervalSupply("time"),
          }] : []),
          ...(intervalSupplyAlerts.distance ? [{
            id: "supply-interval-distance",
            name: `距離間隔補給（每 ${settings.supplyDistanceIntervalKm} km）`,
            onConfirm: () => handleConfirmIntervalSupply("distance"),
          }] : []),
        ]}
        onConfirmCalorie={handleConfirmCalorieSupply}
        onConfirmWater={handleConfirmWaterSupply}
        onDismiss={() => {
          if (calorieAlert) handleSnoozeSupply("calorie");
          if (waterAlert) handleSnoozeSupply("water");
        }}
      />

      {/* ── 騎乘摘要 Modal ── */}
      <RideSummaryModal
        visible={showSummary}
        recordId={summaryRecordId}
        onClose={async (routeName, mediaItems) => {
          setShowSummary(false);
          if (summaryRecordId) {
            await updateRideActivity(summaryRecordId, {
              ...(routeName?.trim() ? { name: routeName.trim() } : {}),
              ...(mediaItems !== undefined ? { mediaItems } : {}),
            });
          }
          setSummaryRecordId(null);
          dispatch({ type: "RESET" });
        }}
      />

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
        power={state.currentPower}
        avgSpeed={avgSpeed}
        calories={Math.round(state.calories)}
        pausedTime={formatDuration(state.totalPausedSec ?? 0)}
        totalAscent={state.totalAscent}
        currentAltitude={state.currentAltitude}
        fields={settings.simplifiedModeFields}
        fieldOrder={settings.simplifiedModeFieldOrder}
      />

      {/* ── 釘選地點卡片 ── */}
      {showPinCard && pinnedLocation && (
        <View style={[styles.pinCard, { bottom: dynamicCollapsedH + 16 }]}> 
          <View style={styles.pinCardHeader}>
            <Text style={styles.pinCardTitle} numberOfLines={1}>{pinnedLocationLabel ?? "釘選位置"}</Text>
            <Pressable
              style={styles.pinCardClose}
              onPress={() => {
                setShowPinCard(false);
                setPinnedLocation(null);
                setPinnedLocationLabel(null);
                setPinRouteInfo(null);
              }}
            >
              <IconSymbol name="xmark.circle.fill" size={20} color="#666" />
            </Pressable>
          </View>
          <View style={styles.pinCardBody}>
            <Text style={styles.pinCardCoord}>
              {pinnedLocation.lat.toFixed(4)}, {pinnedLocation.lon.toFixed(4)}
            </Text>
            {isFetchingPinRoute && (
              <Text style={styles.pinCardStatus}>計算路線中…</Text>
            )}
            {pinRouteInfo && (
              <View style={styles.pinCardRoute}>
                <Text style={styles.pinCardRouteDist}>距離: {(pinRouteInfo.distM / 1000).toFixed(2)} km</Text>
                <Text style={styles.pinCardRouteDur}>預計: {Math.round(pinRouteInfo.durSec / 60)} 分</Text>
              </View>
            )}
          </View>
          <View style={styles.pinCardBtns}>
            <Pressable
              style={[styles.pinCardBtn, { backgroundColor: "#007AFF" }]}
              onPress={() => {
                if (!currentPos) return;
                setIsFetchingPinRoute(true);
                fetchBikeRoute(
                  { latitude: currentPos.lat, longitude: currentPos.lon },
                  { latitude: pinnedLocation.lat, longitude: pinnedLocation.lon },
                  preferCycleway
                ).then(result => {
                  if (result) {
                    setPinRouteInfo({
                      distM: result.distanceM,
                      durSec: result.durationSec,
                      polyline: result.coordinates
                    });
                    speak(`計算完成，${formatRouteDistance(result.distanceM)}，${formatRouteDuration(result.durationSec)}`, settings.ttsEnabled);
                  } else {
                    setPinRouteInfo(null);
                    Alert.alert(
                      "找不到可通行路線",
                      "釘選位置可能位於封閉區、匝道、河川或無法通過的路口。請將圖釘移到可騎行道路後重新規劃。",
                    );
                    speak("找不到可通行路線，請重新釘選到可騎行道路", settings.ttsEnabled);
                  }
                }).catch(() => {
                  setPinRouteInfo(null);
                  Alert.alert("路徑規劃暫時不可用", "請確認網路後重試；系統會以最新道路資料重新規劃。");
                  speak("路徑規劃暫時不可用，請稍後重試", settings.ttsEnabled);
                }).finally(() => {
                  setIsFetchingPinRoute(false);
                });
              }}
            >
              <IconSymbol name="location.fill" size={16} color="#fff" />
              <Text style={styles.pinCardBtnText}>計算路線</Text>
            </Pressable>
            <Pressable
              style={[styles.pinCardBtn, { backgroundColor: "#34C759" }]}
              onPress={() => {
                if (!pinRouteInfo) {
                  Alert.alert("計算路線", "請先計算路線");
                  return;
                }
                const osmrRoute = {
                  name: pinnedLocationLabel ? `${pinnedLocationLabel} 導航` : "釘選位置導航",
                  points: pinRouteInfo.polyline.map(p => ({ lat: p.latitude, lon: p.longitude, ele: 0 })),
                  totalDistance: pinRouteInfo.distM,
                  totalAscent: 0,
                  totalDescent: 0,
                  estimatedDuration: pinRouteInfo.durSec,
                  estimatedCalories: 0,
                  elevationProfile: [],
                  gradientDistribution: {},
                  avgGradient: 0,
                  maxGradient: 0,
                };
                startPinnedNavigationRoute(osmrRoute, `開始導航到${pinnedLocationLabel ?? "釘選位置"}`);
                setShowPinCard(false);
              }}
            >
              <IconSymbol name="play.fill" size={16} color="#fff" />
              <Text style={styles.pinCardBtnText}>開始導航</Text>
            </Pressable>
            <Pressable
              style={[styles.pinCardBtn, { backgroundColor: "#FF3B30" }]}
              onPress={() => {
                setShowPinCard(false);
                setPinnedLocation(null);
                setPinnedLocationLabel(null);
                setPinRouteInfo(null);
              }}
            >
              <IconSymbol name="xmark.circle.fill" size={16} color="#fff" />
              <Text style={styles.pinCardBtnText}>取消</Text>
            </Pressable>
          </View>
        </View>
      )}

      {touchGuardEnabled && isActive && (
        <Pressable
          style={styles.touchGuard}
          onPress={() => {}}
          onPressIn={beginTouchGuardHoldProgress}
          onPressOut={resetTouchGuardHoldProgress}
          onLongPress={() => {
            completeTouchGuardUnlock();
          }}
          delayLongPress={settings.touchGuardUnlockHoldMs}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.touchGuardCornerHint,
              { top: insets.top + 144, opacity: touchGuardHintOpacity },
            ]}
          >
            <IconSymbol name="lock.fill" size={14} color="#9CFFB5" />
            <Text style={styles.touchGuardCornerText}>
              {`已鎖定 · 長按 ${touchGuardHoldLabel} 解除`}
            </Text>
          </Animated.View>
          {touchGuardHoldProgress > 0 && (
            <View pointerEvents="none" style={[styles.touchGuardProgressRing, { top: insets.top + 56 }]}> 
              <Svg width={56} height={56} viewBox="0 0 56 56">
                <Circle cx="28" cy="28" r="23" stroke="rgba(255,255,255,0.18)" strokeWidth="4" fill="rgba(5, 21, 14, 0.62)" />
                <Circle
                  cx="28"
                  cy="28"
                  r="23"
                  stroke="#9CFFB5"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray="144.5 144.5"
                  strokeDashoffset={144.5 * (1 - touchGuardHoldProgress)}
                  transform="rotate(-90 28 28)"
                />
              </Svg>
              <Text style={styles.touchGuardProgressText}>{Math.round(touchGuardHoldProgress * 100)}%</Text>
              <Text style={styles.touchGuardProgressLabel}>長按中</Text>
            </View>
          )}
        </Pressable>
      )}

      {showTouchGuardUnlockSuccess && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.touchGuardUnlockSuccess,
            {
              top: insets.top + 56,
              opacity: touchGuardUnlockSuccessOpacity,
              transform: [{ scale: touchGuardUnlockSuccessScale }],
            },
          ]}
        >
          <Text style={styles.touchGuardUnlockSuccessCheck}>✓</Text>
        </Animated.View>
      )}

    </View>
  );
}

// ─── 子元件 ───────────────────────────────────────────────────────────────────

// DashMetric: 依 fieldKey 渲染對應的儀表板欄位
function DashMetric({ fieldKey, state, isActive, currentGrade, avgSpeed }: {
  fieldKey: NormalFieldKey;
  state: any;
  isActive: boolean;
  currentGrade: number;
  avgSpeed: number;
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
      return <BigMetric label="功率" value={`${state.currentPower}`} unit="W" accent />;
    case "showAvgSpeed":
      return <BigMetric label="均速" value={avgSpeed > 0 ? avgSpeed.toFixed(1) : "--"} unit="km/h" />;
    case "showCalories":
      return <BigMetric label="卡路里" value={`${Math.round(state.calories)}`} unit="kcal" />;
    case "showPausedTime":
      return <BigMetric label="暫停時間" value={formatDuration(state.totalPausedSec)} unit="" />;
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
  label: { color: "rgba(255,255,255,0.38)", fontSize: 10, marginBottom: 3 /* internal spacing */, letterSpacing: 0.3 },
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

  toolBar: { position: "absolute", gap: 10, zIndex: 30 },
  pinAddressBar: {
    position: "absolute",
    left: 16,
    right: 76,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 14,
    backgroundColor: "rgba(20,20,24,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    zIndex: 40,
  },
  pinAddressInput: { flex: 1, color: "#fff", fontSize: 14, minHeight: 44 },
  pinAddressSearchButton: {
    minWidth: 58,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginVertical: 4,
    backgroundColor: "#007AFF",
  },
  pinAddressSearchButtonDisabled: { opacity: 0.58 },
  pinAddressSearchText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  toolBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  toolBtnActive: { backgroundColor: "rgba(0,122,255,0.2)", borderColor: "#007AFF" },
  touchGuardToolBtnActive: { backgroundColor: "rgba(52,199,89,0.22)", borderColor: "#34C759" },
  touchGuard: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: "transparent",
  },
  touchGuardCornerHint: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(10,34,24,0.92)",
    borderColor: "rgba(52,199,89,0.72)",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  touchGuardCornerText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  touchGuardProgressRing: {
    position: "absolute",
    right: 10,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  touchGuardProgressText: { position: "absolute", top: 13, color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  touchGuardProgressLabel: { position: "absolute", top: 29, color: "rgba(255,255,255,0.76)", fontSize: 8, fontWeight: "700" },
  touchGuardUnlockSuccess: {
    position: "absolute",
    right: 10,
    zIndex: 36,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12, 91, 41, 0.96)",
    borderWidth: 2,
    borderColor: "#9CFFB5",
    shadowColor: "#34C759",
    shadowOpacity: 0.42,
    shadowRadius: 10,
    elevation: 8,
  },
  touchGuardUnlockSuccessCheck: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", lineHeight: 36 },
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

  // 轉彎指示橫幅
  turnBanner: {
    position: "absolute",
    left: 16,
    right: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,122,255,0.92)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  turnBannerArrive: {
    backgroundColor: "rgba(52,199,89,0.92)",
  },
  turnBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  turnArrowText: { fontSize: 20 },
  turnBannerContent: { flex: 1 },
  turnBannerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  turnBannerDist: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },

  // 沿路線前進橫條
  straightBanner: {
    position: "absolute",
    left: 16,
    right: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  straightBannerIcon: { fontSize: 16 },
  straightBannerText: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },
  straightBannerDist: { color: "rgba(255,255,255,0.6)", fontSize: 11 },

  // 自動暫停／騎乘定位狀態卡
  rideTrackingStatusCard: {
    position: "absolute",
    left: 16,
    right: 72,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0, 154, 112, 0.94)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 8,
  },
  rideTrackingStatusAutoPaused: {
    backgroundColor: "rgba(194, 87, 0, 0.96)",
    borderColor: "rgba(255, 211, 153, 0.7)",
  },
  rideTrackingStatusPending: {
    backgroundColor: "rgba(120, 92, 0, 0.96)",
  },
  rideTrackingStatusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  rideTrackingStatusContent: { flex: 1 },
  rideTrackingStatusTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  rideTrackingStatusSubtitle: { color: "rgba(255,255,255,0.88)", fontSize: 11, marginTop: 2 },
  rideTrackingStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#B9FFCF",
  },
  rideTrackingStatusDotPaused: { backgroundColor: "#FFE0A8" },

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
    paddingBottom: 8 /* internal spacing */, // 內部間距，不需要動態計算
  },
  panelHandle: {
    width: 36, height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    marginBottom: 6 /* internal spacing */,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2 /* internal spacing */,
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
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 /* internal spacing */ },
  progressLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  progressLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  progressValue: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  progressTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  ratePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  rateText: { fontSize: 10, fontWeight: "600" },

  // 控制按鈕
  btnRow: { alignItems: "center", marginTop: 10, marginBottom: 2 /* internal spacing */ },
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
    marginBottom: 12 /* internal spacing */,
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
    marginBottom: 4 /* internal spacing */,
  },
  recoveryDesc: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginBottom: 12 /* internal spacing */,
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
  // 釘選地點卡片
  pinCard: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(18,18,18,0.96)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 250,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.3)",
  },
  pinCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8 /* internal spacing */,
  },
  pinCardTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 10,
  },
  pinCardClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinCardCloseText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 18,
    lineHeight: 22,
  },
  pinCardBody: {
    marginBottom: 10 /* internal spacing */,
  },
  pinCardCoord: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginBottom: 4 /* internal spacing */,
  },
  pinCardStatus: {
    color: "#007AFF",
    fontSize: 12,
    fontWeight: "600",
  },
  pinCardRoute: {
    marginTop: 6 /* internal spacing */,
  },
  pinCardRouteDist: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  pinCardRouteDur: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2 /* internal spacing */,
  },
  pinCardBtns: {
    flexDirection: "row",
    gap: 8,
  },
  pinCardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
    paddingVertical: 8,
  },
  pinCardBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
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
    marginBottom: 12 /* internal spacing */,
  },
  gradeDistributionLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8 /* internal spacing */,
  },
  gradeDistributionBars: {
    flexDirection: "row",
    height: 24,
    gap: 2,
    marginBottom: 8 /* internal spacing */,
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
