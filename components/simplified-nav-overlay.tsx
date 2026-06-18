import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  StatusBar,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface SimplifiedNavOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  // 核心數據
  speed: number;           // km/h
  distance: number;        // km
  remainingDist?: number;  // km（導航中才有）
  direction?: string;      // 方向提示（如「左轉」「直行」）
  directionIcon?: string;  // SF Symbol 名稱
  currentTime: string;     // HH:MM
  elapsedTime: string;     // MM:SS 或 HH:MM:SS
}

export function SimplifiedNavOverlay({
  visible,
  onDismiss,
  speed,
  distance,
  remainingDist,
  direction,
  directionIcon,
  currentTime,
  elapsedTime,
}: SimplifiedNavOverlayProps) {
  if (!visible) return null;

  return (
    <Pressable style={styles.overlay} onPress={onDismiss}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {/* 頂部：方向指引 */}
      {direction ? (
        <View style={styles.directionRow}>
          {directionIcon && (
            <IconSymbol name={directionIcon as any} size={36} color="#fff" />
          )}
          <Text style={styles.directionText}>{direction}</Text>
        </View>
      ) : (
        <View style={styles.directionRow}>
          <Text style={styles.directionPlaceholder}>騎乘中</Text>
        </View>
      )}

      {/* 剩餘距離 */}
      {remainingDist !== undefined && (
        <View style={styles.remainRow}>
          <Text style={styles.remainLabel}>剩餘</Text>
          <Text style={styles.remainValue}>
            {remainingDist < 1
              ? `${Math.round(remainingDist * 1000)} m`
              : `${remainingDist.toFixed(1)} km`}
          </Text>
        </View>
      )}

      {/* 主要數據：速度 */}
      <View style={styles.speedBlock}>
        <Text style={styles.speedValue}>{speed.toFixed(1)}</Text>
        <Text style={styles.speedUnit}>km/h</Text>
      </View>

      {/* 底部：距離 + 時間 + 當前時間 */}
      <View style={styles.bottomRow}>
        <View style={styles.bottomItem}>
          <Text style={styles.bottomValue}>{distance.toFixed(2)}</Text>
          <Text style={styles.bottomLabel}>公里</Text>
        </View>
        <View style={styles.bottomDivider} />
        <View style={styles.bottomItem}>
          <Text style={styles.bottomValue}>{elapsedTime}</Text>
          <Text style={styles.bottomLabel}>時間</Text>
        </View>
        <View style={styles.bottomDivider} />
        <View style={styles.bottomItem}>
          <Text style={styles.bottomValue}>{currentTime}</Text>
          <Text style={styles.bottomLabel}>現在</Text>
        </View>
      </View>

      {/* 提示文字 */}
      <Text style={styles.tapHint}>點擊任意處返回標準模式</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 48,
    paddingHorizontal: 32,
  },
  directionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  directionText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.5,
  },
  directionPlaceholder: {
    fontSize: 28,
    fontWeight: "300",
    color: "#888",
    letterSpacing: 2,
  },
  remainRow: {
    alignItems: "center",
    gap: 4,
  },
  remainLabel: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  remainValue: {
    fontSize: 40,
    fontWeight: "300",
    color: "#fff",
    letterSpacing: -1,
  },
  speedBlock: {
    alignItems: "center",
    gap: 0,
  },
  speedValue: {
    fontSize: 96,
    fontWeight: "200",
    color: "#fff",
    letterSpacing: -4,
    lineHeight: 100,
  },
  speedUnit: {
    fontSize: 18,
    fontWeight: "400",
    color: "#888",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-around",
  },
  bottomItem: {
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  bottomValue: {
    fontSize: 26,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: -0.5,
  },
  bottomLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  bottomDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#333",
  },
  tapHint: {
    fontSize: 12,
    color: "#555",
    letterSpacing: 0.5,
  },
});
