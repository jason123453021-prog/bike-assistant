import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, StyleSheet } from "react-native";
import { Text } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { HapticTab } from "@/components/haptic-tab";
import { useColors } from "@/hooks/use-colors";

function TabLabel({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return (
    <Text style={[styles.tabLabel, { color, fontWeight: focused ? "700" : "400" }]}>
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // 移除友誼查詢邏輯

  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 60 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
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
          title: "導航",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="location.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="導航" focused={focused} color={color} />
          ),
        }}
      />

      {/* 路線分析 */}
      <Tabs.Screen
        name="navigate"
        options={{
          title: "路線分析",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="map.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="路線" focused={focused} color={color} />
          ),
        }}
      />

      {/* 騎乘記錄 */}
      <Tabs.Screen
        name="history"
        options={{
          title: "記錄",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="clock.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="記錄" focused={focused} color={color} />
          ),
        }}
      />

      {/* 好友 Tab 已移除 */}

      {/* 設定 */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "設定",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="gearshape.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="設定" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
});
