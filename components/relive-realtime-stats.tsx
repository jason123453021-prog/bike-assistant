/**
 * 回放實時數據行
 * 
 * 在 relive 頁面地圖區域顯示實時騎乘數據
 * 格式：速度 x km/h | 距離 x 公里 | 坡度 x % | 瓦數 x W
 * - 半透明背景
 * - 自動適應寬度
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface ReliveRealtimeStatsProps {
  speed: number; // km/h
  distance: number; // km
  slope: number; // %
  power: number; // W
}

export function ReliveRealtimeStats({
  speed,
  distance,
  slope,
  power,
}: ReliveRealtimeStatsProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        速度 {speed.toFixed(1)} km/h | 距離 {distance.toFixed(2)} 公里 | 坡度 {slope.toFixed(1)} % | 瓦數 {power.toFixed(0)} W
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 156, // ReliveStatsOverlay 下方（76 + ~80）
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
    lineHeight: 16,
  },
});
