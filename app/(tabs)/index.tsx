import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import { useKeepAwake } from "expo-keep-awake";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SupplyModal } from "@/components/supply-modal";
import { RideSummaryModal } from "@/components/ride-summary-modal";
import { useColors } from "@/hooks/use-colors";
import { useRide } from "@/lib/ride-context";
import { useSettings } from "@/lib/settings-context";
import {
  calculatePower,
  calculateCalories,
  calcGrade,
  haversineDistance,
  formatDuration,
} from "@/lib/power-calc";
import { fetchWeather, getHeadwindMs, type WeatherData } from "@/lib/weather-service";
import {
  vibrateWarning,
  vibrateSuccess,
  vibrateMedium,
  speakSupplyReminder,
  speakAutoPause,
  speakAutoResume,
  showSupplyNotification,
  showRidingNotification,
  cancelRidingNotification,
  requestNotificationPermission,
} from "@/lib/feedback-service";
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from "@/lib/background-location";

const AUTO_PAUSE_THRESHOLD = 2; // km/h 以下自動暫停
const WEATHER_INTERVAL = 5 * 60 * 1000; // 5 分鐘更新一次天氣

export default function RideScreen() {
  const colors = useColors();
  const { state, dispatch, saveRecord } = useRide();
  const { settings } = useSettings();

  // Keep screen awake during ride
  useKeepAwake();

  // Audio player for supply alert sound
  const alertPlayer = useAudioPlayer(
    require("../../assets/sounds/alert.mp3")
  );

  // Local state
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [supplyModal, setSupplyModal] = useState<{ visible: boolean; type: "calorie" | "water" }>({
    visible: false,
    type: "calorie",
  });
  const [showSummary, setShowSummary] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Refs
  const locationSubscriber = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const weatherTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);
  const headingRef = useRef<number>(0);
  const windDataRef = useRef<{ speed: number; direction: number }>({ speed: 0, direction: 0 });
  const calorieReminderSentRef = useRef<boolean>(false);
  const waterReminderSentRef = useRef<boolean>(false);
  const notifPermRef = useRef<boolean>(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Animated values for progress bars
  const calorieAnim = useRef(new Animated.Value(0)).current;
  const waterAnim = useRef(new Animated.Value(0)).current;

  const isRiding = state.status === "active";
  const isPaused = state.status === "paused";
  const isActive = isRiding || isPaused;

  // ─── Audio Setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      alertPlayer.release();
    };
  }, []);

  // ─── 請求權限 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("需要位置權限才能追蹤騎乘");
      }
      notifPermRef.current = await requestNotificationPermission();
    })();
  }, []);

  // ─── 計時器 ──────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - pausedElapsedRef.current * 1000;
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      dispatch({ type: "TICK", elapsed });
    }, 1000);
  }, [dispatch]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ─── 天氣更新 ────────────────────────────────────────────────────────────────
  const updateWeather = useCallback(async (lat: number, lon: number) => {
    const w = await fetchWeather(lat, lon);
    if (w) {
      setWeather(w);
      windDataRef.current = { speed: w.windSpeed / 3.6, direction: w.windDirection };
    }
  }, []);

  // ─── 補給提醒 ────────────────────────────────────────────────────────────────
  const triggerSupplyReminder = useCallback(
    async (type: "calorie" | "water") => {
      setSupplyModal({ visible: true, type });
      if (settings.vibrationEnabled) vibrateWarning();
      if (settings.ttsEnabled) speakSupplyReminder(type, true);
      if (settings.soundEnabled) {
        try {
          alertPlayer.seekTo(0);
          alertPlayer.play();
        } catch {}
      }
      if (settings.notificationEnabled) showSupplyNotification(type);
    },
    [settings, alertPlayer]
  );

  // ─── GPS 訂閱 ────────────────────────────────────────────────────────────────
  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return;

    locationSubscriber.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      (location) => {
        const { latitude, longitude, altitude, speed, heading } = location.coords;
        if (heading !== null) headingRef.current = heading;

        const speedKmh = (speed ?? 0) * 3.6;
        const currentState = stateRef.current;

        // 自動暫停/恢復
        if (currentState.status === "active" && speedKmh < AUTO_PAUSE_THRESHOLD) {
          dispatch({ type: "PAUSE" });
          stopTimer();
          pausedElapsedRef.current = currentState.elapsed;
          if (settings.ttsEnabled) speakAutoPause(true);
          if (settings.vibrationEnabled) vibrateMedium();
          return;
        } else if (currentState.status === "paused" && speedKmh >= AUTO_PAUSE_THRESHOLD) {
          dispatch({ type: "RESUME" });
          startTimer();
          if (settings.ttsEnabled) speakAutoResume(true);
          return;
        }

        if (currentState.status !== "active") return;

        // 計算坡度
        let grade = 0;
        let ascent = 0;
        if (lastLocationRef.current) {
          const dist = haversineDistance(
            lastLocationRef.current.coords.latitude,
            lastLocationRef.current.coords.longitude,
            latitude,
            longitude
          );
          const altDiff = (altitude ?? 0) - (lastLocationRef.current.coords.altitude ?? 0);
          grade = calcGrade(altDiff, dist);
          ascent = Math.max(0, altDiff);
        }
        lastLocationRef.current = location;

        // 計算逆風
        const headwindMs = getHeadwindMs(
          headingRef.current,
          windDataRef.current.direction,
          windDataRef.current.speed * 3.6
        );

        // 計算功率
        const power = calculatePower({
          speedMs: speed ?? 0,
          gradePct: grade,
          windSpeedMs: headwindMs,
          riderMassKg: settings.weight,
        });

        // 計算卡路里（3秒間隔）
        const calIncrement = calculateCalories(power, 3);

        dispatch({
          type: "LOCATION_UPDATE",
          point: { latitude, longitude, altitude: altitude ?? 0, speed: speed ?? 0, timestamp: Date.now() },
          power,
          calories: calIncrement,
          ascent,
        });

        // 更新進度條動畫
        const newCalories = currentState.calories + calIncrement;
        const calPct = Math.min(1, newCalories / settings.calorieThreshold);
        const waterPct = Math.min(1, currentState.elapsed / (settings.waterThreshold * 6));

        Animated.timing(calorieAnim, {
          toValue: calPct,
          duration: 500,
          useNativeDriver: false,
        }).start();
        Animated.timing(waterAnim, {
          toValue: waterPct,
          duration: 500,
          useNativeDriver: false,
        }).start();

        // 補給提醒觸發
        if (calPct >= 1 && !calorieReminderSentRef.current) {
          calorieReminderSentRef.current = true;
          triggerSupplyReminder("calorie");
        }
        if (waterPct >= 1 && !waterReminderSentRef.current) {
          waterReminderSentRef.current = true;
          triggerSupplyReminder("water");
        }

        // 更新前台通知（每 30 秒）
        if (
          notifPermRef.current &&
          settings.notificationEnabled &&
          currentState.elapsed % 30 === 0
        ) {
          showRidingNotification(speedKmh, currentState.distance, currentState.elapsed);
        }
      }
    );

    // 嘗試啟動背景追蹤
    await startBackgroundLocationTracking();
  }, [settings, dispatch, startTimer, stopTimer, triggerSupplyReminder, calorieAnim, waterAnim]);

  const stopLocationTracking = useCallback(async () => {
    locationSubscriber.current?.remove();
    locationSubscriber.current = null;
    await stopBackgroundLocationTracking();
  }, []);

  // ─── 騎乘控制 ────────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    dispatch({ type: "START" });
    pausedElapsedRef.current = 0;
    calorieReminderSentRef.current = false;
    waterReminderSentRef.current = false;
    calorieAnim.setValue(0);
    waterAnim.setValue(0);
    lastLocationRef.current = null;
    startTimer();
    await startLocationTracking();
    // 取得初始天氣
    const loc = await Location.getLastKnownPositionAsync();
    if (loc) updateWeather(loc.coords.latitude, loc.coords.longitude);
    // 定時更新天氣
    weatherTimerRef.current = setInterval(async () => {
      const l = await Location.getLastKnownPositionAsync();
      if (l) updateWeather(l.coords.latitude, l.coords.longitude);
    }, WEATHER_INTERVAL);
  }, [dispatch, startTimer, startLocationTracking, updateWeather, calorieAnim, waterAnim]);

  const handlePause = useCallback(() => {
    dispatch({ type: "PAUSE" });
    pausedElapsedRef.current = state.elapsed;
    stopTimer();
  }, [dispatch, state.elapsed, stopTimer]);

  const handleResume = useCallback(() => {
    dispatch({ type: "RESUME" });
    startTimer();
  }, [dispatch, startTimer]);

  const handleStop = useCallback(async () => {
    dispatch({ type: "STOP" });
    stopTimer();
    await stopLocationTracking();
    if (weatherTimerRef.current) clearInterval(weatherTimerRef.current);
    await cancelRidingNotification();
    await saveRecord();
    setShowSummary(true);
    if (settings.vibrationEnabled) vibrateSuccess();
  }, [dispatch, stopTimer, stopLocationTracking, saveRecord, settings.vibrationEnabled]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopTimer();
      stopLocationTracking();
      if (weatherTimerRef.current) clearInterval(weatherTimerRef.current);
    };
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────
  const speedColor = state.currentSpeed > 30 ? colors.accent
    : state.currentSpeed > 15 ? colors.foreground
    : colors.muted;

  const calorieWidth = calorieAnim.interpolate({
    inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp",
  });
  const waterWidth = waterAnim.interpolate({
    inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp",
  });

  const calCurrent = Math.round(state.calories);
  const waterMinutes = Math.round(state.elapsed / 60);
  const waterTarget = Math.round(settings.waterThreshold / 10);

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 天氣列 ── */}
        <View style={[styles.weatherRow, { borderBottomColor: colors.border }]}>
          {weather ? (
            <>
              <WeatherItem icon="thermometer" value={`${weather.temperature}°C`} color={colors.muted} />
              <WeatherItem icon="wind" value={`${weather.windSpeed} km/h`} color={colors.muted} />
              <WeatherItem icon="drop.fill" value={`${weather.precipitationProb}%`} color="#4FC3F7" />
              <Text style={[styles.weatherDesc, { color: colors.muted }]}>{weather.description}</Text>
            </>
          ) : (
            <Text style={[styles.weatherDesc, { color: colors.muted }]}>
              {locationError ?? "等待天氣資料..."}
            </Text>
          )}
        </View>

        {/* ── 主速度顯示 ── */}
        <View style={styles.speedSection}>
          <Text style={[styles.speedValue, { color: speedColor }]}>
            {state.currentSpeed.toFixed(1)}
          </Text>
          <Text style={[styles.speedUnit, { color: colors.muted }]}>km/h</Text>
          {isPaused && (
            <View style={[styles.pauseBadge, { backgroundColor: colors.warning + "20" }]}>
              <Text style={[styles.pauseText, { color: colors.warning }]}>⏸ 已暫停</Text>
            </View>
          )}
        </View>

        {/* ── 數據格 ── */}
        <View style={[styles.metricsGrid, { borderColor: colors.border }]}>
          <MetricCell label="功率" value={`${state.currentPower}`} unit="W" color={colors.accent} colors={colors} />
          <MetricCell label="距離" value={(state.distance / 1000).toFixed(2)} unit="km" color={colors.foreground} colors={colors} />
          <MetricCell label="時間" value={formatDuration(state.elapsed)} unit="" color={colors.foreground} colors={colors} />
          <MetricCell label="爬升" value={`${Math.round(state.totalAscent)}`} unit="m" color={colors.foreground} colors={colors} />
          <MetricCell
            label="均速"
            value={state.elapsed > 0 ? ((state.distance / 1000) / (state.elapsed / 3600)).toFixed(1) : "0.0"}
            unit="km/h"
            color={colors.foreground}
            colors={colors}
          />
          <MetricCell label="均功率" value={`${state.avgPower}`} unit="W" color={colors.accent} colors={colors} />
        </View>

        {/* ── 進度條 ── */}
        <View style={styles.progressSection}>
          <ProgressBar
            label="卡路里"
            icon="flame.fill"
            iconColor={colors.warning}
            width={calorieWidth}
            current={calCurrent}
            target={settings.calorieThreshold}
            unit="kcal"
            colors={colors}
          />
          <View style={{ height: 14 }} />
          <ProgressBar
            label="水分計時"
            icon="drop.fill"
            iconColor="#4FC3F7"
            width={waterWidth}
            current={waterMinutes}
            target={waterTarget}
            unit="min"
            colors={colors}
          />
        </View>

        {/* ── 控制按鈕 ── */}
        <View style={styles.controlRow}>
          {!isActive ? (
            <Pressable
              style={({ pressed }) => [
                styles.startBtn,
                { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleStart}
            >
              <IconSymbol name="play.fill" size={28} color="#FFFFFF" />
              <Text style={styles.startBtnText}>開始騎乘</Text>
            </Pressable>
          ) : (
            <>
              {isRiding ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.controlBtn,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={handlePause}
                >
                  <IconSymbol name="pause.fill" size={24} color={colors.foreground} />
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.controlBtn,
                    { borderColor: colors.accent, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={handleResume}
                >
                  <IconSymbol name="play.fill" size={24} color={colors.accent} />
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.stopBtn,
                  { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={handleStop}
              >
                <IconSymbol name="stop.fill" size={24} color={colors.error} />
                <Text style={[styles.stopBtnText, { color: colors.error }]}>結束</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── 補給 Modal ── */}
      <SupplyModal
        visible={supplyModal.visible}
        type={supplyModal.type}
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
    </ScreenContainer>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeatherItem({ icon, value, color }: { icon: string; value: string; color: string }) {
  return (
    <View style={styles.weatherItem}>
      <IconSymbol name={icon as any} size={14} color={color} />
      <Text style={[styles.weatherValue, { color }]}>{value}</Text>
    </View>
  );
}

function MetricCell({
  label, value, unit, color, colors,
}: {
  label: string; value: string; unit: string; color: string; colors: any;
}) {
  return (
    <View style={[styles.metricCell, { borderColor: colors.border }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricUnit, { color: colors.muted }]}>{unit}</Text>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function ProgressBar({
  label, icon, iconColor, width, current, target, unit, colors,
}: {
  label: string; icon: string; iconColor: string;
  width: Animated.AnimatedInterpolation<string | number>;
  current: number; target: number; unit: string; colors: any;
}) {
  return (
    <View>
      <View style={styles.progressHeader}>
        <View style={styles.progressLabelRow}>
          <IconSymbol name={icon as any} size={14} color={iconColor} />
          <Text style={[styles.progressLabel, { color: colors.muted }]}>{label}</Text>
        </View>
        <Text style={[styles.progressValue, { color: colors.foreground }]}>
          {current} / {target} {unit}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.progressFill, { width, backgroundColor: iconColor }]} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 24 },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  weatherItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  weatherValue: { fontSize: 12, fontWeight: "500" },
  weatherDesc: { fontSize: 12, marginLeft: "auto" },
  speedSection: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 20 },
  speedValue: { fontSize: 88, fontWeight: "200", letterSpacing: -4, lineHeight: 96 },
  speedUnit: { fontSize: 18, fontWeight: "300", marginTop: 4 },
  pauseBadge: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  pauseText: { fontSize: 13, fontWeight: "600" },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  metricCell: {
    width: "33.33%",
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  metricValue: { fontSize: 22, fontWeight: "600", letterSpacing: -0.5 },
  metricUnit: { fontSize: 11, marginTop: 1 },
  metricLabel: { fontSize: 11, marginTop: 2 },
  progressSection: { marginHorizontal: 20, marginTop: 20 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  progressLabel: { fontSize: 13, fontWeight: "500" },
  progressValue: { fontSize: 12, fontWeight: "500" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  controlRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    marginTop: 28,
    paddingHorizontal: 20,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 50,
  },
  startBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1.5,
  },
  stopBtnText: { fontSize: 15, fontWeight: "600" },
});
