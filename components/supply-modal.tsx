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
  /** 卡路里補給提醒是否觸發 */
  calorieAlert: boolean;
  /** 水分補給提醒是否觸發 */
  waterAlert: boolean;
  /** 建議補水量 ml */
  recommendedMl?: number;
  /** 按下「已補充卡路里」 */
  onConfirmCalorie: () => void;
  /** 按下「已補充水分」 */
  onConfirmWater: () => void;
  /** 按下「稍後」（關閉但不重置） */
  onDismiss: () => void;
}

export function SupplyModal({
  calorieAlert,
  waterAlert,
  recommendedMl,
  onConfirmCalorie,
  onConfirmWater,
  onDismiss,
}: SupplyModalProps) {
  const colors = useColors();
  const visible = calorieAlert || waterAlert;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 200 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const bothAlert = calorieAlert && waterAlert;

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
          {/* 標題列 */}
          <Text style={[styles.mainTitle, { color: colors.foreground }]}>
            {bothAlert ? "補給提醒" : calorieAlert ? "補充能量" : "補充水分"}
          </Text>
          {bothAlert && (
            <Text style={[styles.bothSubtitle, { color: colors.muted }]}>
              卡路里與水分均已達到補給閾值，請分別補充
            </Text>
          )}

          {/* 卡路里區塊 */}
          {calorieAlert && (
            <View style={[styles.alertBlock, { borderColor: "#F59E0B" + "40", backgroundColor: "#F59E0B" + "10" }]}>
              <View style={styles.alertBlockHeader}>
                <View style={[styles.alertIconWrap, { backgroundColor: "#F59E0B" + "20" }]}>
                  <IconSymbol name="flame.fill" size={28} color="#F59E0B" />
                </View>
                <View style={styles.alertBlockText}>
                  <Text style={[styles.alertBlockTitle, { color: "#F59E0B" }]}>能量補充</Text>
                  <Text style={[styles.alertBlockSub, { color: colors.muted }]}>
                    已消耗大量卡路里，建議補充能量棒或食物
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, { backgroundColor: "#F59E0B", opacity: pressed ? 0.8 : 1 }]}
                onPress={onConfirmCalorie}
              >
                <Text style={styles.confirmText}>✓ 已補充能量</Text>
              </Pressable>
            </View>
          )}

          {/* 水分區塊 */}
          {waterAlert && (
            <View style={[styles.alertBlock, { borderColor: "#4FC3F7" + "40", backgroundColor: "#4FC3F7" + "10" }]}>
              <View style={styles.alertBlockHeader}>
                <View style={[styles.alertIconWrap, { backgroundColor: "#4FC3F7" + "20" }]}>
                  <IconSymbol name="drop.fill" size={28} color="#4FC3F7" />
                </View>
                <View style={styles.alertBlockText}>
                  <Text style={[styles.alertBlockTitle, { color: "#4FC3F7" }]}>水分補充</Text>
                  <Text style={[styles.alertBlockSub, { color: colors.muted }]}>
                    {recommendedMl
                      ? `汗液流失達補水條件，建議補充 ${recommendedMl} ml`
                      : "水分流失達到補水條件，建議立即補充水分"}
                  </Text>
                </View>
              </View>
              {recommendedMl && (
                <View style={[styles.tipBox, { backgroundColor: "#4FC3F7" + "15", borderColor: "#4FC3F7" + "35" }]}>
                  <Text style={[styles.tipText, { color: "#4FC3F7" }]}>
                    💧 建議一次補充 {recommendedMl} ml，小口慢飲效果更佳
                  </Text>
                </View>
              )}
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, { backgroundColor: "#4FC3F7", opacity: pressed ? 0.8 : 1 }]}
                onPress={onConfirmWater}
              >
                <Text style={styles.confirmText}>✓ 已補充水分</Text>
              </Pressable>
            </View>
          )}

          {/* 稍後按鈕 */}
          <Pressable
            style={({ pressed }) => [
              styles.dismissBtn,
              { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={onDismiss}
          >
            <Text style={[styles.dismissText, { color: colors.muted }]}>稍後提醒</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 22,
    alignItems: "stretch",
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  bothSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 4,
  },
  alertBlock: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  alertBlockHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  alertIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  alertBlockText: {
    flex: 1,
    gap: 4,
  },
  alertBlockTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  alertBlockSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  tipBox: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  confirmBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dismissBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 2,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
