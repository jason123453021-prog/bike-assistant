/**
 * Web 平台替代頁面
 * 網頁平台顯示精簡提示；完整騎乘導航使用行動版 Leaflet 地圖。
 */
import { View, Text, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useTranslation } from "react-i18next";

export default function MapScreenWeb() {
  const colors = useColors();
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t("audit.webMapTitle")}
        </Text>
        <Text style={[styles.desc, { color: colors.muted }]}>
          {t("audit.webMapDescription")}
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  desc: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 23,
  },
});
