import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import "../global.css";
// 必須在頂層引入以確保 TaskManager 任務被定義
import "@/lib/background-location";
import { ThemeProvider, useThemeContext } from "@/lib/theme-provider";
import { RideProvider } from "@/lib/ride-context";
import { SettingsProvider } from "@/lib/settings-context";
import { setupNotifications } from "@/lib/feedback-service";

SplashScreen.preventAutoHideAsync();

// ─── Inner layout (inside ThemeProvider, can safely use useThemeContext) ───────
function InnerLayout() {
  const { colorScheme } = useThemeContext();
  return (
    <NavThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ride-detail" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </NavThemeProvider>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    // setupNotifications 建立 Android 通知頻道（不依賴遠端推播）
    setupNotifications().catch(() => {});
  }, []);

  if (!loaded) return null;

  return (
    <SettingsProvider>
      <RideProvider>
        <ThemeProvider>
          <InnerLayout />
        </ThemeProvider>
      </RideProvider>
    </SettingsProvider>
  );
}
