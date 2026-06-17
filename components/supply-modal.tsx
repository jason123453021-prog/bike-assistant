import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export interface SupplyModalProps {
  visible: boolean;
  type: "calorie" | "water";
  /** 建議補水量 ml（僅 water 類型使用，由汗液流失計算得出） */
  recommendedMl?: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function SupplyModal({ visible, type, recommendedMl, onConfirm, onDismiss }: SupplyModalProps) {
  const colors = useColors();
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 15 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const isCalorie = type === "calorie";
  const iconName = isCalorie ? "flame.fill" : "drop.fill";
  const iconColor = isCalorie ? colors.warning : "#4FC3F7";
  const title = isCalorie ? "補充能量" : "補充水分";
  const subtitle = isCalorie
    ? "您已消耗大量卡路里，建議立即補充能量棒或食物"
    : recommendedMl
    ? `汗液流失達到補水條件，建議補充 ${recommendedMl} ml 水分`
    : "水分流失達到補水條件，建議立即補充水分";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: iconColor + "20" }]}>
            <IconSymbol name={iconName} size={40} color={iconColor} />
          </View>

          {/* Text */}
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>

          {/* 水分補充提示框 */}
          {!isCalorie && recommendedMl && (
            <View style={[styles.tipBox, { backgroundColor: "#4FC3F7" + "15", borderColor: "#4FC3F7" + "35" }]}>
              <Text style={[styles.tipText, { color: "#4FC3F7" }]}>
                💧 建議一次補充 {recommendedMl} ml，小口慢飲效果更佳
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.dismissBtn,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
              onPress={onDismiss}
            >
              <Text style={[styles.dismissText, { color: colors.muted }]}>稍後</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: iconColor, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>已補充</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  tipBox: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  dismissText: {
    fontSize: 15,
    fontWeight: "600",
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
