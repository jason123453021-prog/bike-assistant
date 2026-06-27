/**
 * 回放實時數據行
 * 
 * 在 relive 頁面地圖區域顯示實時騎乘數據
 * 格式：速度 x km/h | 距離 x 公里 | 坡度 x % | 瓦數 x W
 * - 半透明背景
 * - 自動適應寬度
 * - 坡度視覺反饋：顏色變化 + 等級標籤
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

/**
 * 獲取坡度等級和顏色
 * 
 * 坡度分級：
 * - 平坦: <= 2% (綠色)
 * - 溫和: 2% - 5% (黃色)
 * - 中等: 5% - 10% (橙色)
 * - 陡峭: 10% - 15% (紅色)
 * - 極陡: > 15% (深紅色)
 */
function getSlopeInfo(slope: number) {
  const absSlope = Math.abs(slope);
  
  if (absSlope <= 2) {
    return { label: '平坦', color: '#4CAF50', bgColor: 'rgba(76, 175, 80, 0.2)' }; // 綠色
  } else if (absSlope <= 5) {
    return { label: '溫和', color: '#FFC107', bgColor: 'rgba(255, 193, 7, 0.2)' }; // 黃色
  } else if (absSlope <= 10) {
    return { label: '中等', color: '#FF9800', bgColor: 'rgba(255, 152, 0, 0.2)' }; // 橙色
  } else if (absSlope <= 15) {
    return { label: '陡峭', color: '#F44336', bgColor: 'rgba(244, 67, 54, 0.2)' }; // 紅色
  } else {
    return { label: '極陡', color: '#C62828', bgColor: 'rgba(198, 40, 40, 0.2)' }; // 深紅色
  }
}

export function ReliveRealtimeStats({
  speed,
  distance,
  slope,
  power,
}: ReliveRealtimeStatsProps) {
  const colors = useColors();
  const slopeInfo = getSlopeInfo(slope);

  return (
    <View style={[styles.container, { borderLeftColor: slopeInfo.color, borderLeftWidth: 4 }]}>
      <View style={styles.content}>
        <Text style={styles.text}>
          速度 {speed.toFixed(1)} km/h | 距離 {distance.toFixed(2)} 公里 | 瓦數 {power.toFixed(0)} W
        </Text>
        <View style={styles.slopeRow}>
          <Text style={styles.slopeLabel}>坡度</Text>
          <Text style={[styles.slopeValue, { color: slopeInfo.color }]}>
            {slope.toFixed(1)}%
          </Text>
          <View style={[styles.slopeBadge, { backgroundColor: slopeInfo.bgColor }]}>
            <Text style={[styles.slopeBadgeText, { color: slopeInfo.color }]}>
              {slopeInfo.label}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 64, // 標題欄下方（緊貼標題）
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
  },
  content: {
    gap: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
    lineHeight: 16,
  },
  slopeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  slopeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ccc",
  },
  slopeValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  slopeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: "auto",
  },
  slopeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
