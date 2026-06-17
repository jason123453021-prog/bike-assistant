/**
 * Web 平台替代頁面
 * react-native-maps 僅支援 Android/iOS，web 平台顯示提示
 */
import { View, Text, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function MapScreenWeb() {
  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.title}>地圖導航</Text>
        <Text style={styles.desc}>
          地圖導航功能僅支援 Android 裝置，請使用 Expo Go 掃描 QR Code 在手機上體驗完整功能。
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
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  desc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 22,
  },
});
