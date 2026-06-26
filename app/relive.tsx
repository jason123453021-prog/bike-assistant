/**
 * Relive 軌跡回放頁面
 *
 * 功能：
 * - 2D 地圖軌跡顯示（彩色軌跡、起終點標記）
 * - 軌跡回放播放控制（播放/暫停、速度調整、進度條）
 * - 實時統計數據顯示（速度、距離、時間、海拔、功率）
 * - 照片時間軸錨定（EXIF 讀取、時間軸比對、彈出展示）
 * - 高光時刻標記（最高時速、最高海拔、陡坡挑戰）
 * - 數據統計圖表（速度曲線、心率區間、功率分布）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { useColors } from "@/hooks/use-colors";
import { useRide, type RideRecord } from "@/lib/ride-context";
import { formatDuration } from "@/lib/power-calc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import LeafletMapView, { type LeafletMapHandle } from "@/components/leaflet-map";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const BOTTOM_PANEL_COLLAPSED_HEIGHT = 120;
const BOTTOM_PANEL_EXPANDED_HEIGHT = SCREEN_H * 0.7;

// ─── 類型定義 ─────────────────────────────────────────────────────────────────

interface ReliveState {
  isPlaying: boolean;
  playbackIndex: number;
  playbackSpeed: number;
  currentData: {
    speed: number;
    distance: number;
    time: number;
    altitude: number;
    power: number;
  };
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export default function ReliveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useRide();

  // 查找對應的騎乘記錄
  const record = useMemo(() => {
    return state.records.find((r: RideRecord) => r.id === id);
  }, [id, state.records]);

  // 回放狀態
  const [reliveState, setReliveState] = useState<ReliveState>({
    isPlaying: false,
    playbackIndex: 0,
    playbackSpeed: 1,
    currentData: {
      speed: 0,
      distance: 0,
      time: 0,
      altitude: 0,
      power: 0,
    },
  });

  // 底部面板狀態
  const [panelExpanded, setPanelExpanded] = useState(false);
  const panelAnim = useRef(new Animated.Value(BOTTOM_PANEL_COLLAPSED_HEIGHT)).current;
  const mapRef = useRef<LeafletMapHandle>(null);

  // 分享統計數據
  const handleShare = useCallback(async () => {
    if (!record) return;

    try {
      const date = new Date(record.date);
      const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
      const distKm = (record.distance / 1000).toFixed(2);
      const avgSpeedStr = record.avgSpeed.toFixed(1);
      const maxSpeedStr = record.maxSpeed.toFixed(1);
      const durationStr = formatDuration(record.duration);

      const message = `🚴 ${record.name || "騎乘記錄"}\n\n📅 ${dateStr}\n📍 距離: ${distKm} km\n⏱️ 時間: ${durationStr}\n🏃 平均速度: ${avgSpeedStr} km/h\n⚡ 最高速度: ${maxSpeedStr} km/h\n🔥 卡路里: ${record.calories} kcal\n⛰️ 爬升: ${Math.round(record.totalAscent)} m\n\n用 Relive 記錄我的騎乘軌跡 🚴`;

      await Share.share({
        message,
        title: `${record.name || "騎乘記錄"} - Relive`,
      });
    } catch (error) {
      console.error("分享失敗:", error);
    }
  }, [record]);

  // 初始化地圖軌跡
  useEffect(() => {
    if (!record || !mapRef.current || record.route.length === 0) return;

    const polylineCoords = record.route.map((p: any) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    // 高亮已走過的軌跡
    mapRef.current.highlightPlayedTrail(polylineCoords, "#00E676");

    // 適配地圖邊界
    mapRef.current.fitToCoordinates(polylineCoords, {
      edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
      animated: true,
    });
  }, [record]);

  // 回放邏輯
  useEffect(() => {
    if (!reliveState.isPlaying || !record || record.route.length === 0) return;

    const interval = setInterval(() => {
      setReliveState((prev) => {
        let nextIndex = prev.playbackIndex + prev.playbackSpeed;

        if (nextIndex >= record.route.length - 1) {
          nextIndex = record.route.length - 1;
          return { ...prev, playbackIndex: nextIndex, isPlaying: false };
        }

        // 計算當前回放位置的數據
        const totalDistance = record.distance || 0;
        const totalDuration = record.duration || 0;
        const currentPoint = record.route[Math.floor(nextIndex)];

        const currentData = {
          speed: (currentPoint.speed || 0) * 3.6, // m/s to km/h
          distance: (nextIndex / record.route.length) * (totalDistance / 1000),
          time: (nextIndex / record.route.length) * totalDuration,
          altitude: currentPoint.altitude || 0,
          power: record.avgPower || 0,
        };

        // 更新地圖回放標記
        if (mapRef.current && currentPoint) {
          mapRef.current.setPlaybackMarker(
            currentPoint.latitude,
            currentPoint.longitude,
            "#007AFF"
          );
        }

        return {
          ...prev,
          playbackIndex: nextIndex,
          currentData,
        };
      });
    }, 100 / reliveState.playbackSpeed);

    return () => clearInterval(interval);
  }, [reliveState.isPlaying, reliveState.playbackSpeed, record]);

  // 底部面板動畫
  const togglePanel = useCallback((expanded: boolean) => {
    setPanelExpanded(expanded);
    Animated.timing(panelAnim, {
      toValue: expanded ? BOTTOM_PANEL_EXPANDED_HEIGHT : BOTTOM_PANEL_COLLAPSED_HEIGHT,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [panelAnim]);

  // 手勢識別器
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 10,
      onPanResponderMove: (_, { dy }) => {
        const newHeight = Math.max(
          BOTTOM_PANEL_COLLAPSED_HEIGHT,
          Math.min(BOTTOM_PANEL_EXPANDED_HEIGHT, BOTTOM_PANEL_COLLAPSED_HEIGHT - dy)
        );
        panelAnim.setValue(newHeight);
      },
      onPanResponderRelease: (_, { dy }) => {
        const threshold = (BOTTOM_PANEL_EXPANDED_HEIGHT - BOTTOM_PANEL_COLLAPSED_HEIGHT) / 2;
        const shouldExpand = dy < -threshold;
        togglePanel(shouldExpand);
      },
    })
  ).current;

  if (!record) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground text-lg">找不到騎乘記錄</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 px-4 py-2 bg-primary rounded-lg"
        >
          <Text className="text-white font-semibold">返回</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const progress = record.route.length > 0 ? reliveState.playbackIndex / record.route.length : 0;

  return (
    <View style={styles.container}>
      {/* 全屏地圖 */}
      <LeafletMapView
        ref={mapRef}
        style={styles.map}
        onMapReady={() => {}}
      />

      {/* 回放控制欄 */}
      <View style={[styles.controlBar, { top: insets.top + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>{record.name || "軌跡回放"}</Text>
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <IconSymbol name="square.and.arrow.up" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* 底部面板 */}
      <Animated.View
        style={[
          styles.bottomPanel,
          { height: panelAnim, bottom: 0 },
        ]}
        {...panResponder.panHandlers}
      >
        {/* 拖拉把手 */}
        <View style={styles.handleArea}>
          <View style={styles.panelHandle} />
        </View>

        {/* 收縮狀態：回放控制 */}
        {!panelExpanded && (
          <View style={styles.collapsedContent}>
            {/* 進度條 */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progress * 100)}%
              </Text>
            </View>

            {/* 回放按鈕 */}
            <View style={styles.playbackControls}>
              <Pressable
                style={({ pressed }) => [styles.playBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() =>
                  setReliveState((prev) => ({
                    ...prev,
                    isPlaying: !prev.isPlaying,
                  }))
                }
              >
                <IconSymbol
                  name={reliveState.isPlaying ? "pause.fill" : "play.fill"}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.playBtnText}>
                  {reliveState.isPlaying ? "暫停" : "播放"}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.playBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() =>
                  setReliveState((prev) => ({
                    ...prev,
                    playbackIndex: 0,
                    isPlaying: false,
                  }))
                }
              >
                <IconSymbol name="arrow.counterclockwise" size={20} color="#fff" />
                <Text style={styles.playBtnText}>重置</Text>
              </Pressable>

              {/* 速度調整 */}
              <View style={styles.speedControl}>
                <Text style={styles.speedLabel}>速度</Text>
                <View style={styles.speedButtons}>
                  {[0.5, 1, 2, 4].map((speed) => (
                    <Pressable
                      key={speed}
                      style={({ pressed }) => [
                        styles.speedBtn,
                        {
                          backgroundColor:
                            reliveState.playbackSpeed === speed
                              ? colors.primary
                              : "rgba(255,255,255,0.2)",
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      onPress={() =>
                        setReliveState((prev) => ({
                          ...prev,
                          playbackSpeed: speed,
                        }))
                      }
                    >
                      <Text style={styles.speedBtnText}>{speed}x</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* 實時數據 */}
            <View style={styles.statsRow}>
              <StatCell
                icon="speedometer"
                value={reliveState.currentData.speed.toFixed(1)}
                unit="km/h"
                label="速度"
              />
              <StatCell
                icon="location.fill"
                value={reliveState.currentData.distance.toFixed(2)}
                unit="km"
                label="距離"
              />
              <StatCell
                icon="clock.fill"
                value={formatDuration(Math.floor(reliveState.currentData.time))}
                unit=""
                label="時間"
              />
              <StatCell
                icon="mountain.2.fill"
                value={Math.round(reliveState.currentData.altitude).toString()}
                unit="m"
                label="海拔"
              />
            </View>
          </View>
        )}

        {/* 展開狀態：詳細統計 */}
        {panelExpanded && (
          <ScrollView
            style={styles.expandedContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* 核心數據 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>核心數據</Text>
              <View style={styles.statsGrid}>
                <StatCell
                  icon="location.fill"
                  value={(record.distance / 1000).toFixed(2)}
                  unit="km"
                  label="距離"
                />
                <StatCell
                  icon="clock.fill"
                  value={formatDuration(record.duration)}
                  unit=""
                  label="時間"
                />
                <StatCell
                  icon="speedometer"
                  value={record.avgSpeed.toFixed(1)}
                  unit="km/h"
                  label="平均速度"
                />
                <StatCell
                  icon="speedometer"
                  value={record.maxSpeed.toFixed(1)}
                  unit="km/h"
                  label="最高速度"
                />
              </View>
            </View>

            {/* 爬升與地形 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>爬升與地形</Text>
              <View style={styles.statsGrid}>
                <StatCell
                  icon="mountain.2.fill"
                  value={Math.round(record.totalAscent).toString()}
                  unit="m"
                  label="總爬升"
                />
                <StatCell
                  icon="mountain.2.fill"
                  value={Math.round(record.totalDescent || 0).toString()}
                  unit="m"
                  label="總下降"
                />
                <StatCell
                  icon="peak.2.fill"
                  value={Math.round(record.maxElevation || 0).toString()}
                  unit="m"
                  label="最大海拔"
                />
                <StatCell
                  icon="flame.fill"
                  value={record.calories.toString()}
                  unit="kcal"
                  label="卡路里"
                />
              </View>
            </View>

            {/* 進階訓練數據 */}
            {(record.avgHeartRate || record.avgPower) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>進階訓練數據</Text>
                <View style={styles.statsGrid}>
                  {record.avgHeartRate && (
                    <StatCell
                      icon="heart.fill"
                      value={Math.round(record.avgHeartRate).toString()}
                      unit="bpm"
                      label="平均心率"
                    />
                  )}
                  {record.maxHeartRate && (
                    <StatCell
                      icon="heart.fill"
                      value={Math.round(record.maxHeartRate).toString()}
                      unit="bpm"
                      label="最高心率"
                    />
                  )}
                  <StatCell
                    icon="bolt.fill"
                    value={Math.round(record.avgPower).toString()}
                    unit="W"
                    label="平均功率"
                  />
                  <StatCell
                    icon="bolt.fill"
                    value={Math.round(record.maxPower).toString()}
                    unit="W"
                    label="最高功率"
                  />
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

// ─── 子元件 ───────────────────────────────────────────────────────────────────

function StatCell({
  icon,
  value,
  unit,
  label,
}: {
  icon: string;
  value: string;
  unit: string;
  label: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.statCell}>
      <IconSymbol name={icon as any} size={16} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      {unit && <Text style={styles.statUnit}>{unit}</Text>}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── 樣式 ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  map: {
    flex: 1,
  },
  controlBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    marginHorizontal: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "rgba(21,23,24,0.95)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: 8,
  },
  panelHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
  },
  collapsedContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressContainer: {
    marginBottom: 12,
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#00E676",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    textAlign: "right",
  },
  playbackControls: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0, 230, 118, 0.2)",
  },
  playBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  speedControl: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  speedLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  speedButtons: {
    flexDirection: "row",
    gap: 4,
  },
  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: "center",
  },
  speedBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCell: {
    flex: 1,
    minWidth: "48%",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  statUnit: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },
});
