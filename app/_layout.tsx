import "@/global.css";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Alert, Platform } from "react-native";
import * as Linking from "expo-linking";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider, useThemeContext } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { RideProvider } from "@/lib/ride-context";
import { GpxProvider, useGpx } from "@/lib/gpx-context";
import { isExternalGpxUri } from "@/lib/external-gpx-import";
import { SettingsProvider } from "@/lib/settings-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearLegacyFavoritesCache } from "@/lib/legacy-favorites-cleanup";
// 移除社群和友誼相關 Provider
import { setupNotifications } from "@/lib/feedback-service";
// 必須在頂層引入以確保 TaskManager 任務被定義
import "@/lib/background-location";
import { RideTrackingNative } from "@/lib/ride-tracking-native";
import { usePermissionMonitoring } from "@/lib/use-permission-monitoring";
import { startSupplyNotificationActionListener } from "@/lib/supply-notification-actions";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

// ─── Inner layout (inside ThemeProvider, can safely use useThemeContext) ───────
function InnerLayout() {
  const { colorScheme } = useThemeContext();

  usePermissionMonitoring();

  return (
    <>
      <NavThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="ride-detail" options={{ headerShown: false, presentation: "fullScreenModal" }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </NavThemeProvider>
    </>
  );
}

/** 接收 Android 系統「開啟方式」傳入的 content:// 或 file:// GPX URI。 */
function ExternalGpxReceiver() {
  const { importExternalRoute } = useGpx();
  const handledUris = useRef(new Set<string>());

  const handleUri = useCallback(async (uri: string | null) => {
    if (!uri || !isExternalGpxUri(uri) || handledUris.current.has(uri)) return;
    handledUris.current.add(uri);
    try {
      await importExternalRoute(uri);
      router.replace("/navigate");
    } catch (error) {
      Alert.alert("GPX 載入失敗", error instanceof Error ? error.message : "無法讀取這個 GPX 檔案。");
    }
  }, [importExternalRoute]);

  useEffect(() => {
    Linking.getInitialURL().then(handleUri).catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => { void handleUri(url); });
    return () => subscription.remove();
  }, [handleUri]);

  return null;
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

  // 升級後立即釋放已移除「最愛路線」功能留下的單一舊版快取鍵。
  useEffect(() => {
    clearLegacyFavoritesCache(AsyncStorage).catch((error) => {
      console.warn("[App] 無法清除舊版最愛路線快取:", error);
    });
  }, []);

  useEffect(() => startSupplyNotificationActionListener(), []);

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
      <SettingsProvider>
        <GpxProvider>
          <ExternalGpxReceiver />
          <RideProvider>
            <ThemeProvider>
              <InnerLayout />
            </ThemeProvider>
          </RideProvider>
        </GpxProvider>
      </SettingsProvider>
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
