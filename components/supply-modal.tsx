import { useEffect, useRef } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  Modal,
  ScrollView,
} from "react-native";

import { AdaptiveFormText } from "@/components/adaptive-form-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/i18n/language-provider";
import { getSupplyModalCopy } from "@/lib/i18n/supply-modal-copy";

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
  customSupplyAlerts?: {
    id: string;
    name: string;
    target: "energy" | "water";
    onConfirm: () => void;
  }[];
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
  const { activeLanguage, isRTL } = useLanguage();
  const copy = getSupplyModalCopy(activeLanguage);
  const textAlign = isRTL ? "right" : "left";
  const visible = calorieAlert || waterAlert || customSupplyAlerts.length > 0;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 15,
          stiffness: 200,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [opacityAnim, scaleAnim, visible]);

  const bothAlert = calorieAlert && waterAlert;
  const modalTitle =
    bothAlert || customSupplyAlerts.length > 0
      ? copy.reminderTitle
      : calorieAlert
        ? copy.energyTitle
        : copy.waterTitle;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={() => {
        if (allowSnooze) onDismiss();
      }}
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
              <AdaptiveFormText
                baseFontSize={22}
                maxLinesBeforeShrink={2}
                style={[styles.mainTitle, { color: colors.foreground }]}
              >
                {modalTitle}
              </AdaptiveFormText>
              {bothAlert && (
                <View
                  style={[
                    styles.dualStatus,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <AdaptiveFormText
                    baseFontSize={13}
                    style={[styles.dualStatusText, { color: colors.muted }]}
                  >
                    {copy.bothPending}
                  </AdaptiveFormText>
                </View>
              )}
            </View>

            <View style={styles.supplyStack}>
              {calorieAlert && (
                <View
                  style={[
                    styles.alertBlock,
                    { borderColor: "#F59E0B55", backgroundColor: "#F59E0B12" },
                  ]}
                >
                  <View
                    style={[
                      styles.alertBlockHeader,
                      isRTL && styles.alertBlockHeaderRtl,
                    ]}
                  >
                    <View
                      style={[
                        styles.alertIconWrap,
                        { backgroundColor: "#F59E0B22" },
                      ]}
                    >
                      <IconSymbol name="flame.fill" size={28} color="#F59E0B" />
                    </View>
                    <View style={styles.alertBlockText}>
                      <AdaptiveFormText
                        baseFontSize={17}
                        style={[
                          styles.alertBlockTitle,
                          { color: "#F59E0B", textAlign },
                        ]}
                      >
                        {copy.energyTitle}
                      </AdaptiveFormText>
                      <AdaptiveFormText
                        baseFontSize={14}
                        maxLinesBeforeShrink={3}
                        style={[
                          styles.alertBlockSub,
                          { color: colors.muted, textAlign },
                        ]}
                      >
                        {copy.energyBody}
                      </AdaptiveFormText>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${copy.energyConfirm} · ${copy.energyRestart}`}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.confirmBtn,
                      styles.energyButton,
                      { opacity: pressed ? 0.82 : 1 },
                    ]}
                    onPress={onConfirmCalorie}
                  >
                    <AdaptiveFormText
                      baseFontSize={16}
                      style={styles.confirmText}
                    >
                      {copy.energyConfirm}
                    </AdaptiveFormText>
                    <AdaptiveFormText
                      baseFontSize={12}
                      style={styles.confirmHint}
                    >
                      {copy.energyRestart}
                    </AdaptiveFormText>
                  </Pressable>
                </View>
              )}

              {waterAlert && (
                <View
                  style={[
                    styles.alertBlock,
                    { borderColor: "#4FC3F755", backgroundColor: "#4FC3F712" },
                  ]}
                >
                  <View
                    style={[
                      styles.alertBlockHeader,
                      isRTL && styles.alertBlockHeaderRtl,
                    ]}
                  >
                    <View
                      style={[
                        styles.alertIconWrap,
                        { backgroundColor: "#4FC3F722" },
                      ]}
                    >
                      <IconSymbol name="drop.fill" size={28} color="#4FC3F7" />
                    </View>
                    <View style={styles.alertBlockText}>
                      <AdaptiveFormText
                        baseFontSize={17}
                        style={[
                          styles.alertBlockTitle,
                          { color: "#1595C9", textAlign },
                        ]}
                      >
                        {copy.waterTitle}
                      </AdaptiveFormText>
                      <AdaptiveFormText
                        baseFontSize={14}
                        maxLinesBeforeShrink={3}
                        style={[
                          styles.alertBlockSub,
                          { color: colors.muted, textAlign },
                        ]}
                      >
                        {copy.waterBody}
                      </AdaptiveFormText>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${copy.waterConfirm} · ${copy.waterRestart}`}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.confirmBtn,
                      styles.waterButton,
                      { opacity: pressed ? 0.82 : 1 },
                    ]}
                    onPress={onConfirmWater}
                  >
                    <AdaptiveFormText
                      baseFontSize={16}
                      style={styles.confirmText}
                    >
                      {copy.waterConfirm}
                    </AdaptiveFormText>
                    <AdaptiveFormText
                      baseFontSize={12}
                      style={styles.confirmHint}
                    >
                      {copy.waterRestart}
                    </AdaptiveFormText>
                  </Pressable>
                </View>
              )}

              {customSupplyAlerts.map((alert) => (
                <View
                  key={alert.id}
                  style={[
                    styles.alertBlock,
                    {
                      borderColor:
                        alert.target === "energy" ? "#F59E0B55" : "#4FC3F755",
                      backgroundColor:
                        alert.target === "energy" ? "#F59E0B12" : "#4FC3F712",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.alertBlockHeader,
                      isRTL && styles.alertBlockHeaderRtl,
                    ]}
                  >
                    <View
                      style={[
                        styles.alertIconWrap,
                        {
                          backgroundColor:
                            alert.target === "energy"
                              ? "#F59E0B22"
                              : "#4FC3F722",
                        },
                      ]}
                    >
                      <IconSymbol
                        name={
                          alert.target === "energy" ? "flame.fill" : "drop.fill"
                        }
                        size={28}
                        color={
                          alert.target === "energy" ? "#F59E0B" : "#1595C9"
                        }
                      />
                    </View>
                    <View style={styles.alertBlockText}>
                      <AdaptiveFormText
                        baseFontSize={17}
                        style={[
                          styles.alertBlockTitle,
                          {
                            color:
                              alert.target === "energy" ? "#F59E0B" : "#1595C9",
                            textAlign,
                          },
                        ]}
                      >
                        {alert.name}
                      </AdaptiveFormText>
                      <AdaptiveFormText
                        baseFontSize={14}
                        maxLinesBeforeShrink={3}
                        style={[
                          styles.alertBlockSub,
                          { color: colors.muted, textAlign },
                        ]}
                      >
                        {alert.target === "energy"
                          ? copy.customEnergyBody
                          : copy.customWaterBody}
                      </AdaptiveFormText>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${copy.customConfirmPrefix} ${alert.name}`}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.confirmBtn,
                      alert.target === "energy"
                        ? styles.energyButton
                        : styles.waterButton,
                      { opacity: pressed ? 0.82 : 1 },
                    ]}
                    onPress={alert.onConfirm}
                  >
                    <AdaptiveFormText
                      baseFontSize={16}
                      style={styles.confirmText}
                    >
                      {alert.target === "energy"
                        ? copy.energyConfirm
                        : copy.waterConfirm}
                    </AdaptiveFormText>
                  </Pressable>
                </View>
              ))}
            </View>

            <AdaptiveFormText
              baseFontSize={13}
              style={[styles.safetyHint, { color: colors.muted, textAlign }]}
            >
              {copy.safetyHint}
            </AdaptiveFormText>

            {allowSnooze && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.snooze}
                style={({ pressed }) => [
                  styles.dismissBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                ]}
                onPress={onDismiss}
              >
                <AdaptiveFormText
                  baseFontSize={15}
                  style={[styles.dismissText, { color: colors.muted }]}
                >
                  {copy.snooze}
                </AdaptiveFormText>
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
  cardContent: { padding: 20, gap: 16 },
  titleGroup: { alignItems: "center", gap: 8 },
  mainTitle: { fontWeight: "800", textAlign: "center", lineHeight: 26 },
  dualStatus: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dualStatusText: { textAlign: "center", lineHeight: 17, fontWeight: "600" },
  supplyStack: { gap: 14 },
  alertBlock: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  alertBlockHeader: { flexDirection: "row", alignItems: "flex-start", gap: 13 },
  alertBlockHeaderRtl: { flexDirection: "row-reverse" },
  alertIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  alertBlockText: { flex: 1, gap: 5 },
  alertBlockTitle: { fontWeight: "800", lineHeight: 23 },
  alertBlockSub: { lineHeight: 20 },
  confirmBtn: {
    minHeight: 66,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  energyButton: { backgroundColor: "#D97706" },
  waterButton: { backgroundColor: "#0284C7" },
  confirmText: { fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
  confirmHint: {
    lineHeight: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.84)",
    textAlign: "center",
  },
  safetyHint: { lineHeight: 19, paddingHorizontal: 10 },
  dismissBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 2,
  },
  dismissText: { fontWeight: "600", textAlign: "center" },
});
