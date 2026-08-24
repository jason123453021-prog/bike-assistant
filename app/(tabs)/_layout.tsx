import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, StyleSheet , Text } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { HapticTab } from "@/components/haptic-tab";
import { useColors } from "@/hooks/use-colors";
import { useTranslation } from "react-i18next";

function TabLabel({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return (
    <Text style={[styles.tabLabel, { color, fontWeight: focused ? "700" : "400" }]}>
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // 移除友誼查詢邏輯

  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 68 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 9,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarShowLabel: true,
      }}
    >
      {/* 原騎乘頁面隱藏（功能已整合至導航頁） */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,  // 從標籤列隱藏
        }}
      />

      {/* 導航（整合騎乘+地圖） */}
      <Tabs.Screen
        name="map"
        options={{
          title: t("tabs.navigation"),
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="location.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label={t("tabs.navigation")} focused={focused} color={color} />
          ),
        }}
      />

      {/* 路線分析 */}
      <Tabs.Screen
        name="navigate"
        options={{
          title: t("tabs.routes"),
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="map.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label={t("tabs.routes")} focused={focused} color={color} />
          ),
        }}
      />

      {/* 騎乘記錄 */}
      <Tabs.Screen
        name="history"
        options={{
          title: t("tabs.history"),
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="clock.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label={t("tabs.history")} focused={focused} color={color} />
          ),
        }}
      />

      {/* 好友 Tab 已移除 */}

      {/* 設定 */}
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="gearshape.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label={t("tabs.settings")} focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});
