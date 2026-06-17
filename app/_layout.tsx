import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import * as Notifications from "expo-notifications";

import "../global.css";
// 必須在頂層引入以確保 TaskManager 任務被定義
import "@/lib/background-location";
import { ThemeProvider } from "@/lib/theme-provider";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { RideProvider } from "@/lib/ride-context";
import { SettingsProvider } from "@/lib/settings-context";
import { setupNotifications } from "@/lib/feedback-service";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    setupNotifications();
  }, []);

  if (!loaded) return null;

  return (
    <SettingsProvider>
      <RideProvider>
        <ThemeProvider>
          <NavThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </NavThemeProvider>
        </ThemeProvider>
      </RideProvider>
    </SettingsProvider>
  );
}
