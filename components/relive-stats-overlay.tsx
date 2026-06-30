/**
 * 回放統計數據疊層
 * 
 * 在 relive 頁面左上角實時顯示軌跡基本數據
 * - 距離、時間、均速、最高速、爬升、卡路里
 * - 透明背景，只顯示數據，避免影響地圖判讀
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface ReliveStatsOverlayProps {
  distance: number; // km
  duration: number; // seconds
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  elevation: number; // meters
  calories: number; // kcal
}

export function ReliveStatsOverlay({
  distance,
  duration,
  avgSpeed,
  maxSpeed,
  elevation,
  calories,
}: ReliveStatsOverlayProps) {
  const colors = useColors();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      {/* 第一行：距離、時間 */}
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.value}>{distance.toFixed(2)}</Text>
          <Text style={styles.label}>km</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.value}>{formatDuration(duration)}</Text>
          <Text style={styles.label}>時間</Text>
        </View>
      </View>

      {/* 第二行：均速、最高速 */}
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.value}>{avgSpeed.toFixed(1)}</Text>
          <Text style={styles.label}>km/h</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.value}>{maxSpeed.toFixed(1)}</Text>
          <Text style={styles.label}>max</Text>
        </View>
      </View>

      {/* 第三行：爬升、卡路里 */}
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.value}>{elevation}</Text>
          <Text style={styles.label}>m</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.value}>{calories}</Text>
          <Text style={styles.label}>kcal</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 76,
    left: 16,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8 /* internal spacing */,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    lineHeight: 18,
  },
  label: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginHorizontal: 8,
  },
});
