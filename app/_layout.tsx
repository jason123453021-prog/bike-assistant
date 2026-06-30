import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider, useThemeContext } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { RideProvider } from "@/lib/ride-context";
import { GpxProvider } from "@/lib/gpx-context";
import { SettingsProvider } from "@/lib/settings-context";
import { FriendNavProvider } from "@/lib/friend-nav-context";
import { FavoritesProvider } from "@/lib/favorites-context";
import { SocialProvider } from "@/lib/social-context";
import { setupNotifications } from "@/lib/feedback-service";
// 必須在頂層引入以確保 TaskManager 任務被定義
import "@/lib/background-location";
import { RideTrackingNative } from "@/lib/ride-tracking-native";
import { PermissionsManager } from "@/lib/permissions-manager";
import { PermissionsOnboardingModal } from "@/components/permissions-onboarding-modal";
import { usePermissionMonitoring } from "@/lib/use-permission-monitoring";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

// ─── Inner layout (inside ThemeProvider, can safely use useThemeContext) ───────
function InnerLayout() {
  const { colorScheme } = useThemeContext();
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  usePermissionMonitoring();

  useEffect(() => {
    const checkPermissionsOnboarding = async () => {
      try {
        const completed = await PermissionsManager.hasCompletedOnboarding();
        if (!completed) {
          setShowPermissionsModal(true);
        }
      } catch (error) {
        console.error('[InnerLayout] Error checking permissions onboarding:', error);
      }
    };

    checkPermissionsOnboarding();
  }, []);

  return (
    <>
      <NavThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="ride-detail" options={{ headerShown: false, presentation: "fullScreenModal" }} />
          <Stack.Screen name="favorites-list" options={{ headerShown: false, presentation: "fullScreenModal" }} />
          <Stack.Screen name="oauth/callback" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </NavThemeProvider>
      <PermissionsOnboardingModal
        visible={showPermissionsModal}
        onComplete={() => setShowPermissionsModal(false)}
      />
    </>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  useEffect(() => {
    setupNotifications().catch(() => {});
  }, []);

  // 在 App 啟動時檢查電池最佳化狀況
  useEffect(() => {
    const checkBatteryOptimization = async () => {
      try {
        const isIgnoring = await RideTrackingNative.isIgnoringBatteryOptimizations();
        if (!isIgnoring) {
          console.warn("[App] App is in battery optimization list, requesting exemption");
          // 主動要求用戶設定
          await RideTrackingNative.requestIgnoreBatteryOptimizations();
        }
      } catch (error) {
        console.error("[App] Failed to check battery optimization:", error);
      }
    };

    checkBatteryOptimization();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <SettingsProvider>
            <GpxProvider>
              <FavoritesProvider>
                <FriendNavProvider>
                  <RideProvider>
                    <SocialProvider>
                      <ThemeProvider>
                        <InnerLayout />
                      </ThemeProvider>
                    </SocialProvider>
                  </RideProvider>
                </FriendNavProvider>
              </FavoritesProvider>
            </GpxProvider>
          </SettingsProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";
  if (shouldOverrideSafeArea) {
    return (
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        <SafeAreaFrameContext.Provider value={frame}>
          <SafeAreaInsetsContext.Provider value={insets}>
            {content}
          </SafeAreaInsetsContext.Provider>
        </SafeAreaFrameContext.Provider>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
  );
}
