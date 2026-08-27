import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

type BackgroundLocationDisclosureProps = {
  visible: boolean;
  onDecision: (accepted: boolean) => void;
};

/**
 * Android 11+ 開啟背景位置系統設定前的 app 內顯眼告知。
 * 此元件不請求任何系統權限；只有使用者選擇繼續後，呼叫端才會發起系統請求。
 */
export function BackgroundLocationDisclosure({
  visible,
  onDecision,
}: BackgroundLocationDisclosureProps) {
  const { t } = useTranslation();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={() => onDecision(false)}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View
          accessibilityRole="alert"
          accessibilityLabel={t("permissions.backgroundDisclosureTitle")}
          style={styles.card}
        >
          <Text style={styles.title}>
            {t("permissions.backgroundDisclosureTitle")}
          </Text>
          <Text style={styles.body}>
            {t("permissions.backgroundDisclosurePurpose")}
          </Text>
          <View style={styles.points}>
            <Text style={styles.point}>
              {t("permissions.backgroundDisclosureData")}
            </Text>
            <Text style={styles.point}>
              {t("permissions.backgroundDisclosureStop")}
            </Text>
            <Text style={styles.point}>
              {t("permissions.backgroundDisclosureSystem")}
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("permissions.backgroundDisclosureNotNow")}
              onPress={() => onDecision(false)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {t("permissions.backgroundDisclosureNotNow")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("permissions.backgroundDisclosureContinue")}
              onPress={() => onDecision(true)}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {t("permissions.backgroundDisclosureContinue")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 24,
    padding: 22,
    backgroundColor: "#FFFFFF",
  },
  title: { color: "#111827", fontSize: 21, fontWeight: "800", lineHeight: 28 },
  body: { color: "#374151", fontSize: 15, lineHeight: 22, marginTop: 12 },
  points: { gap: 8, marginTop: 16 },
  point: { color: "#1F2937", fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", gap: 10, marginTop: 22 },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#9CA3AF",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#0A7EA4",
  },
  secondaryButtonText: { color: "#1F2937", fontSize: 15, fontWeight: "700" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.72 },
});
