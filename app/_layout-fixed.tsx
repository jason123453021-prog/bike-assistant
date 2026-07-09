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
import "@/lib/background-location";
import { RideTrackingNative } from "@/lib/ride-tracking-native";
import { PermissionsManager } from "@/lib/permissions-manager";
import { usePermissionMonitoring } from "@/lib/use-permission-monitoring";
import { ErrorBoundary } from "@/components/error-boundary";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function InnerLayout() {
  const { colorScheme } = useThemeContext();
  usePermissionMonitoring();

  return (
    <>
      <NavThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="(tabs)">
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="ride-detail" options={{ headerShown: false, presentation: "fullScreenModal" }} />
          <Stack.Screen name="favorites-list" options={{ headerShown: false, presentation: "fullScreenModal" }} />
          <Stack.Screen name="oauth/callback" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </NavThemeProvider>
    </>
  );
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  useEffect(() => {
    initManusRuntime();
  }, []);

  useEffect(() => {
    setupNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    const checkBatteryOptimization = async () => {
      try {
        const isIgnoring = await RideTrackingNative.isIgnoringBatteryOptimizations();
        if (!isIgnoring) {
          console.warn("[App] App is in battery optimization list");
          await RideTrackingNative.requestIgnoreBatteryOptimizations();
        }
      } catch (error) {
        console.error("[App] Battery optimization check failed:", error);
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
      <ErrorBoundary>
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
      </ErrorBoundary>
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
