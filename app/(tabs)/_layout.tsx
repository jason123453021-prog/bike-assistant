import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, StyleSheet } from "react-native";
import { Text } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { HapticTab } from "@/components/haptic-tab";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useRef, useEffect } from "react";
import { showFriendInviteNotification } from "@/lib/feedback-service";

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
  const { isAuthenticated } = useAuth();
  const pendingQuery = trpc.friends.pendingRequests.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000, // 每 30 秒檢查一次
  });
  const pendingCount = pendingQuery.data?.length ?? 0;

  // 偵測新好友邀請並發送本地通知
  const prevPendingIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const items = pendingQuery.data ?? [];
    const currentIds = new Set(items.map((r) => r.friendshipId));
    // 找出新增的邀請
    const newItems = items.filter((r) => !prevPendingIdsRef.current.has(r.friendshipId));
    if (prevPendingIdsRef.current.size > 0 && newItems.length > 0) {
      // 有新邀請，發送通知
      newItems.forEach((r) => {
        showFriendInviteNotification(r.requester?.name ?? "好友");
      });
    }
    prevPendingIdsRef.current = currentIds;
  }, [pendingQuery.data]);

  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = Platform.OS === 'web' ? 60 + bottomPadding : 60 + bottomPadding;

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
      {/* 新導航頁面 (整合騎乘+地圖) */}
      <Tabs.Screen
        name="navigation"
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

      {/* 好友 */}
      <Tabs.Screen
        name="friends"
        options={{
          title: "好友",
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error, fontSize: 10, minWidth: 16, height: 16, borderRadius: 8 },
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="person.2.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="好友" focused={focused} color={color} />
          ),
        }}
      />

      {/* 分析 */}
      <Tabs.Screen
        name="analytics"
        options={{
          title: "分析",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="chart.bar.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="分析" focused={focused} color={color} />
          ),
        }}
      />

      {/* 挑戰 */}
      <Tabs.Screen
        name="challenges"
        options={{
          title: "挑戰",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="flag.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="挑戰" focused={focused} color={color} />
          ),
        }}
      />

      {/* 訓練 */}
      <Tabs.Screen
        name="training"
        options={{
          title: "訓練",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="dumbbell.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="訓練" focused={focused} color={color} />
          ),
        }}
      />

      {/* 推薦 */}
      <Tabs.Screen
        name="recommendations"
        options={{
          title: "推薦",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="sparkles" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="推薦" focused={focused} color={color} />
          ),
        }}
      />

      {/* 隊友 */}
      <Tabs.Screen
        name="buddies"
        options={{
          title: "隊友",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="person.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="隊友" focused={focused} color={color} />
          ),
        }}
      />

      {/* 排行榜 */}
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "排行榜",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="podium.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="排行" focused={focused} color={color} />
          ),
        }}
      />

      {/* 通知 */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: "通知",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="bell.fill" color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="通知" focused={focused} color={color} />
          ),
        }}
      />

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
