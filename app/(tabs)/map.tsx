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
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  AppState,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Vibration,
} from "react-native";
import LeafletMapView, { type LeafletMapHandle, type NavigationRouteOverlay } from "@/components/leaflet-map";
import * as Location from "expo-location";
import * as Battery from "expo-battery";
import { Accelerometer } from "expo-sensors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import Svg, { Circle } from "react-native-svg";

import { useRide } from "@/lib/ride-context";
import {
  buildSportDashboardMetrics,
  calculateGapPaceSecPerKm,
  calculateVamMPerHour,
  estimateSportCalories,
  getSportTrackingPolicy,
  smoothSpeedKmh,
  SPORT_META,
  type SportType,
} from "@/lib/sport-metrics";
import { getModelRevision, subscribeModelUpdates } from "@/lib/model-governance";
import { deriveAutoPersonalMetrics } from "@/lib/auto-personal-metrics";
import { calculateAgeFromBirthday } from "@/lib/personal-profile";
import { useSettings, DEFAULT_FIELD_ORDER, type NormalFieldKey } from "@/lib/settings-context";
import { useGpx } from "@/lib/gpx-context";

import { type GpxPoint, type GpxRoute } from "@/lib/gpx-parser";
import { calculateKilometerMarkers } from "@/lib/kilometer-markers";
import {
  vibrateLight,
  vibrateMedium,
  vibrateWarning,
  vibrateSuccess,
  speakSupplyReminder,
  scheduleSmartSupplyDueNotification,
  clearAllSmartSupplyDueNotifications,
  clearAllSupplyNotifications,
  showSupplyNotification,
  cancelRidingNotification,
  requestNotificationPermission,
  setRideSpeechSuppressed,
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
import { fetchBikeRoute, formatRouteDistance } from "@/lib/route-service";
import {
  formatNavigationDataFreshness,
  loadRecentAddressSearches,
  mergeRecentAddressSearches,
  saveRecentAddressSearches,
  type RecentAddressSearch,
} from "@/lib/address-search-history";
import {
  calculateSweatLoss,
  DEFAULT_HYDRATION_THRESHOLD_ML,
  formatSweatRate,
} from "@/lib/hydration-calc";
import {
  calculatePersonalizedCalories,
} from "@/lib/personalized-ride-calculations";
import { createSupplyPlan, type SupplyPlan } from "@/lib/smart-supply-plan";
import { resolveSmartSupplyChannels } from "@/lib/smart-supply-channels";
import {
  createSmartSupplyCountdown,
  isSmartSupplyCountdownDue,
  restartSmartSupplyCountdown,
  smartSupplyCountdownRemainingSec,
  type SmartSupplyCountdown,
} from "@/lib/smart-supply-countdown";
import { deriveAutomaticSweatCalibration } from "@/lib/supply-calibration";
import { shouldRestoreBackgroundSupplyReminder } from "@/lib/background-supply-recovery";
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  setBackgroundLocationTrackingMode,
  initBackgroundState,
  getBackgroundTrackPoints,
  getBackgroundState,
  updateBackgroundEnvironment,
  updateBackgroundRiderProfile,
  updateBackgroundSmartSupplyCountdown,
  updateBackgroundSmartSupplyChannels,
  setBackgroundSupplyReminderPending,
  setBackgroundSupplyReminderEnabled,
  clearBackgroundData,
  acknowledgeBackgroundSupplyInterval,
  acknowledgeBackgroundSupplyReminder,
  type GpsAccuracyLevel,
} from "@/lib/background-location";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SupplyModal } from "@/components/supply-modal";
import { RideSummaryModal } from "@/components/ride-summary-modal";
import { SimplifiedNavOverlay } from "@/components/simplified-nav-overlay";
import {
  addTrackPoint,
  completeRideSession,
  createNewRideSession,
  initializeRideSession,
  saveRideSessionSnapshot,
  type RideSession,
} from "@/lib/ride-recovery/ride-session-recovery";
import {
  evaluateTrackPoint,
  filterTrackPointBatch,
  type TrackQualityPoint,
} from "@/lib/track-point-quality";
import { SmartPowerSavingManager } from "@/lib/power-saving/smart-power-saving-system";
import { getDueSupplyIntervals, type SupplyIntervalKind, type SupplyIntervalTracker } from "@/lib/supply-interval";
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
import { shouldTrackRideLocation } from "@/lib/ride-tracking-lifecycle";
import { shouldEnterIdleMonitor, shouldResumeFromIdleMonitor, type RideLocationTrackingMode } from "@/lib/idle-auto-pause";
import { shouldSuppressRideAudioForSystemInterruption } from "@/lib/ride-audio-interruption";
import {
  buildNavigationDashboardSummaryKeys,
  type NavigationDashboardSummaryKey,
} from "@/lib/navigation-dashboard-summary";
import {
  shouldScheduleTouchGuardRelock,
  shouldZeroLiveRideReadings,
} from "@/lib/live-ride-readings";
import {
  acceptLiveElevationDelta,
  clampVirtualPowerForRider,
  createLiveElevationFilterState,
} from "@/lib/live-elevation-filter";
import { resolveStatisticsIntervalSec } from "@/lib/activity-statistics";
import { reportRecoverableIssue } from "@/lib/release-safe-log";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const ARRIVAL_THRESHOLD_M = 30;
const TURN_LOOKAHEAD_M = 150;
const TURN_ANGLE_DEG = 30;
const AUTO_PAUSE_RESUME_THRESHOLD = 3; // 自動恢復速度閾值（km/h）- 高於暫停閾值，避免頻繁切換
const WEATHER_INTERVAL = 10 * 60 * 1000;
const LOCATION_INTERVAL_SEC = 3;

type CustomSupplyTracker = {
  lastTriggerTime: number;
  lastTriggerDistance: number;
  triggered: boolean;
  dismissTimeoutId: ReturnType<typeof setTimeout> | null;
  repeatIntervalId: ReturnType<typeof setInterval> | null;
};

