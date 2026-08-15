import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Modal,
  ScrollView,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export interface SupplyModalProps {
  /** 卡路里補給提醒是否觸發 */
  calorieAlert: boolean;
  /** 水分補給提醒是否觸發 */
  waterAlert: boolean;
  /** 按下「已補充卡路里」 */
  onConfirmCalorie: () => void;
  /** 按下「已補充水分」 */
  onConfirmWater: () => void;
  /** 按下「稍後」（關閉但不重置） */
  onDismiss: () => void;
  /** 智慧倒數到期後必須明確確認，不能暫時關閉。 */
  allowSnooze?: boolean;
  /** 自訂補給品提醒清單，依附於能量或補水的共用提醒流程。 */
  customSupplyAlerts?: { id: string; name: string; target: "energy" | "water"; onConfirm: () => void }[];
}

export function SupplyModal({
  calorieAlert,
  waterAlert,
  onConfirmCalorie,
  onConfirmWater,
  onDismiss,
  allowSnooze = true,
  customSupplyAlerts = [],
}: SupplyModalProps) {
  const colors = useColors();
  const visible = calorieAlert || waterAlert || customSupplyAlerts.length > 0;
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
  }, [opacityAnim, scaleAnim, visible]);

  const bothAlert = calorieAlert && waterAlert;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={() => { if (allowSnooze) onDismiss(); }}
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
          <ScrollView
            contentContainerStyle={styles.cardContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.titleGroup}>
              <Text style={[styles.mainTitle, { color: colors.foreground }]}> 
                {bothAlert || customSupplyAlerts.length > 0 ? "補給提醒" : calorieAlert ? "補充能量" : "補充水分"}
              </Text>
              {bothAlert && (
                <View style={[styles.dualStatus, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.dualStatusText, { color: colors.muted }]}>兩項皆待確認，可依任意順序完成</Text>
                </View>
              )}
            </View>

            <View style={styles.supplyStack}>
              {/* 卡路里區塊 */}
              {calorieAlert && (
                <View style={[styles.alertBlock, { borderColor: "#F59E0B" + "55", backgroundColor: "#F59E0B" + "12" }]}>
                  <View style={styles.alertBlockHeader}>
                    <View style={[styles.alertIconWrap, { backgroundColor: "#F59E0B" + "22" }]}>
                      <IconSymbol name="flame.fill" size={28} color="#F59E0B" />
                    </View>
                    <View style={styles.alertBlockText}>
                      <Text style={[styles.alertBlockTitle, { color: "#F59E0B" }]}>能量補充</Text>
                      <Text style={[styles.alertBlockSub, { color: colors.muted }]}>請補給能量，確認後立即開始下一輪能量倒數。</Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="確認已補給能量並重新開始能量倒數"
                    hitSlop={6}
                    style={({ pressed }) => [styles.confirmBtn, styles.energyButton, { opacity: pressed ? 0.82 : 1 }]}
                    onPress={onConfirmCalorie}
                  >
                    <Text style={styles.confirmText}>已補給能量</Text>
                    <Text style={styles.confirmHint}>重新開始能量倒數</Text>
                  </Pressable>
                </View>
              )}

              {/* 水分區塊 */}
              {waterAlert && (
                <View style={[styles.alertBlock, { borderColor: "#4FC3F7" + "55", backgroundColor: "#4FC3F7" + "12" }]}>
                  <View style={styles.alertBlockHeader}>
                    <View style={[styles.alertIconWrap, { backgroundColor: "#4FC3F7" + "22" }]}>
                      <IconSymbol name="drop.fill" size={28} color="#4FC3F7" />
                    </View>
                    <View style={styles.alertBlockText}>
                      <Text style={[styles.alertBlockTitle, { color: "#1595C9" }]}>水分補充</Text>
                      <Text style={[styles.alertBlockSub, { color: colors.muted }]}>請補給水分，確認後立即開始下一輪補水倒數。</Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="確認已補給水分並重新開始補水倒數"
                    hitSlop={6}
                    style={({ pressed }) => [styles.confirmBtn, styles.waterButton, { opacity: pressed ? 0.82 : 1 }]}
                    onPress={onConfirmWater}
                  >
                    <Text style={styles.confirmText}>已補給水分</Text>
                    <Text style={styles.confirmHint}>重新開始補水倒數</Text>
                  </Pressable>
                </View>
              )}

              {/* 自訂補給品提醒區塊：沿用能量或補水的共用語意與確認方式。 */}
              {customSupplyAlerts.map((alert) => (
                <View key={alert.id} style={[styles.alertBlock, { borderColor: (alert.target === "energy" ? "#F59E0B" : "#4FC3F7") + "55", backgroundColor: (alert.target === "energy" ? "#F59E0B" : "#4FC3F7") + "12" }]}>
                  <View style={styles.alertBlockHeader}>
                    <View style={[styles.alertIconWrap, { backgroundColor: (alert.target === "energy" ? "#F59E0B" : "#4FC3F7") + "22" }]}> 
                      <IconSymbol name={alert.target === "energy" ? "flame.fill" : "drop.fill"} size={28} color={alert.target === "energy" ? "#F59E0B" : "#1595C9"} />
                    </View>
                    <View style={styles.alertBlockText}>
                      <Text style={[styles.alertBlockTitle, { color: alert.target === "energy" ? "#F59E0B" : "#1595C9" }]}>{alert.name}</Text>
                      <Text style={[styles.alertBlockSub, { color: colors.muted }]}>{alert.target === "energy" ? "請補給能量，提醒設定與能量共用。" : "請補給水分，提醒設定與補水共用。"}</Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`確認已補給${alert.name}`}
                    hitSlop={6}
                    style={({ pressed }) => [styles.confirmBtn, alert.target === "energy" ? styles.energyButton : styles.waterButton, { opacity: pressed ? 0.82 : 1 }]}
                    onPress={alert.onConfirm}
                  >
                    <Text style={styles.confirmText}>{alert.target === "energy" ? "已補給能量" : "已補給水分"}</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <Text style={[styles.safetyHint, { color: colors.muted }]}>請分別確認已完成的補給項目。</Text>

            {allowSnooze && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="稍後提醒"
                style={({ pressed }) => [
                  styles.dismissBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                ]}
                onPress={onDismiss}
              >
                <Text style={[styles.dismissText, { color: colors.muted }]}>稍後提醒</Text>
              </Pressable>
            )}
          </ScrollView>
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
    maxHeight: "86%",
    borderRadius: 20,
    alignItems: "stretch",
    borderWidth: 1,
    overflow: "hidden",
  },
  cardContent: {
    padding: 20,
    gap: 16,
  },
  titleGroup: {
    alignItems: "center",
    gap: 8,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 26,
  },
  dualStatus: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dualStatusText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 17,
    fontWeight: "600",
  },
  supplyStack: {
    gap: 14,
  },
  alertBlock: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  alertBlockHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
  },
  alertIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  alertBlockText: {
    flex: 1,
    gap: 5,
  },
  alertBlockTitle: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
  },
  alertBlockSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmBtn: {
    minHeight: 66,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  energyButton: {
    backgroundColor: "#D97706",
  },
  waterButton: {
    backgroundColor: "#0284C7",
  },
  customButton: {
    backgroundColor: "#7E22CE",
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  confirmHint: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.84)",
  },
  safetyHint: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 10,
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