// 底部面板收縮高度；展開高度由字體縮放與內容自適應計算。
const PANEL_COLLAPSED_H = Math.round(SCREEN_H / 3);

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
  const { fontScale } = useWindowDimensions();
  const dashboardColumnCount = fontScale >= 1.6 ? 2 : 3;
  const dashboardCellWidth = dashboardColumnCount === 2 ? "50%" : "33.333%";
  const dashboardCellMinHeight = fontScale >= 1.6 ? 106 : fontScale >= 1.3 ? 86 : 76;
  const { state, dispatch, saveRecord, updateRideActivity, setSportType, saveSnapshot, clearSnapshot, checkSnapshot } = useRide();
  const { settings, updateSettings } = useSettings();
  const smartSupplyChannels = resolveSmartSupplyChannels(settings);
  const smartEnergySupplyEnabled = smartSupplyChannels.energy;
  const smartWaterSupplyEnabled = smartSupplyChannels.water;
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

  // Audio — 騎乘提示不與電話或其他系統通話混音，讓系統優先處理通話音訊焦點。
  const alertPlayer = useAudioPlayer(require("../../assets/sounds/alert.mp3"));
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      interruptionModeAndroid: "doNotMix",
      shouldPlayInBackground: false,
    }).catch(() => {});
    return () => { alertPlayer.release(); };
  }, [alertPlayer]);

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
  const pendingRecoverySnapshotRef = useRef<RideSession | null>(null);
  const recoverySnapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecoverySnapshotAtRef = useRef(0);
  const [followUser, setFollowUser] = useState(true);
  const [touchGuardEnabled, setTouchGuardEnabled] = useState(false);
  const powerSavingManagerRef = useRef(SmartPowerSavingManager.getInstance());
  const autoRecenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routePaddingBottomRef = useRef(PANEL_COLLAPSED_H);

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
    }, settings.autoRecenterSec * 1000);
  }, [settings.autoRecenterSec]);

  const flushRecoverySnapshot = useCallback(async () => {
    if (recoverySnapshotTimerRef.current) {
      clearTimeout(recoverySnapshotTimerRef.current);
      recoverySnapshotTimerRef.current = null;
    }
    const session = pendingRecoverySnapshotRef.current;
    if (!session) return;
    pendingRecoverySnapshotRef.current = null;
    lastRecoverySnapshotAtRef.current = Date.now();
    await saveRideSessionSnapshot(session);
  }, []);

  const queueRecoverySnapshot = useCallback((session: RideSession) => {
    pendingRecoverySnapshotRef.current = session;
    const remainingMs = Math.max(0, 3_000 - (Date.now() - lastRecoverySnapshotAtRef.current));
    if (remainingMs === 0) {
      void flushRecoverySnapshot();
      return;
    }
    if (!recoverySnapshotTimerRef.current) {
      recoverySnapshotTimerRef.current = setTimeout(() => {
        recoverySnapshotTimerRef.current = null;
        void flushRecoverySnapshot();
      }, remainingMs);
    }
  }, [flushRecoverySnapshot]);

  useEffect(() => () => {
    if (autoRecenterTimerRef.current) clearTimeout(autoRecenterTimerRef.current);
    if (idlePauseTimerRef.current) clearTimeout(idlePauseTimerRef.current);
    void flushRecoverySnapshot();
  }, [flushRecoverySnapshot]);

  // 地圖方向完全交由使用者雙指旋轉控制；定位只更新箭頭方向，不再旋轉整張地圖。

  // 功率平滑：5 點滑動平均
  const powerWindowRef = useRef<number[]>([]);

  // 自動暫停連續計數（需連續 4 次低速才暫停，避免 GPS 抖動誤觸發）
  const lowSpeedCountRef = useRef(0);
  const AUTO_PAUSE_CONSECUTIVE = 4;
  // 速度平滑窗口（用於過濾 GPS 速度抖動）
  const speedWindowRef = useRef<number[]>([]);
  const lastValidSpeedRef = useRef<number>(0);
  const motionStillRef = useRef(true);
  const hikingPauseSuggestedRef = useRef(false);

  // 崩潰恢復
  const [showRecoveryAlert, setShowRecoveryAlert] = useState(false);
  const [recoverySnapshot, setRecoverySnapshot] = useState<Partial<import("@/lib/ride-context").RideState> | null>(null);
  const [modelRevision, setModelRevision] = useState(getModelRevision);
  useEffect(() => subscribeModelUpdates(setModelRevision), []);
  const sportTrackingPolicy = useMemo(
    () => getSportTrackingPolicy(state.sportType, modelRevision),
    [modelRevision, state.sportType],
  );

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
  // 路線服務會比較自行車道優先與一般道路候選路徑，避免不合理繞路。
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
      const fitTimer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: routePaddingBottomRef.current + 40, left: 40 },
          animated: true,
        });
        setFollowUser(false);
      }, 400);
      return () => clearTimeout(fitTimer);
    } else {
      setNavInstruction("");
      setIsNavigating(false);
      setDistToEnd(null);
    }
  }, [gpxRoute]);

  // 即時軌跡
  const [liveTrail, setLiveTrail] = useState<{ latitude: number; longitude: number; segmentStart?: boolean }[]>([]);

  // 坡度
  const [currentGrade, setCurrentGrade] = useState(0);
  const prevAltRef = useRef<number | null>(null);
  const prevPosRef = useRef<{ lat: number; lon: number } | null>(null);
  const liveElevationFilterRef = useRef(createLiveElevationFilterState());
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
  // GPS 航向自適應循環平均：只用於位置箭頭與風向計算，不控制地圖角度。
  const headingWindowRef = useRef<number[]>([]);
  // 上一個 GPS 位置（用於低速時計算方位角）
  const prevGpsForBearingRef = useRef<{ lat: number; lon: number } | null>(null);
  const lastFollowCameraCenterRef = useRef<{ lat: number; lon: number } | null>(null);

  // 騎乘狀態與背景監聽
  const [mapRideActive, setMapRideActive] = useState(false);
  const [isAppForeground, setIsAppForeground] = useState(true);

  useEffect(() => {
    if (!mapRideActive || !sportTrackingPolicy.autoPause.requiresStillness) {
      motionStillRef.current = true;
      return;
    }
    let subscription: { remove: () => void } | null = null;
    let active = true;
    void (async () => {
      const available = await Accelerometer.isAvailableAsync();
      if (!active || !available) return;
      Accelerometer.setUpdateInterval(500);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        // 重力約為 1 g；偏差小於 0.055 g 視為手機靜止。
        motionStillRef.current = Math.abs(magnitude - 1) < 0.055;
      });
    })();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [mapRideActive, sportTrackingPolicy.autoPause.requiresStillness]);
  const touchGuardHintOpacity = useRef(new Animated.Value(0)).current;
  const [touchGuardHoldProgress, setTouchGuardHoldProgress] = useState(0);
  const touchGuardHoldStartedAtRef = useRef<number | null>(null);
  const touchGuardHoldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchGuardRelockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTouchGuardUnlockSuccess, setShowTouchGuardUnlockSuccess] = useState(false);
  const touchGuardUnlockSuccessOpacity = useRef(new Animated.Value(0)).current;
  const touchGuardUnlockSuccessScale = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppForeground(nextState === "active");
      const shouldSuppressAudio = shouldSuppressRideAudioForSystemInterruption(nextState);
      setRideSpeechSuppressed(shouldSuppressAudio);
      if (shouldSuppressAudio) {
        void stopSpeech();
        try { alertPlayer.pause(); } catch {}
      }
    });
    return () => {
      subscription.remove();
      setRideSpeechSuppressed(false);
    };
  }, [alertPlayer]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryRecordId, setSummaryRecordId] = useState<string | null>(null);
  // 補給提醒分別管理（支援兩種同時顯示）
  const [calorieAlert, setCalorieAlert] = useState(false);
  const [waterAlert, setWaterAlert] = useState(false);
  const [supplyRecommendedMl, setSupplyRecommendedMl] = useState<number | undefined>(undefined);
  const [supplyRecommendation, setSupplyRecommendation] = useState<SupplyPlan | undefined>(undefined);
  const [activeSupplyPlan, setActiveSupplyPlan] = useState<SupplyPlan | undefined>(undefined);
  const [smartSupplyCountdown, setSmartSupplyCountdown] = useState<SmartSupplyCountdown | null>(null);
  const smartSupplyCountdownRef = useRef<SmartSupplyCountdown | null>(null);
  const lastBackgroundCountdownSnapshotRef = useRef("");

  const syncSmartSupplyCountdown = useCallback((nextCountdown: SmartSupplyCountdown | null) => {
    smartSupplyCountdownRef.current = nextCountdown;
    setSmartSupplyCountdown(nextCountdown);
    if (!nextCountdown) return;
    const snapshot = [
      nextCountdown.calorieStartedElapsedSec,
      nextCountdown.waterStartedElapsedSec,
      nextCountdown.calorieDurationSec,
      nextCountdown.waterDurationSec,
    ].join(":");
    if (snapshot !== lastBackgroundCountdownSnapshotRef.current) {
      lastBackgroundCountdownSnapshotRef.current = snapshot;
      void updateBackgroundSmartSupplyCountdown({
        smartCalorieCountdownStartedElapsedSec: nextCountdown.calorieStartedElapsedSec,
        smartWaterCountdownStartedElapsedSec: nextCountdown.waterStartedElapsedSec,
        smartCalorieCountdownDurationSec: nextCountdown.calorieDurationSec,
        smartWaterCountdownDurationSec: nextCountdown.waterDurationSec,
      });
      const currentElapsedSec = stateRef.current.elapsed;
      void scheduleSmartSupplyDueNotification(
        "calorie",
        Date.now() + Math.max(1, nextCountdown.calorieDueElapsedSec - currentElapsedSec) * 1000,
      );
      void scheduleSmartSupplyDueNotification(
        "water",
        Date.now() + Math.max(1, nextCountdown.waterDueElapsedSec - currentElapsedSec) * 1000,
      );
    }
  }, []);

  const calorieReminderSentRef = useRef(false);
  const waterReminderSentRef = useRef(false);
  const notifPermRef = useRef(false);
  // 重複提醒計時器
  const supplyRepeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // 追蹤尚未確認的補給類型（「稍後」只關閉 Modal，不清除此 ref）
  const pendingCalorieRef = useRef(false);
  const pendingWaterRef = useRef(false);
  const pendingSupplyPlansRef = useRef<Partial<Record<"calorie" | "water", SupplyPlan>>>({});
  const supplySnoozedUntilRef = useRef<Record<"calorie" | "water", number>>({ calorie: 0, water: 0 });
  const rideStartLocationRef = useRef<{ lat: number; lon: number } | null>(null); // 記錄騎乘開始座標
  const lastTurnSpokenRef = useRef<number>(0); // 追蹤上次播報轉彎的時間
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
  const [pinAddressCandidates, setPinAddressCandidates] = useState<RecentAddressSearch[]>([]);
  const [pinAddressNotice, setPinAddressNotice] = useState<string | null>(null);
  const [recentAddressSearches, setRecentAddressSearches] = useState<RecentAddressSearch[]>([]);
  const [lastNavigationDataRefreshAt, setLastNavigationDataRefreshAt] = useState<number | null>(null);

  useEffect(() => {
    void loadRecentAddressSearches().then(setRecentAddressSearches);
  }, []);

  const clearAllNavigationLayers = useCallback(() => {
    // 立即通知 Leaflet 清空已繪製圖層與數字標記，避免等待 React state 更新而短暫殘留。
    mapRef.current?.clearNavigationGraphics();
    clearSharedRoute();
    setPinnedNavigationLayers([]);
    setActiveNavigationRoute(null);
    setNearestIdx(0);
    setIsNavigating(false);
    // 清除導航圖層不等於結束騎乘；騎乘中的 GPS、計時與累計資料必須持續。
    if (stateRef.current.status === "idle" || stateRef.current.status === "finished") {
      setMapRideActive(false);
    }
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
    // 釘選導航以畫面提示呈現；騎乘語音僅保留補給／補水兩種固定短句。
    void announcement;
    const nextLayer: PinnedNavigationLayer<GpxRoute> = {
      id: `pinned-${Date.now()}`,
      route,
    };
    const commitRoute = (clearExisting: boolean) => {
      if (clearExisting) clearSharedRoute();
      setPinnedNavigationLayers((previous) => applyPinnedNavigationDecision(previous, nextLayer, clearExisting));
      setActiveNavigationRoute(route);
      setIsNavigating(true);
      // 這只啟用地圖追蹤，絕不可 dispatch START／RESET；既有騎乘必須維持原計時與累計。
      setMapRideActive(true);
      setFollowUser(true);
      setNearestIdx(0);
      arrivedRef.current = false;
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
  }, [clearSharedRoute, pinnedNavigationLayers.length, sharedRoute]);

  const selectPinAddressDestination = useCallback((destination: RecentAddressSearch) => {
    const nextLocation = { lat: destination.latitude, lon: destination.longitude };
    setPinnedLocation(nextLocation);
    setPinnedLocationLabel(destination.label);
    setPinAddress(destination.label);
    setPinRouteInfo(null);
    setShowPinCard(true);
    setPinSelectMode(false);
    setCenterPinLocation(null);
    setPinAddressCandidates([]);
    const nextHistory = mergeRecentAddressSearches(recentAddressSearches, { ...destination, usedAt: Date.now() });
    setRecentAddressSearches(nextHistory);
    void saveRecentAddressSearches(nextHistory);
    mapRef.current?.animateCamera({ center: { latitude: nextLocation.lat, longitude: nextLocation.lon }, zoom: 16 }, { duration: 360 });
  }, [recentAddressSearches]);

  const handleRefreshPinMapData = useCallback(() => {
    mapRef.current?.refreshBaseTiles();
    setLastNavigationDataRefreshAt(Date.now());
    setPinRouteInfo(null);
    Alert.alert(
      "已請求更新圖資",
      "地圖已重新向上游請求圖磚。請再按「計算路線」重新取得道路與自行車道資料；臨時施工或短時封路仍可能有延遲，請以現場管制為準。",
    );
  }, []);

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
      if (!results.length) {
        setPinAddressCandidates([]);
        setPinAddressNotice("找不到地址。請補上城市、區域或門牌；也可直接移動地圖中心圖釘選點。");
        return;
      }
      const candidates = results.slice(0, 5).map((item) => ({
        label: address,
        latitude: item.latitude,
        longitude: item.longitude,
        usedAt: Date.now(),
      }));
      if (candidates.length === 1) {
        setPinAddressNotice(null);
        selectPinAddressDestination(candidates[0]);
      } else {
        setPinAddressNotice(null);
        setPinAddressCandidates(candidates);
      }
    } catch {
      setPinAddressCandidates([]);
      setPinAddressNotice("地址搜尋暫時不可用。請確認網路與定位服務；離線時仍可直接移動地圖，以中心圖釘選擇目的地。");
    } finally {
      setIsResolvingPinAddress(false);
    }
  }, [pinAddress, selectPinAddressDestination]);

  // ── 自訂補給品追蹤 ──
  // 記錄每個補給品上次觸發的時間（秒）或距離（公里）
  const supplyItemsTrackerRef = useRef<Record<string, CustomSupplyTracker>>({});
  // 追蹤器結構: { lastTriggerTime, lastTriggerDistance, triggered, dismissTimeoutId, repeatIntervalId }
  // 自訂補給品提醒狀態
  const [customSupplyAlerts, setCustomSupplyAlerts] = useState<Record<string, boolean>>({});
  const customSupplyAlertsRef = useRef<Record<string, boolean>>({});
  const [activeSupplyAlerts, setActiveSupplyAlerts] = useState<string[]>([]);
  // 手動能量／補水間隔：各自以時間與距離基準追蹤，確認後只重置對應規則。
  const intervalSupplyTrackerRef = useRef<SupplyIntervalTracker>({
    "energy-time": 0,
    "energy-distance": 0,
    "water-time": 0,
    "water-distance": 0,
  });
  const intervalSupplyAlertsRef = useRef<Partial<Record<SupplyIntervalKind, boolean>>>({});
  const [intervalSupplyAlerts, setIntervalSupplyAlerts] = useState<Partial<Record<SupplyIntervalKind, boolean>>>({});
  const intervalSupplyRepeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalSnoozedUntilRef = useRef<Partial<Record<SupplyIntervalKind, number>>>({});
  const supplyAutoDismissTimersRef = useRef<Partial<Record<"calorie" | "water", ReturnType<typeof setTimeout>>>>({});

  // 清除重複提醒計時器
  const clearSupplyRepeatTimer = useCallback(() => {
    if (supplyRepeatTimerRef.current) {
      clearInterval(supplyRepeatTimerRef.current);
      supplyRepeatTimerRef.current = null;
    }
    pendingCalorieRef.current = false;
    pendingWaterRef.current = false;
    pendingSupplyPlansRef.current = {};
  }, []);
  const clearIntervalSupplyRepeatTimer = useCallback(() => {
    if (intervalSupplyRepeatTimerRef.current) {
      clearInterval(intervalSupplyRepeatTimerRef.current);
      intervalSupplyRepeatTimerRef.current = null;
    }
  }, []);
  const clearSupplyAutoDismissTimer = useCallback((type?: "calorie" | "water") => {
    const types: ("calorie" | "water")[] = type ? [type] : ["calorie", "water"];
    types.forEach((kind) => {
      const timer = supplyAutoDismissTimersRef.current[kind];
      if (timer) clearTimeout(timer);
      delete supplyAutoDismissTimersRef.current[kind];
    });
  }, []);

  const previousSupplyReminderEnabledRef = useRef(settings.supplyReminderEnabled);
  const clearAllActiveSupplyReminders = useCallback(() => {
    clearSupplyRepeatTimer();
    clearIntervalSupplyRepeatTimer();
    clearSupplyAutoDismissTimer();
    Object.values(supplyItemsTrackerRef.current).forEach((tracker) => {
      if (tracker.dismissTimeoutId) clearTimeout(tracker.dismissTimeoutId);
      if (tracker.repeatIntervalId) clearInterval(tracker.repeatIntervalId);
    });
    customSupplyAlertsRef.current = {};
    setCustomSupplyAlerts({});
    setActiveSupplyAlerts([]);
    intervalSupplyAlertsRef.current = {};
    setIntervalSupplyAlerts({});
    intervalSnoozedUntilRef.current = {};
    setCalorieAlert(false);
    setWaterAlert(false);
    setSupplyRecommendedMl(undefined);
    setSupplyRecommendation(undefined);
    syncSmartSupplyCountdown(null);
    calorieReminderSentRef.current = false;
    waterReminderSentRef.current = false;
    void stopSpeech();
    try { alertPlayer.pause(); } catch {}
    Vibration.cancel();
    void clearAllSupplyNotifications();
    void setBackgroundSupplyReminderEnabled(false);
  }, [alertPlayer, clearIntervalSupplyRepeatTimer, clearSupplyAutoDismissTimer, clearSupplyRepeatTimer, syncSmartSupplyCountdown]);

  useEffect(() => () => clearSupplyAutoDismissTimer(), [clearSupplyAutoDismissTimer]);

  useEffect(() => {
    const wasEnabled = previousSupplyReminderEnabledRef.current;
    if (!settings.supplyReminderEnabled) {
      clearAllActiveSupplyReminders();
    } else if (!wasEnabled) {
      const elapsed = stateRef.current.elapsed;
      const distanceKm = stateRef.current.distance / 1000;
      intervalSupplyTrackerRef.current = {
        "energy-time": elapsed,
        "energy-distance": distanceKm,
        "water-time": elapsed,
        "water-distance": distanceKm,
      };
      intervalSnoozedUntilRef.current = {};
      supplyItemsTrackerRef.current = Object.fromEntries(
        settings.supplyItems.filter((item) => item.enabled).map((item) => [item.id, {
          lastTriggerTime: elapsed,
          lastTriggerDistance: distanceKm,
          triggered: false,
          dismissTimeoutId: null,
          repeatIntervalId: null,
        }]),
      );
      void setBackgroundSupplyReminderEnabled(true);
    }
    previousSupplyReminderEnabledRef.current = settings.supplyReminderEnabled;
  }, [clearAllActiveSupplyReminders, settings.supplyItems, settings.supplyReminderEnabled]);

  useEffect(() => {
    if (!mapRideActive) return;
    void updateBackgroundSmartSupplyChannels({
      energyEnabled: smartEnergySupplyEnabled,
      waterEnabled: smartWaterSupplyEnabled,
    });
  }, [mapRideActive, smartEnergySupplyEnabled, smartWaterSupplyEnabled]);

  useEffect(() => {
    if (!mapRideActive) return;
    void updateBackgroundRiderProfile({
      weightKg: settings.weight,
      heightCm: settings.height,
      ageYears: estimateAgeYears ?? 32,
      ftpW: estimateFtpW,
      bikeWeightKg: settings.bikeWeight ?? 10,
      sweatRateCalibrationMultiplier: settings.sweatRateCalibrationMultiplier,
      energyServingCarbohydrateG: settings.energyServingCarbohydrateG,
      energyCarbohydrateHourlyLimitMode: settings.energyCarbohydrateHourlyLimitMode,
      energyCarbohydrateHourlyLimitG: settings.energyCarbohydrateHourlyLimitG,
    });
  }, [estimateAgeYears, estimateFtpW, mapRideActive, settings.bikeWeight, settings.energyCarbohydrateHourlyLimitG, settings.energyCarbohydrateHourlyLimitMode, settings.energyServingCarbohydrateG, settings.height, settings.sweatRateCalibrationMultiplier, settings.weight]);

  useEffect(() => {
    customSupplyAlertsRef.current = customSupplyAlerts;
  }, [customSupplyAlerts]);

  useEffect(() => () => {
    clearSupplyRepeatTimer();
    clearIntervalSupplyRepeatTimer();
  }, [clearIntervalSupplyRepeatTimer, clearSupplyRepeatTimer]);

  const lastLocationRef = useRef<Location.LocationObject | null>(null);
  const lastAcceptedTrackPointRef = useRef<TrackQualityPoint | null>(null);
  const lastBgSyncTsRef = useRef<number>(0); // 背景軌跡去重：記錄上次同步的最大時間戳
  const stateRef = useRef(state);
  stateRef.current = state;

  // 進度條動畫
  const calorieAnim = useRef(new Animated.Value(0)).current;
  const waterAnim = useRef(new Animated.Value(0)).current;

  const handleConfirmCustomSupply = useCallback((id: string, type: "time" | "distance") => {
    customSupplyAlertsRef.current = { ...customSupplyAlertsRef.current, [id]: false };
    setCustomSupplyAlerts(customSupplyAlertsRef.current);
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
    vibrateLight();
  }, [state.elapsed, state.distance]);

  const handleConfirmIntervalSupply = useCallback((kind: SupplyIntervalKind) => {
    const current = stateRef.current;
    if (kind.endsWith("-time")) intervalSupplyTrackerRef.current[kind] = current.elapsed;
    else intervalSupplyTrackerRef.current[kind] = current.distance / 1000;
    void acknowledgeBackgroundSupplyInterval(kind);

    const nextAlerts = { ...intervalSupplyAlertsRef.current, [kind]: false };
    intervalSupplyAlertsRef.current = nextAlerts;
    setIntervalSupplyAlerts(nextAlerts);
    if (!Object.values(nextAlerts).some(Boolean)) clearIntervalSupplyRepeatTimer();
    if (settings.vibrationEnabled) vibrateSuccess();
  }, [clearIntervalSupplyRepeatTimer, settings.vibrationEnabled]);

  const handleConfirmCalorieSupply = useCallback(() => {
    clearSupplyAutoDismissTimer("calorie");
    setCalorieAlert(false);
    const confirmedPlan = pendingSupplyPlansRef.current.calorie ?? supplyRecommendation;
    if (smartEnergySupplyEnabled && confirmedPlan && smartSupplyCountdownRef.current) {
      syncSmartSupplyCountdown(
        restartSmartSupplyCountdown(
          smartSupplyCountdownRef.current,
          "calorie",
          confirmedPlan,
          stateRef.current.elapsed,
        ),
      );
    } else {
      dispatch({ type: "CONSUME_CALORIES" });
    }
    dispatch({
      type: "SUPPLY_CONFIRMED",
      confirmation: {
        type: "energy",
        timestamp: Date.now(),
        elapsedSec: stateRef.current.elapsed,
        recommendedEnergyKcal: confirmedPlan?.energyRecommendationKcal,
        recommendedCarbohydrateG: confirmedPlan?.carbohydrateRecommendationG,
        source: confirmedPlan?.source,
        reason: confirmedPlan?.reason,
      },
    });
    calorieAnim.setValue(0);
    calorieReminderSentRef.current = false;
    pendingCalorieRef.current = false;
    delete pendingSupplyPlansRef.current.calorie;
    const waterStillPending = pendingWaterRef.current || waterAlert;
    if (!waterStillPending) setSupplyRecommendation(undefined);
    supplySnoozedUntilRef.current.calorie = 0;
    void acknowledgeBackgroundSupplyReminder("calorie");
    void clearAllSupplyNotifications();
    if (settings.vibrationEnabled) vibrateSuccess();
    if (!waterStillPending) clearSupplyRepeatTimer();
  }, [calorieAnim, clearSupplyAutoDismissTimer, clearSupplyRepeatTimer, dispatch, settings.vibrationEnabled, smartEnergySupplyEnabled, supplyRecommendation, syncSmartSupplyCountdown, waterAlert]);

  const handleConfirmWaterSupply = useCallback(() => {
    clearSupplyAutoDismissTimer("water");
    setWaterAlert(false);
    setSupplyRecommendedMl(undefined);
    const confirmedPlan = pendingSupplyPlansRef.current.water ?? supplyRecommendation;
    if (smartWaterSupplyEnabled && confirmedPlan && smartSupplyCountdownRef.current) {
      syncSmartSupplyCountdown(
        restartSmartSupplyCountdown(
          smartSupplyCountdownRef.current,
          "water",
          confirmedPlan,
          stateRef.current.elapsed,
        ),
      );
    } else {
      dispatch({ type: "CONSUME_WATER" });
    }
    dispatch({
      type: "SUPPLY_CONFIRMED",
      confirmation: {
        type: "water",
        timestamp: Date.now(),
        elapsedSec: stateRef.current.elapsed,
        recommendedWaterMl: confirmedPlan?.waterRecommendationMl ?? supplyRecommendedMl,
        source: confirmedPlan?.source,
        reason: confirmedPlan?.reason,
      },
    });
    waterAnim.setValue(0);
    waterReminderSentRef.current = false;
    pendingWaterRef.current = false;
    delete pendingSupplyPlansRef.current.water;
    const calorieStillPending = pendingCalorieRef.current || calorieAlert;
    if (!calorieStillPending) setSupplyRecommendation(undefined);
    supplySnoozedUntilRef.current.water = 0;
    void acknowledgeBackgroundSupplyReminder("water");
    void clearAllSupplyNotifications();
    if (settings.vibrationEnabled) vibrateSuccess();
    if (!calorieStillPending) clearSupplyRepeatTimer();
  }, [calorieAlert, clearSupplyAutoDismissTimer, clearSupplyRepeatTimer, dispatch, settings.vibrationEnabled, smartWaterSupplyEnabled, supplyRecommendation, supplyRecommendedMl, syncSmartSupplyCountdown, waterAnim]);

  const handleSnoozeSupply = useCallback((kind: SupplyNotificationKind, customItemId?: string) => {
    if ((kind === "calorie" && smartEnergySupplyEnabled) || (kind === "water" && smartWaterSupplyEnabled)) return;
    const until = Date.now() + 5 * 60 * 1000;
    if (kind === "calorie" || kind === "water") {
      clearSupplyAutoDismissTimer(kind);
      supplySnoozedUntilRef.current[kind] = until;
      if (kind === "calorie") setCalorieAlert(false);
      else setWaterAlert(false);
      if (supplyRepeatTimerRef.current) {
        clearInterval(supplyRepeatTimerRef.current);
        supplyRepeatTimerRef.current = null;
      }
    } else if (kind === "custom-energy" || kind === "custom-water") {
      if (customItemId) {
        customSupplyAlertsRef.current = { ...customSupplyAlertsRef.current, [customItemId]: false };
        setCustomSupplyAlerts(customSupplyAlertsRef.current);
        setActiveSupplyAlerts((current) => current.filter((id) => id !== customItemId));
        const tracker = supplyItemsTrackerRef.current[customItemId];
        if (tracker?.repeatIntervalId) clearInterval(tracker.repeatIntervalId);
      }
    } else {
      const intervalKind = kind.replace("interval-", "") as SupplyIntervalKind;
      intervalSnoozedUntilRef.current[intervalKind] = until;
      const nextAlerts = { ...intervalSupplyAlertsRef.current, [intervalKind]: false };
      intervalSupplyAlertsRef.current = nextAlerts;
      setIntervalSupplyAlerts(nextAlerts);
      clearIntervalSupplyRepeatTimer();
    }
    void scheduleSupplySnooze(kind);
  }, [clearIntervalSupplyRepeatTimer, clearSupplyAutoDismissTimer, smartEnergySupplyEnabled, smartWaterSupplyEnabled]);

  const processSupplyNotificationAction = useCallback((action: SupplyNotificationAction) => {
    if (!settings.supplyReminderEnabled) return;
    if (action.action === "snooze") {
      handleSnoozeSupply(action.kind, action.customItemId);
      return;
    }
    if (action.kind === "calorie") handleConfirmCalorieSupply();
    else if (action.kind === "water") handleConfirmWaterSupply();
    else if (action.kind === "custom-energy" || action.kind === "custom-water") {
      const item = settings.supplyItems.find((candidate) => candidate.id === action.customItemId);
      if (item) handleConfirmCustomSupply(item.id, item.triggerType);
    } else handleConfirmIntervalSupply(action.kind.replace("interval-", "") as SupplyIntervalKind);
  }, [handleConfirmCalorieSupply, handleConfirmCustomSupply, handleConfirmIntervalSupply, handleConfirmWaterSupply, handleSnoozeSupply, settings.supplyItems, settings.supplyReminderEnabled]);

  useEffect(() => {
    const processQueuedActions = async () => {
      const actions = await consumeSupplyNotificationActions();
      actions.forEach(processSupplyNotificationAction);
    };
    void processQueuedActions();
    return subscribeToSupplyNotificationActions(() => { void processQueuedActions(); });
  }, [processSupplyNotificationAction]);

  const sortedActiveAlerts = useMemo(() => {
    return [...activeSupplyAlerts].sort((a, b) => {
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

  const scheduleTouchGuardRelock = useCallback(() => {
    if (touchGuardRelockTimerRef.current) {
      clearTimeout(touchGuardRelockTimerRef.current);
      touchGuardRelockTimerRef.current = null;
    }
    if (!shouldScheduleTouchGuardRelock(settings.touchGuardEnabled, isActive)) return;
    touchGuardRelockTimerRef.current = setTimeout(() => {
      setTouchGuardEnabled(true);
      touchGuardRelockTimerRef.current = null;
    }, settings.touchGuardAutoRelockSec * 1000);
  }, [isActive, settings.touchGuardAutoRelockSec, settings.touchGuardEnabled]);

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
    scheduleTouchGuardRelock();
  }, [scheduleTouchGuardRelock, settings.vibrationEnabled, showTouchGuardUnlockSuccessFeedback, touchGuardEnabled]);

  useEffect(() => () => {
    resetTouchGuardHoldProgress();
    if (touchGuardRelockTimerRef.current) clearTimeout(touchGuardRelockTimerRef.current);
    touchGuardUnlockSuccessOpacity.stopAnimation();
    touchGuardUnlockSuccessScale.stopAnimation();
  }, [resetTouchGuardHoldProgress, touchGuardUnlockSuccessOpacity, touchGuardUnlockSuccessScale]);

  useEffect(() => {
    const manager = powerSavingManagerRef.current;
    if (isActive) manager.start();
    else manager.stop();
    return () => manager.stop();
  }, [isActive]);

  const hasPendingSupplyModal = settings.supplyReminderEnabled && (
    calorieAlert
    || waterAlert
    || activeSupplyAlerts.length > 0
    || Object.values(intervalSupplyAlerts).some(Boolean)
  );

  useEffect(() => {
    const manager = powerSavingManagerRef.current;
    const holdKey = "supply-confirmation-modal";
    if (hasPendingSupplyModal) {
      // 補給彈窗等待確認期間，保持正常亮度且不啟動調暗倒數。
      void manager.holdBrightness(holdKey);
    } else {
      // 能量、補水、手動與自訂提醒均已確認／關閉後才恢復調暗計時。
      manager.releaseBrightnessHold(holdKey);
    }
    return () => manager.releaseBrightnessHold(holdKey);
  }, [hasPendingSupplyModal]);

  const hydrationThresholdMl = settings.waterThreshold > 0
    ? settings.waterThreshold
    : DEFAULT_HYDRATION_THRESHOLD_ML;
  const fallbackSupplyPlan = useMemo(() => createSupplyPlan({
    mode: settings.supplyCalculationMode,
    sportType: state.sportType,
    calorieThresholdKcal: settings.calorieThreshold,
    waterThresholdMl: hydrationThresholdMl,
    elapsedSec: state.elapsed,
    riderWeightKg: settings.weight,
    ftpW: estimateFtpW,
    intensityFactor: state.currentPower > 0 ? Math.min(2, state.currentPower / Math.max(1, estimateFtpW)) : 0.65,
    sweatRatePerHour: state.currentSweatRatePerHour || 550,
    environmentLoad: Math.min(1, Math.max(0, ((state.currentSweatRatePerHour || 550) - 550) / 1_000)),
    weatherAvailable: false,
    energyServingCarbohydrateG: settings.energyServingCarbohydrateG,
    energyCarbohydrateHourlyLimitMode: settings.energyCarbohydrateHourlyLimitMode,
    energyCarbohydrateHourlyLimitG: settings.energyCarbohydrateHourlyLimitG,
  }), [estimateFtpW, hydrationThresholdMl, settings.calorieThreshold, settings.energyCarbohydrateHourlyLimitG, settings.energyCarbohydrateHourlyLimitMode, settings.energyServingCarbohydrateG, settings.supplyCalculationMode, settings.weight, state.currentPower, state.currentSweatRatePerHour, state.elapsed, state.sportType]);
  const dashboardSupplyPlan = activeSupplyPlan ?? fallbackSupplyPlan;

  // ─── 底部面板滑桿 ─────────────────────────────────────────────────────────────
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [sportPickerVisible, setSportPickerVisible] = useState(false);
  const [sportPickerQuery, setSportPickerQuery] = useState("");
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
  const dashboardSummaryKeys = useMemo(
    () => buildNavigationDashboardSummaryKeys(dashPanelFields),
    [dashPanelFields],
  );
  const dashFieldCount = dashPanelFields.length;

  // 200% 字體時改為兩欄，並預留多行標籤與數值的高度，避免截斷。
  const cellHeight = fontScale >= 1.6 ? 106 : fontScale >= 1.3 ? 86 : 60;
  const headerHeight = fontScale >= 1.6 ? 112 : fontScale >= 1.3 ? 96 : 80;
  const controlHeight = fontScale >= 1.6 ? 84 : 64;
  const dashRows = Math.ceil(dashFieldCount / dashboardColumnCount) || 1;
  const dashGridH = dashRows * cellHeight;
  const collapsedPanelLimit = Math.round(SCREEN_H * (fontScale >= 1.6 ? 0.54 : fontScale >= 1.3 ? 0.44 : 1 / 3));
  const expandedPanelHeight = Math.round(SCREEN_H * (fontScale >= 1.6 ? 0.82 : fontScale >= 1.3 ? 0.72 : 0.62));
  const dynamicCollapsedH = Math.min(
    headerHeight + dashGridH + controlHeight,
    collapsedPanelLimit
  );
  routePaddingBottomRef.current = dynamicCollapsedH;
  const sportPickerOptions = useMemo(() => {
    const query = sportPickerQuery.trim().toLowerCase();
    return (Object.keys(SPORT_META) as SportType[]).filter((type) => {
      const meta = SPORT_META[type];
      return !query || meta.label.toLowerCase().includes(query) || type.includes(query);
    });
  }, [sportPickerQuery]);

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
      toValue: expand ? expandedPanelHeight : dynamicCollapsedH,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [panelAnim, dynamicCollapsedH, expandedPanelHeight]);

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

  const speakPlannedSupplyReminder = useCallback(
    (type: "calorie" | "water") => {
      if (!settings.ttsEnabled) return;
      void speakSupplyReminder(type, true);
    },
    [settings.ttsEnabled],
  );

  // ─── 補給提醒 ────────────────────────────────────────────────────────────────
  const triggerSupplyReminder = useCallback(
    async (type: "calorie" | "water", recommendation?: SupplyPlan) => {
      if (!settings.supplyReminderEnabled) return;
      if (supplySnoozedUntilRef.current[type] > Date.now()) return;
      powerSavingManagerRef.current.onSupplyReminder();
      setTouchGuardEnabled(false);
      if (type === "calorie") {
        pendingCalorieRef.current = true;
        setCalorieAlert(true);
      } else {
        pendingWaterRef.current = true;
        setWaterAlert(true);
        if (recommendation?.waterRecommendationMl) setSupplyRecommendedMl(recommendation.waterRecommendationMl);
      }
      if (recommendation) setSupplyRecommendation(recommendation);
      if (recommendation) pendingSupplyPlansRef.current[type] = recommendation;
      if ((type === "calorie" ? smartEnergySupplyEnabled : smartWaterSupplyEnabled)) void setBackgroundSupplyReminderPending(type, true);
      if (settings.vibrationEnabled) vibrateWarning();
      speakPlannedSupplyReminder(type);
      if (settings.soundEnabled) {
        try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
      }
      if (settings.notificationEnabled) {
        void showSupplyNotification(type, (type === "calorie" ? smartEnergySupplyEnabled : smartWaterSupplyEnabled) ? undefined : recommendation ? {
          energyKcal: recommendation.energyRecommendationKcal,
          carbohydrateG: recommendation.carbohydrateRecommendationG,
          waterMl: recommendation.waterRecommendationMl,
          reason: recommendation.reason,
        } : undefined);
      }

      // 單次提醒自動關閉功能
      const autoDismissSeconds = type === "calorie" ? settings.calorieAutoDismissSeconds : settings.waterAutoDismissSeconds;
      if (!(type === "calorie" ? smartEnergySupplyEnabled : smartWaterSupplyEnabled) && autoDismissSeconds && autoDismissSeconds > 0) {
        clearSupplyAutoDismissTimer(type);
        const autoDismissTimer = setTimeout(() => {
          delete supplyAutoDismissTimersRef.current[type];
          if (type === "calorie") {
            setCalorieAlert(false);
            pendingCalorieRef.current = false;
            delete pendingSupplyPlansRef.current.calorie;
          } else {
            setWaterAlert(false);
            pendingWaterRef.current = false;
            delete pendingSupplyPlansRef.current.water;
          }
        }, autoDismissSeconds * 1000);
        supplyAutoDismissTimersRef.current[type] = autoDismissTimer;
      }

      // 唯一的重複提醒間隔：0 代表關閉，正值同時套用能量與補水。
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
          if (caloriePending) {
            speakPlannedSupplyReminder("calorie");
          } else if (waterPending) {
            speakPlannedSupplyReminder("water");
          }
          if (settings.vibrationEnabled) vibrateWarning();
          if (settings.soundEnabled) {
            try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
          }
        }, repeatSec * 1000);
      }
    },
    [settings, alertPlayer, clearSupplyAutoDismissTimer, clearSupplyRepeatTimer, smartEnergySupplyEnabled, smartWaterSupplyEnabled, speakPlannedSupplyReminder]
  );

  // ─── 自訂補給品觸發邏輯 ────────────────────────────────────────────────────────
  const triggerCustomSupplyReminder = useCallback(
    async (supplyItem: any) => {
      if (!settings.supplyReminderEnabled) return;
      if (!supplyItem.enabled) return;
      const target = supplyItem.target === "water" ? "water" : "calorie";

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

      // 同一品項待確認時不重複建立彈窗；重複提醒交由共用間隔處理。
      if (customSupplyAlertsRef.current[supplyItem.id]) {
        return;
      }

      // 觸發提醒
      customSupplyAlertsRef.current = { ...customSupplyAlertsRef.current, [supplyItem.id]: true };
      setCustomSupplyAlerts(customSupplyAlertsRef.current);
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
      if (settings.ttsEnabled) void speakSupplyReminder(target, true);
      if (settings.soundEnabled) {
        try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
      }
      if (settings.notificationEnabled) void showSupplyNotification(target === "calorie" ? "custom-energy" : "custom-water", undefined, supplyItem.id);

      // 使用唯一的全域重複間隔；0 代表關閉。
      const repeatSec = settings.supplyReminderRepeatSec ?? 60;
      if (repeatSec > 0) {
        if (tracker.repeatIntervalId) clearInterval(tracker.repeatIntervalId);
        tracker.repeatIntervalId = setInterval(() => {
          if (customSupplyAlertsRef.current[supplyItem.id]) {
            if (settings.vibrationEnabled) vibrateWarning();
            if (settings.ttsEnabled) void speakSupplyReminder(target, true);
            if (settings.soundEnabled) {
              try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
            }
          } else {
            if (tracker.repeatIntervalId) {
              clearInterval(tracker.repeatIntervalId);
              tracker.repeatIntervalId = null;
            }
          }
        }, repeatSec * 1000);
      }
    },
    [settings, alertPlayer]
  );

  const triggerIntervalSupplyReminder = useCallback(() => {
    if (!settings.supplyReminderEnabled) return;
    const current = stateRef.current;
    if (current.status !== "active") return;

    const dueKinds = getDueSupplyIntervals(
      {
        energy: {
          timeEnabled: smartEnergySupplyEnabled ? false : settings.supplyEnergyTimeIntervalEnabled,
          timeMinutes: settings.supplyEnergyTimeIntervalMinutes,
          distanceEnabled: smartEnergySupplyEnabled ? false : settings.supplyEnergyDistanceIntervalEnabled,
          distanceKm: settings.supplyEnergyDistanceIntervalKm,
        },
        water: {
          timeEnabled: smartWaterSupplyEnabled ? false : settings.supplyWaterTimeIntervalEnabled,
          timeMinutes: settings.supplyWaterTimeIntervalMinutes,
          distanceEnabled: smartWaterSupplyEnabled ? false : settings.supplyWaterDistanceIntervalEnabled,
          distanceKm: settings.supplyWaterDistanceIntervalKm,
        },
      },
      intervalSupplyTrackerRef.current,
      current.elapsed,
      current.distance / 1000,
      (Object.keys(intervalSupplyTrackerRef.current) as SupplyIntervalKind[]).reduce<Partial<Record<SupplyIntervalKind, boolean>>>((alerts, kind) => ({
        ...alerts,
        [kind]: Boolean(intervalSupplyAlertsRef.current[kind] || (intervalSnoozedUntilRef.current[kind] ?? 0) > Date.now()),
      }), {}),
    );
    if (dueKinds.length === 0) return;

    const nextAlerts = { ...intervalSupplyAlertsRef.current };
    dueKinds.forEach((kind) => { nextAlerts[kind] = true; });
    intervalSupplyAlertsRef.current = nextAlerts;
    setIntervalSupplyAlerts(nextAlerts);
    powerSavingManagerRef.current.onSupplyReminder();
    setTouchGuardEnabled(false);
    if (settings.vibrationEnabled) vibrateWarning();
    const dueTargets = new Set(dueKinds.map((kind) => kind.startsWith("energy-") ? "calorie" : "water"));
    if (settings.ttsEnabled) dueTargets.forEach((target) => { void speakSupplyReminder(target, true); });
    if (settings.soundEnabled) {
      try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
    }
    if (settings.notificationEnabled) dueKinds.forEach((kind) => {
      void showSupplyNotification(`interval-${kind}`);
    });

    const repeatSec = settings.supplyReminderRepeatSec;
    if (repeatSec > 0 && !intervalSupplyRepeatTimerRef.current) {
      intervalSupplyRepeatTimerRef.current = setInterval(() => {
        const alerts = intervalSupplyAlertsRef.current;
        const pendingKinds = (Object.keys(intervalSupplyTrackerRef.current) as SupplyIntervalKind[])
          .filter((kind) => alerts[kind] && (intervalSnoozedUntilRef.current[kind] ?? 0) <= Date.now());
        if (pendingKinds.length === 0) {
          clearIntervalSupplyRepeatTimer();
          return;
        }
        if (settings.vibrationEnabled) vibrateWarning();
        if (settings.ttsEnabled) {
          const targets = new Set(pendingKinds.map((kind) => kind.startsWith("energy-") ? "calorie" : "water"));
          targets.forEach((target) => { void speakSupplyReminder(target, true); });
        }
        if (settings.soundEnabled) {
          try { alertPlayer.seekTo(0); alertPlayer.play(); } catch {}
        }
      }, repeatSec * 1000);
    }
  }, [alertPlayer, clearIntervalSupplyRepeatTimer, settings, smartEnergySupplyEnabled, smartWaterSupplyEnabled]);

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
        pausedElapsedRef.current = stateRef.current.elapsed;
        timerRef.current = setInterval(() => {
          dispatch({ type: "PAUSE_TICK" });
        }, 1000);
      }
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [dispatch, state.status]);

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
          segmentStart: point.segmentStart,
        }));
        const lastPoint = persistentSession.trackPoints.at(-1);
        lastAcceptedTrackPointRef.current = lastPoint
          ? {
            latitude: lastPoint.latitude,
            longitude: lastPoint.longitude,
            timestamp: lastPoint.timestamp,
            accuracy: lastPoint.accuracy,
            speed: lastPoint.speed,
          }
          : null;
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
        setLiveTrail(recoveredRoute.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
          segmentStart: point.segmentStart,
        })));
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
    let locationSubscription: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      notifPermRef.current = await requestNotificationPermission();

      const isIdleMonitor = rideLocationTrackingMode === "idle_monitor";
      const sub = await Location.watchPositionAsync(
        {
          accuracy: isIdleMonitor ? Location.Accuracy.Balanced : Location.Accuracy.BestForNavigation,
          timeInterval: isIdleMonitor ? 60_000 : LOCATION_INTERVAL_SEC * 1000,
          distanceInterval: isIdleMonitor ? 18 : sportTrackingPolicy.gpsDistanceIntervalM,
        },
        (loc) => {
          if (!active) return;
          const { latitude, longitude, altitude, heading, speed } = loc.coords;
          const speedKmhRaw = (speed ?? 0) * 3.6;

          const trackPointDecision = mapRideActive
            ? evaluateTrackPoint(lastAcceptedTrackPointRef.current, {
              latitude,
              longitude,
              timestamp: loc.timestamp,
              accuracy: loc.coords.accuracy,
              speed,
            })
            : { accepted: true, segmentStart: false };
          if (mapRideActive && !trackPointDecision.accepted) return;
          if (mapRideActive) {
            lastAcceptedTrackPointRef.current = {
              latitude,
              longitude,
              timestamp: loc.timestamp,
              accuracy: loc.coords.accuracy,
              speed,
            };
          }

          if (isIdleMonitor) {
            const previous = idleMonitorLastPositionRef.current;
            const movementM = previous ? haversine(previous.lat, previous.lon, latitude, longitude) : 0;
            idleMonitorLastPositionRef.current = { lat: latitude, lon: longitude };
            if (shouldResumeFromIdleMonitor(speedKmhRaw, movementM)) {
              pausedAtRef.current = null;
              setRideLocationTrackingMode("full");
              dispatch({ type: "RESUME" });
              void setBackgroundLocationTrackingMode(settings.gpsAccuracy || "standard", "full");
            }
            return;
          }

          // ── 車頭朝前精度改善（融合電子羅盤 + GPS）──────────────────────────────────────────────────────
          // 策略：
          //   1. 地圖只採用可信 GPS 行進方向，避免手機羅盤在固定座上的微動使整張地圖打轉。
          //   2. 羅盤僅保留為資料來源，不直接驅動地圖；低速或低精度時維持上次穩定航向。
          //   3. GPS 精度、速度或角度變化不足時，不更新地圖旋轉。
          let rawHdg = heading ?? -1;
          const locationAccuracyM = loc.coords.accuracy;
          const gpsHeadingValid = rawHdg >= 0 && speedKmhRaw >= 7 && locationAccuracyM !== null && locationAccuracyM !== undefined && locationAccuracyM <= 35;
          if (!gpsHeadingValid) {
            // 低速或低精度時，以可靠的連續 GPS 位置估算箭頭航向。
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
          // 自適應循環平均：只平滑箭頭航向，不改變地圖方向。
          const windowSize = speedKmhRaw >= 20 ? 3 : speedKmhRaw >= 12 ? 4 : 5;
          headingWindowRef.current.push(rawHdg);
          if (headingWindowRef.current.length > windowSize) headingWindowRef.current.shift();
          // 角度平均：轉換為向量再平均，避免 350°/10° 平均出 180° 的問題
          const sinSum = headingWindowRef.current.reduce((s, h) => s + Math.sin((h * Math.PI) / 180), 0);
          const cosSum = headingWindowRef.current.reduce((s, h) => s + Math.cos((h * Math.PI) / 180), 0);
          const hdg = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
          headingRef.current = hdg;
          setCurrentPos({ lat: latitude, lon: longitude, heading: hdg });
          if (followUser && (locationAccuracyM ?? Number.POSITIVE_INFINITY) <= 35) {
            const previousCenter = lastFollowCameraCenterRef.current;
            const movementSinceCamera = previousCenter
              ? haversineDistance(previousCenter.lat, previousCenter.lon, latitude, longitude)
              : Number.POSITIVE_INFINITY;
            if (movementSinceCamera >= 8) {
              lastFollowCameraCenterRef.current = { lat: latitude, lon: longitude };
              mapRef.current?.animateCamera(
                { center: { latitude, longitude }, zoom: 17 },
                { duration: 280 },
              );
            }
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
          
          const displacementM = prevPosRef.current
            ? haversine(prevPosRef.current.lat, prevPosRef.current.lon, latitude, longitude)
            : null;
          const driftFilterM = sportTrackingPolicy.stationaryDriftThresholdM;
          const autoPausePolicy = getSportTrackingPolicy(currentState.sportType).autoPause;
          const shouldZeroReadings = mapRideActive && shouldZeroLiveRideReadings({
            rawSpeedKmh: speedKmh,
            displacementM,
            accuracyM: loc.coords.accuracy,
            motionStill: motionStillRef.current,
            pauseThresholdKmh: autoPausePolicy.speedBelowKmh,
            driftThresholdM: driftFilterM,
          });
          let smoothedSpeed = speedKmh;
          
          // GPS 漂移過濾
          if (prevPosRef.current) {
            if (shouldZeroReadings) {
              // 停紅燈或室內時的定位漂移不可延續上一筆速度。
              smoothedSpeed = 0;
              lastValidSpeedRef.current = 0;
            } else {
              // 有效移動，更新有效速度
              lastValidSpeedRef.current = speedKmh;
            }
          }
          
          // 速度平滑（5 點滑動平均）
          speedWindowRef.current.push(smoothedSpeed);
          const sportSpeedWindowSize = stateRef.current.sportType === "running" || stateRef.current.sportType === "trail_running" ? 3 : 5;
          if (speedWindowRef.current.length > sportSpeedWindowSize) speedWindowRef.current.shift();
          const avgSpeed = speedWindowRef.current.reduce((a, b) => a + b, 0) / speedWindowRef.current.length;
          
          // 自動暫停/恢復邏輯
          if (currentState.status === "active") {
            const satisfiesStillness = !autoPausePolicy.requiresStillness || motionStillRef.current;
            if (autoPausePolicy.mode === "automatic" && avgSpeed < autoPausePolicy.speedBelowKmh && satisfiesStillness) {
              lowSpeedCountRef.current += 1;
              if (lowSpeedCountRef.current >= AUTO_PAUSE_CONSECUTIVE) {
                lowSpeedCountRef.current = 0;
                pausedElapsedRef.current = currentState.elapsed;
                dispatch({ type: "PAUSE" });
                // 暫停時強制歸零速度與功率
                dispatch({ type: "LOCATION_UPDATE", point: { latitude, longitude, altitude: altitude ?? 0, speed: 0, timestamp: Date.now() }, power: 0, calories: 0, ascent: 0 });
                if (settings.vibrationEnabled) vibrateMedium();
                return;
              }
            } else if (autoPausePolicy.mode === "suggest" && avgSpeed < autoPausePolicy.speedBelowKmh) {
              lowSpeedCountRef.current += 1;
              const hikingPromptCount = Math.ceil(autoPausePolicy.stillForSeconds / LOCATION_INTERVAL_SEC);
              if (lowSpeedCountRef.current >= hikingPromptCount && !hikingPauseSuggestedRef.current) {
                hikingPauseSuggestedRef.current = true;
                Alert.alert("登山停留提示", "已偵測到長時間低速停留。登山模式不會自動暫停；若正在休息，可手動暫停以保持移動時間精確。");
              }
            } else {
              lowSpeedCountRef.current = 0;
              hikingPauseSuggestedRef.current = false;
            }
          } else if (currentState.status === "paused" && autoPausePolicy.mode === "automatic" && avgSpeed >= Math.max(AUTO_PAUSE_RESUME_THRESHOLD, autoPausePolicy.speedBelowKmh + 0.5)) {
            lowSpeedCountRef.current = 0;
            dispatch({ type: "RESUME" });
            return;
          }

          if (shouldZeroReadings) {
            // 不追加軌跡、不更新距離／均速／爬升／卡路里；只讓即時速度與功率安全歸零。
            powerWindowRef.current = [];
            prevSpeedMsRef.current = 0;
            setCurrentGrade(0);
            dispatch({ type: "LIVE_READINGS_STATIONARY" });
            return;
          }

          // 即時軌跡
          if (mapRideActive) {
            setLiveTrail((prev) => [...prev, {
              latitude,
              longitude,
              segmentStart: trackPointDecision.segmentStart || undefined,
            }]);
            if (trackPointDecision.segmentStart) {
              prevPosRef.current = { lat: latitude, lon: longitude };
              prevAltRef.current = altitude ?? null;
              gradeWindowRef.current = [];
            }
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
          let distanceM = 0;
          const previousLocation = lastLocationRef.current;
          if (!trackPointDecision.segmentStart && lastLocationRef.current) {
            distanceM = haversineDistance(
              lastLocationRef.current.coords.latitude,
              lastLocationRef.current.coords.longitude,
              latitude, longitude
            );
            const altDiff = (altitude ?? 0) - (lastLocationRef.current.coords.altitude ?? 0);
            grade = calcGrade(altDiff, distanceM);
          }
          if (trackPointDecision.segmentStart) {
            // 背景／定位中斷後開啟新資料段，不能用舊段高度跨距離推導爬升或下降。
            liveElevationFilterRef.current = createLiveElevationFilterState();
          }
          const elevationDelta = acceptLiveElevationDelta(liveElevationFilterRef.current, altitude, distanceM);
          const ascent = elevationDelta.ascentM;
          const statisticsIntervalSec = !trackPointDecision.segmentStart
            ? resolveStatisticsIntervalSec(previousLocation?.timestamp ?? null, loc.timestamp)
            : 0;
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
          const isCyclingSport = currentState.sportType === "cycling";
          const rawPower = isCyclingSport ? calculatePower({
            speedMs: currentSpeedMs,
            prevSpeedMs: prevSpeedMsRef.current,
            intervalSec: statisticsIntervalSec,
            gradePct: grade,
            windSpeedMs: headwindMs,
            riderMassKg: settings.weight,
            bikeMassKg: settings.bikeWeight ?? 10,
            airDensityKgM3: airDensityRef.current,
          }) : 0;
          const boundedVirtualPower = clampVirtualPowerForRider(rawPower, estimateFtpW);
          prevSpeedMsRef.current = currentSpeedMs;
          if (isCyclingSport) powerWindowRef.current.push(boundedVirtualPower);
          if (powerWindowRef.current.length > 5) powerWindowRef.current.shift();
          const power = isCyclingSport
            ? Math.round(powerWindowRef.current.reduce((a, b) => a + b, 0) / Math.max(1, powerWindowRef.current.length))
            : 0;
          const calIncrement = isCyclingSport
            ? calculatePersonalizedCalories({
              powerW: power,
              hasMeasuredPower: power > 0,
              speedKmh,
              gradePct: grade,
              riderWeightKg: settings.weight,
              ftpW: estimateFtpW,
              intervalSec: statisticsIntervalSec,
              temperatureC: currentWeather?.temperature,
              humidityPct: currentWeather?.humidity,
              weatherCode: currentWeather?.weatherCode,
              precipitationProb: currentWeather?.precipitationProb,
              headwindMs,
            }).kcal
            : estimateSportCalories({
              sportType: currentState.sportType,
              weightKg: settings.weight,
              durationSec: statisticsIntervalSec,
              speedKmh,
              gradePct: grade,
              vamMPerHour: sportVam,
            });

          dispatch({
            type: "LOCATION_UPDATE",
            point: {
              latitude,
              longitude,
              altitude: altitude ?? 0,
              speed: speed ?? 0,
              timestamp: loc.timestamp,
              segmentStart: trackPointDecision.segmentStart || undefined,
            },
            power,
            calories: calIncrement,
            ascent,
            descent: elevationDelta.descentM,
            acceptedElevationM: elevationDelta.acceptedAltitudeM,
            distanceM,
            intervalSec: statisticsIntervalSec,
            powerSource: isCyclingSport ? "estimated" : "unavailable",
            caloriesSource: isCyclingSport ? "power-estimate" : "met-estimate",
          });

          const sweatResult = calculateSweatLoss({
            weightKg: settings.weight,
            heightCm: settings.height,
            powerW: power,
            speedKmh,
            ascentPerInterval: ascent,
            gradePct: grade,
            intervalSec: statisticsIntervalSec,
            temperatureC: weatherRef.current?.temperature ?? 25,
            humidityPct: weatherRef.current?.humidity ?? 60,
            weatherCode: weatherRef.current?.weatherCode ?? 1,
            isDaylight: new Date().getHours() >= 6 && new Date().getHours() < 18,
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
              segmentStart: trackPointDecision.segmentStart || undefined,
            };
            addTrackPoint(recoverySession, trackPoint, recoverySession.trackPoints.at(-1));
            recoverySession.stats.caloriesBurned += calIncrement;
            recoverySession.stats.waterLoss += sweatResult.sweatLossMl;
            queueRecoverySnapshot(recoverySession);
          }

          const supplyPlan = createSupplyPlan({
            mode: settings.supplyCalculationMode,
            sportType: currentState.sportType,
            calorieThresholdKcal: settings.calorieThreshold,
            waterThresholdMl: hydrationThresholdMl,
            elapsedSec: currentState.elapsed,
            riderWeightKg: settings.weight,
            ftpW: estimateFtpW,
            intensityFactor: isCyclingSport ? Math.min(2, power / Math.max(1, estimateFtpW)) : 1,
            sweatRatePerHour: sweatResult.sweatRatePerHour,
            environmentLoad: sweatResult.environmentLoad,
            weatherAvailable: Boolean(currentWeather),
            energyServingCarbohydrateG: settings.energyServingCarbohydrateG,
            energyCarbohydrateHourlyLimitMode: settings.energyCarbohydrateHourlyLimitMode,
            energyCarbohydrateHourlyLimitG: settings.energyCarbohydrateHourlyLimitG,
          });
          setActiveSupplyPlan(supplyPlan);
          const isSmartEnergyMode = settings.supplyReminderEnabled && smartEnergySupplyEnabled;
          const isSmartWaterMode = settings.supplyReminderEnabled && smartWaterSupplyEnabled;
          const hasSmartSupplyChannel = isSmartEnergyMode || isSmartWaterMode;
          const currentCountdown = smartSupplyCountdownRef.current;
          // 倒數建立後保持固定，不能隨環境、功率或天氣更新而延後／提前。
          // 只有使用者按下「已補給／已補水」時才會建立該類別的新一輪倒數。
          const nextCountdown = hasSmartSupplyChannel
            ? (currentCountdown ?? createSmartSupplyCountdown(supplyPlan, currentState.elapsed))
            : null;
          if (hasSmartSupplyChannel && nextCountdown) {
            syncSmartSupplyCountdown(nextCountdown);
          }
          const newCalories = currentState.calories + calIncrement;
          const newSweatSince = currentState.sweatSinceLastRefill + sweatResult.sweatLossMl;
          const smartCalorieRemainingSec = smartSupplyCountdownRemainingSec(nextCountdown, "calorie", currentState.elapsed);
          const smartWaterRemainingSec = smartSupplyCountdownRemainingSec(nextCountdown, "water", currentState.elapsed);
          const manualEnergyKind: SupplyIntervalKind | null = settings.supplyReminderEnabled && !isSmartEnergyMode
            ? (settings.supplyEnergyTimeIntervalEnabled ? "energy-time" : settings.supplyEnergyDistanceIntervalEnabled ? "energy-distance" : null)
            : null;
          const manualWaterKind: SupplyIntervalKind | null = settings.supplyReminderEnabled && !isSmartWaterMode
            ? (settings.supplyWaterTimeIntervalEnabled ? "water-time" : settings.supplyWaterDistanceIntervalEnabled ? "water-distance" : null)
            : null;
          const manualEnergyProgress = manualEnergyKind === "energy-time"
            ? (currentState.elapsed - (intervalSupplyTrackerRef.current[manualEnergyKind] ?? 0)) / Math.max(1, settings.supplyEnergyTimeIntervalMinutes * 60)
            : manualEnergyKind === "energy-distance"
              ? ((currentState.distance / 1000) - (intervalSupplyTrackerRef.current[manualEnergyKind] ?? 0)) / Math.max(0.1, settings.supplyEnergyDistanceIntervalKm)
              : 0;
          const manualWaterProgress = manualWaterKind === "water-time"
            ? (currentState.elapsed - (intervalSupplyTrackerRef.current[manualWaterKind] ?? 0)) / Math.max(1, settings.supplyWaterTimeIntervalMinutes * 60)
            : manualWaterKind === "water-distance"
              ? ((currentState.distance / 1000) - (intervalSupplyTrackerRef.current[manualWaterKind] ?? 0)) / Math.max(0.1, settings.supplyWaterDistanceIntervalKm)
              : 0;
          const calPct = isSmartEnergyMode && nextCountdown
            ? Math.min(1, 1 - Math.max(0, smartCalorieRemainingSec ?? 0) / Math.max(1, nextCountdown.calorieDurationSec))
            : manualEnergyKind
              ? Math.min(1, Math.max(0, manualEnergyProgress))
            : Math.min(1, newCalories / supplyPlan.calorieTriggerKcal);
          const waterPct = isSmartWaterMode && nextCountdown
            ? Math.min(1, 1 - Math.max(0, smartWaterRemainingSec ?? 0) / Math.max(1, nextCountdown.waterDurationSec))
            : manualWaterKind
              ? Math.min(1, Math.max(0, manualWaterProgress))
            : Math.min(1, newSweatSince / supplyPlan.waterTriggerMl);

          Animated.timing(calorieAnim, { toValue: calPct, duration: 500, useNativeDriver: false }).start();
          Animated.timing(waterAnim, { toValue: waterPct, duration: 500, useNativeDriver: false }).start();

          // 智慧模式改由倒數到期觸發；提醒不因坡度而被延後或抑制。
          const calorieDue = settings.supplyReminderEnabled && isSmartEnergyMode
            && isSmartSupplyCountdownDue(nextCountdown, "calorie", currentState.elapsed);
          if (calorieDue && !calorieReminderSentRef.current && !pendingCalorieRef.current) {
            calorieReminderSentRef.current = true;
            triggerSupplyReminder("calorie", supplyPlan);
          }

          const waterDue = settings.supplyReminderEnabled && isSmartWaterMode
            && isSmartSupplyCountdownDue(nextCountdown, "water", currentState.elapsed);
          if (waterDue && !waterReminderSentRef.current && !pendingWaterRef.current) {
            waterReminderSentRef.current = true;
            triggerSupplyReminder("water", supplyPlan);
          }

          // ── 自訂補給品觸發 ──
          if (settings.supplyReminderEnabled && settings.supplyItems && settings.supplyItems.length > 0) {
            for (const supplyItem of settings.supplyItems) {
              triggerCustomSupplyReminder(supplyItem);
            }
          }
          triggerIntervalSupplyReminder();

          if (notifPermRef.current && settings.notificationEnabled && currentState.elapsed % 30 === 0) {
          }
        }
      );
      if (!active) {
        sub.remove();
        return;
      }
      locationSubscription = sub;
      locationSubRef.current = sub;
    })();

    return () => {
      active = false;
      locationSubscription?.remove();
      if (locationSubRef.current === locationSubscription) locationSubRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUser, mapRideActive, isNavigating, gpxRoute, rideLocationTrackingMode, settings]);

  // ─── GPX 導航邏輯 ────────────────────────────────────────────────────────────
  const handleNavigation = useCallback(
    (lat: number, lon: number, speedMs: number) => {
      if (!gpxRoute) return;
      const pts = gpxRoute.points;
      const idx = findNearestPointIndex(lat, lon, pts);
      setNearestIdx(idx);

      const endPt = pts[pts.length - 1];
      const dEnd = haversine(lat, lon, endPt.lat, endPt.lon);
      setDistToEnd(dEnd);

      if (!arrivedRef.current && dEnd < ARRIVAL_THRESHOLD_M) {
        arrivedRef.current = true;
        setNavInstruction("已到達終點！");
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
    [gpxRoute]
  );

  // ─── 開始/停止騎乘 ────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert("定位服務未開啟", "請先在手機系統設定開啟定位服務，再開始騎乘紀錄。");
        return;
      }
      const foregroundPermission = await Location.getForegroundPermissionsAsync();
      const permission = foregroundPermission.status === "granted"
        ? foregroundPermission
        : await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("需要定位權限", "開始騎乘需要精確定位權限，才能記錄距離、速度與軌跡。您可在系統設定中隨時重新開啟。");
        return;
      }
    } catch {
      Alert.alert("無法確認定位狀態", "請確認定位服務與權限後再試一次。");
      return;
    }
    if (idlePauseTimerRef.current) clearTimeout(idlePauseTimerRef.current);
    idlePauseTimerRef.current = null;
    pausedAtRef.current = null;
    idleMonitorLastPositionRef.current = null;
    setRideLocationTrackingMode("full");
    pausedElapsedRef.current = 0;
    dispatch({ type: "START", hydrationThresholdMl });
    calorieReminderSentRef.current = false;
    waterReminderSentRef.current = false;
    syncSmartSupplyCountdown(null);
    calorieAnim.setValue(0);
    waterAnim.setValue(0);
    lastLocationRef.current = null;
    lastAcceptedTrackPointRef.current = null;
    lastBgSyncTsRef.current = 0;
    setLiveTrail([]);
    setCurrentGrade(0);
    prevAltRef.current = null;
    prevPosRef.current = null;
    liveElevationFilterRef.current = createLiveElevationFilterState();
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
    lastRecoverySnapshotAtRef.current = Date.now();
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
        dismissTimeoutId: null,
        repeatIntervalId: null,
      };
    });
    intervalSupplyTrackerRef.current = {
      "energy-time": 0,
      "energy-distance": 0,
      "water-time": 0,
      "water-distance": 0,
    };
    intervalSupplyAlertsRef.current = {};
    setIntervalSupplyAlerts({});
    clearIntervalSupplyRepeatTimer();

    if (gpxRoute) {
      setIsNavigating(true);
      setNavInstruction("導航已啟動");
    }

    // 初始化背景狀態（確保背景中能計算距離和觸發補給提醒）
    const lastPos = await Location.getLastKnownPositionAsync();
    await initBackgroundState({
      calorieThreshold: settings.calorieThreshold,
      waterThreshold: hydrationThresholdMl,
      supplyCalculationMode: settings.supplyCalculationMode,
      smartEnergySupplyEnabled,
      smartWaterSupplyEnabled,
      supplyReminderEnabled: settings.supplyReminderEnabled,
      sportType: state.sportType,
      currentLat: lastPos?.coords.latitude ?? 0,
      currentLon: lastPos?.coords.longitude ?? 0,
      currentTimestamp: lastPos?.timestamp,
      currentAccuracy: lastPos?.coords.accuracy,
      supplyEnergyTimeIntervalEnabled: smartEnergySupplyEnabled ? false : settings.supplyEnergyTimeIntervalEnabled,
      supplyEnergyTimeIntervalMinutes: settings.supplyEnergyTimeIntervalMinutes,
      supplyEnergyDistanceIntervalEnabled: smartEnergySupplyEnabled ? false : settings.supplyEnergyDistanceIntervalEnabled,
      supplyEnergyDistanceIntervalKm: settings.supplyEnergyDistanceIntervalKm,
      supplyWaterTimeIntervalEnabled: smartWaterSupplyEnabled ? false : settings.supplyWaterTimeIntervalEnabled,
      supplyWaterTimeIntervalMinutes: settings.supplyWaterTimeIntervalMinutes,
      supplyWaterDistanceIntervalEnabled: smartWaterSupplyEnabled ? false : settings.supplyWaterDistanceIntervalEnabled,
      supplyWaterDistanceIntervalKm: settings.supplyWaterDistanceIntervalKm,
      riderProfile: {
        weightKg: settings.weight,
        heightCm: settings.height,
        ageYears: estimateAgeYears ?? 32,
        ftpW: estimateFtpW,
        bikeWeightKg: settings.bikeWeight ?? 10,
        sweatRateCalibrationMultiplier: settings.sweatRateCalibrationMultiplier,
        energyServingCarbohydrateG: settings.energyServingCarbohydrateG,
        energyCarbohydrateHourlyLimitMode: settings.energyCarbohydrateHourlyLimitMode,
        energyCarbohydrateHourlyLimitG: settings.energyCarbohydrateHourlyLimitG,
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
    const backgroundTrackingStarted = await startBackgroundLocationTracking(settings.gpsAccuracy || "standard");
    if (!backgroundTrackingStarted) {
      Alert.alert(
        "背景騎乘未啟用",
        "目前會在 App 開啟時持續記錄；若鎖定螢幕或切到背景，請在系統設定允許背景定位與電池不受限制，以維持完整軌跡。",
      );
    }

    const loc = await Location.getLastKnownPositionAsync();
    if (loc) updateWeather(loc.coords.latitude, loc.coords.longitude);
    weatherTimerRef.current = setInterval(async () => {
      const l = await Location.getLastKnownPositionAsync();
      if (l) updateWeather(l.coords.latitude, l.coords.longitude);
    }, WEATHER_INTERVAL);
  }, [clearIntervalSupplyRepeatTimer, currentPos, dispatch, estimateAgeYears, estimateFtpW, hydrationThresholdMl, gpxRoute, settings, smartEnergySupplyEnabled, smartWaterSupplyEnabled, state.sportType, syncSmartSupplyCountdown, updateWeather, calorieAnim, waterAnim]);

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
          await clearAllSmartSupplyDueNotifications();
          // 結束騎乘清除補給重複提醒計時器
          clearSupplyRepeatTimer();
          setCalorieAlert(false);
          setWaterAlert(false);
          syncSmartSupplyCountdown(null);
          calorieReminderSentRef.current = false;
          waterReminderSentRef.current = false;
          pendingCalorieRef.current = false;
          pendingWaterRef.current = false;
          pendingSupplyPlansRef.current = {};
          supplySnoozedUntilRef.current = { calorie: 0, water: 0 };
          setSupplyRecommendedMl(undefined);
          setSupplyRecommendation(undefined);
          setActiveSupplyPlan(undefined);
          customSupplyAlertsRef.current = {};
          setCustomSupplyAlerts({}); // 重置自訂補給品提醒狀態
          supplyItemsTrackerRef.current = {}; // 重置自訂補給品追蹤器
          intervalSupplyTrackerRef.current = {
            "energy-time": 0,
            "energy-distance": 0,
            "water-time": 0,
            "water-distance": 0,
          };
          intervalSupplyAlertsRef.current = {};
          setIntervalSupplyAlerts({});
          clearIntervalSupplyRepeatTimer();

          // 結束騎乘前先保存節流中的最新恢復快照。恢復資料會保留至活動記錄確實寫入成功。
          await flushRecoverySnapshot();
          // 先不帶名稱儲存記錄，之後在摘要 Modal 取得名稱後更新；個人設定與環境摘要只保存在裝置上。
          try {
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
            if (!savedRecordId) throw new Error("活動記錄未建立");

            // 僅在歷史活動已成功保存後清除恢復資料，避免儲存空間不足時遺失本次騎乘。
            await clearSnapshot();
            if (recoverySessionRef.current) {
              await completeRideSession(recoverySessionRef.current);
              recoverySessionRef.current = null;
            }
            if (savedRecordId) {
              const calibrationResult = deriveAutomaticSweatCalibration({
                rides: [
                  ...stateRef.current.records.filter((record) => record.id !== savedRecordId),
                  {
                    id: savedRecordId,
                    date: Date.now(),
                    duration: stateRef.current.elapsed,
                    movingTime: stateRef.current.elapsed,
                    totalSweatMl: stateRef.current.totalSweatMl,
                    avgPower: stateRef.current.avgPower,
                    avgSpeed: stateRef.current.avgSpeed,
                    totalAscent: stateRef.current.totalAscent,
                    calculationProfile: {
                      riderWeightKg: settings.weight,
                      ftpW: estimateFtpW,
                      environment: {
                        averageTemperatureC: sampleCount ? environmentSummary.temperatureTotal / sampleCount : undefined,
                        averageHumidityPct: sampleCount ? environmentSummary.humidityTotal / sampleCount : undefined,
                        averageHeadwindMs: sampleCount ? environmentSummary.headwindTotal / sampleCount : undefined,
                        averagePrecipitationProb: sampleCount ? environmentSummary.precipitationTotal / sampleCount : undefined,
                        weatherCode: environmentSummary.latestWeatherCode,
                      },
                    },
                    supplyConfirmations: stateRef.current.supplyConfirmations,
                  },
                ],
                currentMultiplier: settings.sweatRateCalibrationMultiplier,
                completedCalibrations: settings.sweatRateCalibrationCount,
                lastProcessedRideId: settings.sweatRateCalibrationLastRideId,
              });
              if (calibrationResult.applied) {
                await updateSettings({
                  sweatRateCalibrationMultiplier: calibrationResult.nextMultiplier,
                  sweatRateCalibrationCount: calibrationResult.nextCount,
                  sweatRateCalibrationLastRideId: savedRecordId,
                });
              }
            }
            // 僅在本機儲存成功後重設本次騎乘暫態；保留目前位置與外部導航圖層。
            setLiveTrail([]);
            setCurrentGrade(0);
            prevAltRef.current = null;
            prevPosRef.current = null;
            liveElevationFilterRef.current = createLiveElevationFilterState();
            prevGpsForBearingRef.current = null;
            lastLocationRef.current = null;
            lastAcceptedTrackPointRef.current = null;
            speedWindowRef.current = [];
            powerWindowRef.current = [];
            gradeWindowRef.current = [];
            prevSpeedMsRef.current = 0;
            lowSpeedCountRef.current = 0;
            dispatch({ type: "RESET" });
            setShowSummary(true);
            if (settings.vibrationEnabled) vibrateSuccess();
          } catch {
            Alert.alert(
              "本機儲存失敗",
              "本次騎乘無法寫入裝置儲存空間。請確認可用空間後重新開啟 App，並避免在釋放空間前移除應用程式。",
            );
          }
          
        },
      },
    ]);
  }, [clearIntervalSupplyRepeatTimer, clearSnapshot, clearSupplyRepeatTimer, dispatch, estimateFtpW, flushRecoverySnapshot, saveRecord, settings, syncSmartSupplyCountdown, updateSettings]);

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
          }
          if (settings.supplyReminderEnabled && bgState && bgState.supplyReminderEnabled !== false) {
            const backgroundSmartChannels = resolveSmartSupplyChannels(bgState);
            const backgroundElapsedSec = Math.max(0, Math.floor((Date.now() - (bgState.rideStartedAt || Date.now())) / 1000));
            const smartCalorieDue = backgroundSmartChannels.energy
              && typeof bgState.smartCalorieCountdownDurationSec === "number"
              && backgroundElapsedSec >= (bgState.smartCalorieCountdownStartedElapsedSec ?? 0) + bgState.smartCalorieCountdownDurationSec;
            const smartWaterDue = backgroundSmartChannels.water
              && typeof bgState.smartWaterCountdownDurationSec === "number"
              && backgroundElapsedSec >= (bgState.smartWaterCountdownStartedElapsedSec ?? 0) + bgState.smartWaterCountdownDurationSec;
            // 只有背景有尚未處理的新到期提醒時才重新開啟彈窗；前景已確認後的 ref
            // 不得成為重複彈窗來源，否則每次背景返回都會重新顯示。
            if (shouldRestoreBackgroundSupplyReminder({
              persistedPending: bgState.calorieReminderSent,
              countdownDue: smartCalorieDue,
              pendingInForeground: pendingCalorieRef.current,
            })) {
              calorieReminderSentRef.current = true;
              pendingCalorieRef.current = true;
              setCalorieAlert(true);
              void setBackgroundSupplyReminderPending("calorie", true);
            }
            if (shouldRestoreBackgroundSupplyReminder({
              persistedPending: bgState.waterReminderSent,
              countdownDue: smartWaterDue,
              pendingInForeground: pendingWaterRef.current,
            })) {
              waterReminderSentRef.current = true;
              pendingWaterRef.current = true;
              setWaterAlert(true);
              void setBackgroundSupplyReminderPending("water", true);
            }
          }
          // 軌跡恢復與補給提醒是獨立功能；即使使用者關閉提醒，也必須恢復鎖定期間的軌跡。
          if (bgState && bgTrack.length > 0) {
            // 只合併尚未同步的背景點，並再次套用品質檢核，防止鎖定期間的延遲批次產生跨區直線。
            const newPoints = filterTrackPointBatch(
              bgTrack
                .filter((point) => point.ts > lastBgSyncTsRef.current)
                .map((point) => ({
                  latitude: point.lat,
                  longitude: point.lon,
                  timestamp: point.ts,
                  accuracy: point.accuracy,
                  altitude: point.altitude,
                  speed: point.speed,
                  segmentStart: point.segmentStart,
                  distanceM: point.distanceM,
                  ascentM: point.ascentM,
                  descentM: point.descentM,
                  acceptedElevationM: point.acceptedElevationM,
                  powerW: point.powerW,
                  caloriesKcal: point.caloriesKcal,
                  intervalSec: point.intervalSec,
                })),
              lastAcceptedTrackPointRef.current,
            );
            if (newPoints.length > 0) {
              setLiveTrail((previous) => [
                ...previous,
                ...newPoints.map((point) => ({
                  latitude: point.latitude,
                  longitude: point.longitude,
                  segmentStart: point.segmentStart,
                })),
              ]);
              for (const point of newPoints) {
                dispatch({
                  type: "LOCATION_UPDATE",
                  point: {
                    latitude: point.latitude,
                    longitude: point.longitude,
                    altitude: point.altitude ?? 0,
                    speed: point.speed ?? 0,
                    timestamp: point.timestamp,
                    segmentStart: point.segmentStart,
                  },
                  power: point.powerW ?? 0,
                  calories: point.caloriesKcal ?? 0,
                  ascent: point.ascentM ?? 0,
                  descent: point.descentM ?? 0,
                  acceptedElevationM: point.acceptedElevationM,
                  distanceM: point.segmentStart ? 0 : point.distanceM ?? 0,
                  intervalSec: point.intervalSec ?? 0,
                  isBackgroundRecovery: true,
                  powerSource: point.powerW !== undefined ? "estimated" : "unavailable",
                  caloriesSource: point.caloriesKcal !== undefined ? "power-estimate" : "unavailable",
                });
              }
              lastAcceptedTrackPointRef.current = newPoints.at(-1) ?? lastAcceptedTrackPointRef.current;
              // 更新最大同步時間戳
              lastBgSyncTsRef.current = Math.max(...newPoints.map((point) => point.timestamp));
            }
            
          }
          if (settings.supplyReminderEnabled && bgState && bgState.supplyReminderEnabled !== false) {
            const restoredIntervalAlerts: Partial<Record<SupplyIntervalKind, boolean>> = {
              "energy-time": bgState.intervalEnergyTimeReminderSent || false,
              "energy-distance": bgState.intervalEnergyDistanceReminderSent || false,
              "water-time": bgState.intervalWaterTimeReminderSent || false,
              "water-distance": bgState.intervalWaterDistanceReminderSent || false,
            };
            if (Object.values(restoredIntervalAlerts).some(Boolean)) {
              intervalSupplyAlertsRef.current = restoredIntervalAlerts;
              setIntervalSupplyAlerts(restoredIntervalAlerts);
              setTouchGuardEnabled(false);
            }
          }
        } catch (error) {
          reportRecoverableIssue('[AppState] 恢復背景數據失敗', error);
        }
      }
      appStateRef.current = nextState;
    });
    return () => { subscription.remove(); };
  }, [mapRideActive, dispatch, rideLocationTrackingMode, settings.supplyReminderEnabled, settings.ttsEnabled]);


  // ─── GPS 精度即時切換（騎乘中更改設定時自動重啟背景追蹤）────────────────────────────
  const prevGpsAccuracyRef = useRef<GpsAccuracyLevel>(settings.gpsAccuracy || "standard");
  useEffect(() => {
    const currentAccuracy: GpsAccuracyLevel = settings.gpsAccuracy || "standard";
    if (mapRideActive && currentAccuracy !== prevGpsAccuracyRef.current) {
      prevGpsAccuracyRef.current = currentAccuracy;
      (async () => {
        await stopBackgroundLocationTracking();
        await startBackgroundLocationTracking(currentAccuracy);
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
          }
        } else if (pct > 30 && batteryDegradedRef.current) {
          // 電量恢復超過 30%，自動回升為用戶原本設定的精度
          batteryDegradedRef.current = false;
          const userAccuracy: GpsAccuracyLevel = settings.gpsAccuracy || "standard";
          await stopBackgroundLocationTracking();
          await startBackgroundLocationTracking(userAccuracy);
          Alert.alert("電量已恢復", `電量已回升至 ${pct}%，已自動恢復背景 GPS 為「${userAccuracy === "power_saving" ? "省電" : userAccuracy === "standard" ? "標準" : "高精度"}」模式。`);
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
    return calculateKilometerMarkers(gpxRoute);
  }, [gpxRoute]);

  const avgSpeed = useMemo(() => {
    if (state.elapsed < 5 || state.distance < 10) return 0;
    return (state.distance / 1000) / (state.elapsed / 3600);
  }, [state.elapsed, state.distance]);

  const sportSpeedKmh = useMemo(() => {
    if (state.sportType === "cycling" || state.route.length === 0) return state.currentSpeed;
    return smoothSpeedKmh(state.route.slice(-12).map((point) => ({
      speedKmh: Math.max(0, (point.speed ?? 0) * 3.6),
      timestamp: point.timestamp,
    })));
  }, [state.currentSpeed, state.route, state.sportType]);
  const sportVam = useMemo(() => calculateVamMPerHour(state.route.slice(-20).map((point) => ({
    altitudeM: point.altitude,
    timestamp: point.timestamp,
  }))), [state.route]);
  const sportGapPace = useMemo(() => {
    const paceSeconds = sportSpeedKmh > 0 ? 3600 / sportSpeedKmh : 0;
    return calculateGapPaceSecPerKm(paceSeconds, currentGrade);
  }, [currentGrade, sportSpeedKmh]);
  const sportDashboardMetrics = useMemo(() => buildSportDashboardMetrics({
    sportType: state.sportType,
    speedKmh: sportSpeedKmh,
    averageSpeedKmh: avgSpeed,
    distanceM: state.distance,
    elapsedSec: state.elapsed,
    altitudeM: state.currentAltitude,
    totalAscentM: state.totalAscent,
    gradePct: currentGrade,
    gapPaceSecPerKm: sportGapPace,
    vamMPerHour: sportVam,
  }), [avgSpeed, currentGrade, sportGapPace, sportSpeedKmh, sportVam, state.currentAltitude, state.distance, state.elapsed, state.sportType, state.totalAscent]);

  const calorieWidth = calorieAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp" });
  const waterWidth = waterAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp" });

  const sweatCurrent = Math.round(state.sweatSinceLastRefill);
  const calorieTarget = Math.round(dashboardSupplyPlan.calorieTriggerKcal);
  const sweatTarget = Math.round(dashboardSupplyPlan.waterTriggerMl);
  const manualEnergyDashboard = !smartEnergySupplyEnabled
    ? settings.supplyEnergyTimeIntervalEnabled
      ? {
          label: "能量時間",
          value: `${formatDuration(Math.max(0, state.elapsed - (intervalSupplyTrackerRef.current["energy-time"] ?? 0)))} / ${settings.supplyEnergyTimeIntervalMinutes} 分鐘`,
        }
      : settings.supplyEnergyDistanceIntervalEnabled
        ? {
            label: "能量距離",
            value: `${Math.max(0, (state.distance / 1000) - (intervalSupplyTrackerRef.current["energy-distance"] ?? 0)).toFixed(1)} / ${settings.supplyEnergyDistanceIntervalKm} km`,
          }
        : null
    : null;
  const manualWaterDashboard = !smartWaterSupplyEnabled
    ? settings.supplyWaterTimeIntervalEnabled
      ? {
          label: "補水時間",
          value: `${formatDuration(Math.max(0, state.elapsed - (intervalSupplyTrackerRef.current["water-time"] ?? 0)))} / ${settings.supplyWaterTimeIntervalMinutes} 分鐘`,
        }
      : settings.supplyWaterDistanceIntervalEnabled
        ? {
            label: "補水距離",
            value: `${Math.max(0, (state.distance / 1000) - (intervalSupplyTrackerRef.current["water-distance"] ?? 0)).toFixed(1)} / ${settings.supplyWaterDistanceIntervalKm} km`,
          }
        : null
    : null;
  const waterProgress = sweatCurrent / sweatTarget;
  const waterBarColor = waterProgress < 0.5 ? "#4FC3F7" : waterProgress < 0.8 ? "#F59E0B" : "#EF4444";
  const smartCalorieRemainingSec = smartSupplyCountdownRemainingSec(smartSupplyCountdown, "calorie", state.elapsed);
  const smartWaterRemainingSec = smartSupplyCountdownRemainingSec(smartSupplyCountdown, "water", state.elapsed);
  const smartCalorieStatus = pendingCalorieRef.current || calorieAlert
    ? "請補給能量"
    : smartCalorieRemainingSec === null ? "計算中" : `下次 ${formatDuration(smartCalorieRemainingSec)}`;
  const smartWaterStatus = pendingWaterRef.current || waterAlert
    ? "請補給水分"
    : smartWaterRemainingSec === null ? "計算中" : `下次 ${formatDuration(smartWaterRemainingSec)}`;

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
        onMapRotateEnd={() => scheduleAutoRecenter()}
      />

      {pinSelectMode && (
        <View style={[styles.pinAddressOverlay, { top: insets.top + 10 }]}>
          <View style={styles.pinAddressBar}>
            <TextInput
              value={pinAddress}
              onChangeText={(value) => {
                setPinAddress(value);
                setPinAddressCandidates([]);
                setPinAddressNotice(null);
              }}
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
          {pinAddressNotice && (
            <View style={styles.pinAddressNotice} accessibilityLiveRegion="polite">
              <Text style={styles.pinAddressNoticeText}>{pinAddressNotice}</Text>
            </View>
          )}
          {pinAddressCandidates.length > 1 && (
            <View style={styles.pinAddressResults}>
              <Text style={styles.pinAddressResultsTitle}>選擇目的地</Text>
              {pinAddressCandidates.map((candidate, index) => (
                <Pressable
                  key={`${candidate.latitude}-${candidate.longitude}`}
                  style={styles.pinAddressResultRow}
                  onPress={() => selectPinAddressDestination(candidate)}
                >
                  <Text style={styles.pinAddressResultTitle}>{candidate.label}</Text>
                  <Text style={styles.pinAddressResultMeta}>候選 {index + 1} · {candidate.latitude.toFixed(5)}, {candidate.longitude.toFixed(5)}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {!pinAddress.trim() && pinAddressCandidates.length === 0 && recentAddressSearches.length > 0 && (
            <View style={styles.pinAddressResults}>
              <Text style={styles.pinAddressResultsTitle}>最近搜尋</Text>
              {recentAddressSearches.slice(0, 3).map((item) => (
                <Pressable
                  key={`${item.label}-${item.latitude}-${item.longitude}`}
                  style={styles.pinAddressResultRow}
                  onPress={() => selectPinAddressDestination(item)}
                >
                  <Text style={styles.pinAddressResultTitle}>{item.label}</Text>
                  <Text style={styles.pinAddressResultMeta}>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</Text>
                </Pressable>
              ))}
            </View>
          )}
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
                setPinAddressCandidates([]);
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
            <Text style={styles.turnBannerTitle}>{navInstruction}</Text>
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
        style={[styles.panel, { height: panelAnim, paddingBottom: 0 }]}
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
          {state.sportType === "cycling"
            ? dashPanelFields.map((key) => (
              <DashMetric key={key} fieldKey={key} state={state} isActive={isActive} currentGrade={currentGrade} avgSpeed={avgSpeed} columnCount={dashboardColumnCount} />
            ))
            : sportDashboardMetrics.map((metric) => (
              <View key={metric.label} style={[styles.sportMetric, { width: dashboardCellWidth, minHeight: dashboardCellMinHeight }]}>
                <Text style={styles.sportMetricLabel}>{metric.label}</Text>
                <View style={styles.sportMetricValueRow}>
                  <Text style={styles.sportMetricValue}>{metric.value}</Text>
                  {metric.unit ? <Text style={styles.sportMetricUnit}>{metric.unit}</Text> : null}
                </View>
              </View>
            ))}
        </View>

        {/* ── 展開後：不重複的摘要 + 補給進度條 ── */}
        {panelExpanded && (
          <View style={styles.expandedSection}>
            {/* 超出6格的儀表板欄位（上拉展開後顯示） */}
            {dashOverflowFields.length > 0 && (
              <View style={[styles.sixGrid, { marginBottom: 8 /* internal spacing */ }]}>
                {dashOverflowFields.map((key) => (
                  <DashMetric key={key} fieldKey={key} state={state} isActive={isActive} currentGrade={currentGrade} avgSpeed={avgSpeed} columnCount={dashboardColumnCount} />
                ))}
              </View>
            )}
            {/* 摘要列只補上主儀表板未呈現的獨立指標；總爬升僅保留一處。 */}
            <View style={styles.ascentRow}>
              {dashboardSummaryKeys.map((metric, index) => (
                <React.Fragment key={metric}>
                  <DashboardSummaryMetric
                    metric={metric}
                    state={state}
                    isActive={isActive}
                    currentGrade={currentGrade}
                    avgSpeed={avgSpeed}
                  />
                  {index < dashboardSummaryKeys.length - 1 ? <View style={styles.ascentDivider} /> : null}
                </React.Fragment>
              ))}
            </View>
            {/* 卡路里進度條 */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <IconSymbol name="flame.fill" size={13} color="#F59E0B" />
                  <Text style={styles.progressLabel}>{smartEnergySupplyEnabled ? "能量倒數" : manualEnergyDashboard?.label ?? "卡路里"}</Text>
                </View>
                <Text style={styles.progressValue}>
                  {smartEnergySupplyEnabled
                    ? smartCalorieStatus
                    : manualEnergyDashboard
                      ? manualEnergyDashboard.value
                    : `${Math.round(state.calories)} / ${calorieTarget} kcal`}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: calorieWidth, backgroundColor: "#F59E0B" }]} />
              </View>
            </View>

            {/* 自訂補給品進度條 */}
            {settings.supplyReminderEnabled && settings.supplyItems.filter(s => s.enabled).map(item => {
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
                  <Text style={styles.progressLabel}>{smartWaterSupplyEnabled ? "補水倒數" : manualWaterDashboard?.label ?? "水分流失"}</Text>
                  {sweatRateLabel && (
                    <View style={[styles.ratePill, { backgroundColor: waterBarColor + "30" }]}>
                      <Text style={[styles.rateText, { color: waterBarColor }]}>{sweatRateLabel}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.progressValue}>
                  {smartWaterSupplyEnabled
                    ? smartWaterStatus
                    : manualWaterDashboard
                      ? manualWaterDashboard.value
                    : `${sweatCurrent} / ${sweatTarget} ml`}
                </Text>
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
            <View style={styles.preRideControls}>
                <Pressable
                  accessibilityLabel="選擇運動類型"
                  style={({ pressed }) => [
                    styles.sportInlineTrigger,
                    { borderColor: SPORT_META[state.sportType].accent, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => setSportPickerVisible(true)}
                >
                  <Text style={styles.sportInlineIcon}>{SPORT_META[state.sportType].icon}</Text>
                  <Text style={styles.sportInlineLabel}>{SPORT_META[state.sportType].label}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.startBtn, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={handleStart}
                >
                  <IconSymbol name="play.fill" size={20} color="#fff" />
                  <Text style={styles.startBtnText}>開始</Text>
                </Pressable>
            </View>
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

      <Modal
        visible={sportPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSportPickerVisible(false)}
      >
        <View style={styles.sportPickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSportPickerVisible(false)} />
          <View style={[styles.sportPickerSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sportPickerHandle} />
            <View style={styles.sportPickerHeader}>
              <Text style={styles.sportPickerTitle}>選擇運動</Text>
              <Pressable accessibilityLabel="關閉運動選擇" onPress={() => setSportPickerVisible(false)} style={styles.sportPickerClose}>
                <IconSymbol name="xmark" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={styles.sportPickerSearch}>
              <IconSymbol name="magnifyingglass" size={20} color="rgba(255,255,255,0.55)" />
              <TextInput
                value={sportPickerQuery}
                onChangeText={setSportPickerQuery}
                placeholder="搜尋運動"
                placeholderTextColor="rgba(255,255,255,0.42)"
                style={styles.sportPickerSearchInput}
                returnKeyType="done"
              />
            </View>
            <Text style={styles.sportPickerSectionTitle}>你的運動</Text>
            {sportPickerOptions.map((sportType) => {
              const meta = SPORT_META[sportType];
              const selected = state.sportType === sportType;
              return (
                <Pressable
                  key={sportType}
                  accessibilityLabel={`選擇${meta.label}`}
                  style={styles.sportPickerRow}
                  onPress={() => {
                    setSportType(sportType);
                    setSportPickerQuery("");
                    setSportPickerVisible(false);
                  }}
                >
                  <View style={[styles.sportPickerIcon, { backgroundColor: selected ? `${meta.accent}2A` : "rgba(255,255,255,0.09)" }]}>
                    <Text style={styles.sportPickerIconText}>{meta.icon}</Text>
                  </View>
                  <Text style={[styles.sportPickerRowLabel, selected && { color: meta.accent }]}>{meta.label}</Text>
                  {selected ? <Text style={[styles.sportPickerCheck, { color: meta.accent }]}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* ── 補給 Modal ── */}
      <SupplyModal
        calorieAlert={settings.supplyReminderEnabled && calorieAlert}
        waterAlert={settings.supplyReminderEnabled && waterAlert}
        customSupplyAlerts={[
          ...sortedActiveAlerts.map(id => {
            const item = settings.supplyItems.find(i => i.id === id);
            return {
              id,
              name: item?.name || 'Unknown',
              target: item?.target ?? "energy",
              onConfirm: () => handleConfirmCustomSupply(id, item?.triggerType || 'time'),
            };
          }),
          ...(intervalSupplyAlerts["energy-time"] ? [{
            id: "supply-interval-energy-time",
            name: `能量時間提醒（每 ${settings.supplyEnergyTimeIntervalMinutes} 分鐘）`,
            target: "energy" as const,
            onConfirm: () => handleConfirmIntervalSupply("energy-time"),
          }] : []),
          ...(intervalSupplyAlerts["energy-distance"] ? [{
            id: "supply-interval-energy-distance",
            name: `能量距離提醒（每 ${settings.supplyEnergyDistanceIntervalKm} km）`,
            target: "energy" as const,
            onConfirm: () => handleConfirmIntervalSupply("energy-distance"),
          }] : []),
          ...(intervalSupplyAlerts["water-time"] ? [{
            id: "supply-interval-water-time",
            name: `補水時間提醒（每 ${settings.supplyWaterTimeIntervalMinutes} 分鐘）`,
            target: "water" as const,
            onConfirm: () => handleConfirmIntervalSupply("water-time"),
          }] : []),
          ...(intervalSupplyAlerts["water-distance"] ? [{
            id: "supply-interval-water-distance",
            name: `補水距離提醒（每 ${settings.supplyWaterDistanceIntervalKm} km）`,
            target: "water" as const,
            onConfirm: () => handleConfirmIntervalSupply("water-distance"),
          }] : []),
        ]}
        onConfirmCalorie={handleConfirmCalorieSupply}
        onConfirmWater={handleConfirmWaterSupply}
        allowSnooze={(!calorieAlert || !smartEnergySupplyEnabled) && (!waterAlert || !smartWaterSupplyEnabled)}
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
            <Text style={styles.pinCardTitle}>{pinnedLocationLabel ?? "釘選位置"}</Text>
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
            <View style={styles.pinDataFreshnessRow}>
              <View style={styles.pinDataFreshnessTextWrap}>
                <Text style={styles.pinDataFreshness}>{formatNavigationDataFreshness(lastNavigationDataRefreshAt)}</Text>
                <Text style={styles.pinDataFreshnessNote}>道路施工與臨時封路未必即時反映，請以現場管制為準。</Text>
              </View>
              <Pressable style={styles.pinDataRefreshButton} onPress={handleRefreshPinMapData}>
                <Text style={styles.pinDataRefreshText}>更新圖資</Text>
              </Pressable>
            </View>
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
                  setLastNavigationDataRefreshAt(Date.now());
                  if (result) {
                    setPinRouteInfo({
                      distM: result.distanceM,
                      durSec: result.durationSec,
                      polyline: result.coordinates
                    });
                  } else {
                    setPinRouteInfo(null);
                    Alert.alert(
                      "找不到可通行路線",
                      "釘選位置可能位於封閉區、匝道、河川或無法通過的路口。請將圖釘移到可騎行道路後重新規劃。",
                    );
                  }
                }).catch(() => {
                  setPinRouteInfo(null);
                  Alert.alert("路徑規劃暫時不可用", "請確認網路後重試；系統會以最新道路資料重新規劃。");
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
          onPressIn={beginTouchGuardHoldProgress}
          onPressOut={resetTouchGuardHoldProgress}
          onLongPress={() => {
            completeTouchGuardUnlock();
          }}
          delayLongPress={settings.touchGuardUnlockHoldMs}
        >
          <Animated.View
            style={[
              styles.touchGuardCornerHint,
              { top: insets.top + 144, opacity: touchGuardHintOpacity, pointerEvents: "none" },
            ]}
          >
            <IconSymbol name="lock.fill" size={14} color="#9CFFB5" />
            <Text style={styles.touchGuardCornerText}>
              {`已鎖定 · 長按 ${touchGuardHoldLabel} 解除`}
            </Text>
          </Animated.View>
          {touchGuardHoldProgress > 0 && (
            <View style={[styles.touchGuardProgressRing, { top: insets.top + 56, pointerEvents: "none" }]}> 
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
          style={[
            styles.touchGuardUnlockSuccess,
            {
              top: insets.top + 56,
              opacity: touchGuardUnlockSuccessOpacity,
              pointerEvents: "none",
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
function DashMetric({ fieldKey, state, isActive, currentGrade, avgSpeed, columnCount }: {
  fieldKey: NormalFieldKey;
  state: any;
  isActive: boolean;
  currentGrade: number;
  avgSpeed: number;
  columnCount: 2 | 3;
}) {
  switch (fieldKey) {
    case "showElapsed":
      return <BigMetric label="騎乘時間" value={formatDuration(state.elapsed)} unit="" columnCount={columnCount} />;
    case "showSpeed":
      return <BigMetric label="速度" value={state.currentSpeed > 0 ? state.currentSpeed.toFixed(1) : "--"} unit="km/h" highlight columnCount={columnCount} />;
    case "showDistance":
      return <BigMetric label="距離" value={(state.distance / 1000).toFixed(2)} unit="km" columnCount={columnCount} />;
    case "showGrade":
      return <BigMetric label="坡度" value={isActive ? `${currentGrade > 0 ? "+" : ""}${currentGrade.toFixed(1)}` : "--"} unit="%" warn={currentGrade > 5} columnCount={columnCount} />;
    case "showPower":
      return <BigMetric label="功率" value={`${state.currentPower}`} unit="W" accent columnCount={columnCount} />;
    case "showAvgSpeed":
      return <BigMetric label="均速" value={avgSpeed > 0 ? avgSpeed.toFixed(1) : "--"} unit="km/h" columnCount={columnCount} />;
    case "showCalories":
      return <BigMetric label="卡路里" value={`${Math.round(state.totalCalories)}`} unit="kcal" columnCount={columnCount} />;
    case "showPausedTime":
      return <BigMetric label="暫停時間" value={formatDuration(state.totalPausedSec)} unit="" columnCount={columnCount} />;
    case "showTotalAscent":
      return <BigMetric label="總爬升" value={state.totalAscent ? state.totalAscent.toFixed(0) : "0"} unit="m" columnCount={columnCount} />;
    case "showCurrentAltitude":
      return <BigMetric label="目前海拔" value={state.currentAltitude ? state.currentAltitude.toFixed(0) : "--"} unit="m" columnCount={columnCount} />;
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

function DashboardSummaryMetric({ metric, state, isActive, currentGrade, avgSpeed }: {
  metric: NavigationDashboardSummaryKey;
  state: any;
  isActive: boolean;
  currentGrade: number;
  avgSpeed: number;
}) {
  if (metric === "grade") {
    const color = currentGrade > 8 ? "#EF4444" : currentGrade > 5 ? "#F59E0B" : "rgba(255,255,255,0.9)";
    return (
      <View style={styles.ascentItem}>
        <IconSymbol name="arrow.down" size={13} color="#4FC3F7" />
        <Text style={styles.ascentLabel}>坡度</Text>
        <Text style={[styles.ascentValue, { color }]}>{isActive ? `${currentGrade > 0 ? "+" : ""}${currentGrade.toFixed(1)}` : "--"}</Text>
        <Text style={styles.ascentUnit}>%</Text>
      </View>
    );
  }

  if (metric === "avgSpeed") {
    return (
      <View style={styles.ascentItem}>
        <IconSymbol name="speedometer" size={13} color="#A7D8FF" />
        <Text style={styles.ascentLabel}>均速</Text>
        <Text style={styles.ascentValue}>{avgSpeed > 0 ? avgSpeed.toFixed(1) : "--"}</Text>
        <Text style={styles.ascentUnit}>km/h</Text>
      </View>
    );
  }

  if (metric === "currentAltitude") {
    const altitude = Number.isFinite(state.currentAltitude) ? Math.round(state.currentAltitude) : "--";
    return (
      <View style={styles.ascentItem}>
        <IconSymbol name="arrow.up" size={13} color="#00C853" />
        <Text style={styles.ascentLabel}>目前海拔</Text>
        <Text style={styles.ascentValue}>{altitude}</Text>
        <Text style={styles.ascentUnit}>m</Text>
      </View>
    );
  }

  return (
    <View style={styles.ascentItem}>
      <IconSymbol name="bolt.fill" size={13} color="#00E676" />
      <Text style={styles.ascentLabel}>最大功率</Text>
      <Text style={[styles.ascentValue, { color: "#00E676" }]}>{state.maxPower}</Text>
      <Text style={styles.ascentUnit}>W</Text>
    </View>
  );
}

function BigMetric({ label, value, unit, accent, highlight, warn, wide, columnCount }: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  highlight?: boolean;
  warn?: boolean;
  wide?: boolean;
  columnCount: 2 | 3;
}) {
  const color = accent ? "#00E676" : highlight ? "#fff" : warn ? "#F59E0B" : "rgba(255,255,255,0.9)";
  const fontSize = highlight ? 32 : wide ? 26 : 22;
  return (
    <View style={[bigMetricStyles.cell, { width: `${100 / columnCount}%` }, wide && bigMetricStyles.wideCell]}>
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
    alignItems: "center",
    paddingVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(255,255,255,0.06)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  wideCell: {},
  label: { color: "rgba(255,255,255,0.76)", fontSize: 11, fontWeight: "700", lineHeight: 16, marginBottom: 3 /* internal spacing */, letterSpacing: 0.3, textAlign: "center" },
  valueRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "center", gap: 3 },
  value: { fontWeight: "700", fontVariant: ["tabular-nums"], textAlign: "center" },
  unit: { fontSize: 11, color: "rgba(255,255,255,0.72)", fontWeight: "600", textAlign: "center" },
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
    backgroundColor: "rgba(5,16,10,0.94)",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 8,
  gap: 8,
  },
  navText: { flex: 1, flexShrink: 1, color: "#fff", fontSize: 16, fontWeight: "800", lineHeight: 22 },
  navDist: { flexShrink: 1, color: "#7FFFC7", fontSize: 14, fontWeight: "800", lineHeight: 20 },

  toolBar: { position: "absolute", gap: 10, zIndex: 30 },
  pinAddressOverlay: {
    position: "absolute",
    left: 16,
    right: 76,
    zIndex: 40,
  },
  pinAddressBar: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
  paddingRight: 6,
  borderRadius: 14,
    backgroundColor: "rgba(7,18,11,0.98)",
  borderWidth: 1,
    borderColor: "rgba(255,255,255,0.56)",
  },
  pinAddressInput: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "600", minHeight: 44 },
  pinAddressSearchButton: {
    minWidth: 58,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  borderRadius: 10,
  marginVertical: 4,
    backgroundColor: "#087B5A",
  },
  pinAddressSearchButtonDisabled: { opacity: 0.58 },
  pinAddressSearchText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  pinAddressNotice: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,190,92,0.58)",
    backgroundColor: "rgba(61,42,13,0.94)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pinAddressNoticeText: { color: "#FFE3AA", fontSize: 13, fontWeight: "700", lineHeight: 19 },
  pinAddressResults: {
  marginTop: 8,
  overflow: "hidden",
  borderRadius: 14,
    backgroundColor: "rgba(7,18,11,0.98)",
  borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
  },
  pinAddressResultsTitle: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 7,
    color: "#34C759",
    fontSize: 12,
    fontWeight: "800",
  },
  pinAddressResultRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  pinAddressResultTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  pinAddressResultMeta: { marginTop: 4, color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: "600" },
  toolBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.32)",
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
  touchGuardProgressLabel: { position: "absolute", top: 29, color: "rgba(255,255,255,0.9)", fontSize: 9, fontWeight: "800" },
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
    boxShadow: "0px 0px 10px rgba(52, 197, 89, 0.42)",
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
  noRouteText: { color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "600" },

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
    boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.30)",
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
  straightBannerDist: { color: "rgba(255,255,255,0.86)", fontSize: 12, fontWeight: "600" },

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
    boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.24)",
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
    backgroundColor: "rgba(7, 17, 11, 0.97)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.42)",
    overflow: "hidden",
  },
  handleArea: {
    alignItems: "center",
    paddingBottom: 8 /* internal spacing */, // 內部間距，不需要動態計算
  },
  panelHandle: {
    width: 36, height: 4,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 2,
    marginBottom: 6 /* internal spacing */,
  },
  weatherRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 2 /* internal spacing */,
  },
  weatherItem: { color: "rgba(255,255,255,0.94)", fontSize: 13, fontWeight: "700" },
  weatherSep: { color: "rgba(255,255,255,0.78)", fontSize: 13 },
  pausedBadge: {
    backgroundColor: "rgba(245,158,11,0.2)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  pausedText: { color: "#FFD27D", fontSize: 12, fontWeight: "800" },

  // 六格儀表板
  sixGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.16)",
    marginTop: 2,
  },
  sportSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  sportChoice: {
    flex: 1,
    minWidth: "22%",
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  sportChoiceIcon: { fontSize: 17 },
  sportChoiceLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", lineHeight: 17, textAlign: "center" },
  preRideControls: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 },
  sportInlineTrigger: {
    minWidth: 88,
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: "rgba(15,15,23,0.9)",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  sportInlineIcon: { fontSize: 18 },
  sportInlineLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", lineHeight: 17, textAlign: "center" },
  sportPickerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.56)" },
  sportPickerSheet: {
    backgroundColor: "#151515",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 24,
    minHeight: "62%",
  },
  sportPickerHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.38)", marginBottom: 22 },
  sportPickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  sportPickerTitle: { color: "#FFFFFF", fontSize: 25, fontWeight: "800" },
  sportPickerClose: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" },
  sportPickerSearch: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#3B3B3D", borderRadius: 18, paddingHorizontal: 16, height: 54 },
  sportPickerSearchInput: { flex: 1, color: "#FFFFFF", fontSize: 17, paddingVertical: 0 },
  sportPickerSectionTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "800", marginTop: 28, marginBottom: 10 },
  sportPickerRow: { flexDirection: "row", alignItems: "center", minHeight: 68, gap: 14 },
  sportPickerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sportPickerIconText: { fontSize: 24 },
  sportPickerRowLabel: { flex: 1, color: "#F5F5F5", fontSize: 18, fontWeight: "700" },
  sportPickerCheck: { fontSize: 28, fontWeight: "900" },
  sportMetric: {
    width: "33.333%",
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 4,
  },
  sportMetricLabel: { color: "rgba(255,255,255,0.84)", fontSize: 12, fontWeight: "800", lineHeight: 17, textAlign: "center" },
  sportMetricValueRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "center", marginTop: 6 },
  sportMetricValue: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: -0.7, textAlign: "center" },
  sportMetricUnit: { color: "rgba(255,255,255,0.8)", fontSize: 11, marginLeft: 3, fontWeight: "600", textAlign: "center" },

  // 展開區域
  expandedSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
    marginTop: 4,
  },
  progressSection: {},
  progressHeader: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 4 /* internal spacing */ },
  progressLabelRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 },
  progressLabel: { color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "600", lineHeight: 18 },
  progressValue: { color: "rgba(255,255,255,0.94)", fontSize: 12, fontWeight: "700", lineHeight: 18, textAlign: "right" },
  progressTrack: { height: 5, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  ratePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  rateText: { fontSize: 10, fontWeight: "600" },

  // 控制按鈕
  btnRow: { alignItems: "center", marginTop: 12, marginBottom: 8 /* internal spacing */ },
  activeButtons: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 32,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: "#00C853",
    justifyContent: "center",
  },
  stopBtn: { backgroundColor: "#FF3B30" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "700", lineHeight: 23, letterSpacing: 0.5 },
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
  expandHintText: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "600" },

  // 總爬升資訊列
  ascentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 12 /* internal spacing */,
  },
  ascentItem: {
    flex: 1,
    minWidth: 96,
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
  ascentLabel: { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "600", lineHeight: 16, textAlign: "center" },
  ascentValue: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "700", lineHeight: 20, textAlign: "center" },
  ascentUnit: { color: "rgba(255,255,255,0.74)", fontSize: 11, fontWeight: "600", lineHeight: 16, textAlign: "center" },
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
  pinDataFreshnessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.14)",
  },
  pinDataFreshnessTextWrap: { flex: 1 },
  pinDataFreshness: { color: "#75C8FF", fontSize: 11, fontWeight: "700" },
  pinDataFreshnessNote: { marginTop: 3, color: "rgba(255,255,255,0.55)", fontSize: 10, lineHeight: 14 },
  pinDataRefreshButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.7)",
    backgroundColor: "rgba(0,122,255,0.16)",
  },
  pinDataRefreshText: { color: "#75C8FF", fontSize: 11, fontWeight: "800" },
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
