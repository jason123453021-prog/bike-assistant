import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

export type ThemePreference = ColorScheme | "system";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  themePreference: ThemePreference;
  setColorScheme: (scheme: ColorScheme) => void;
  setThemePreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const colorScheme: ColorScheme = themePreference === "system" ? systemScheme : themePreference;

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setThemePreference(scheme);
  }, [setThemePreference]);

  useEffect(() => {
    AsyncStorage.getItem("@bike_settings").then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { appearanceMode?: unknown };
        if (parsed.appearanceMode === "light" || parsed.appearanceMode === "dark" || parsed.appearanceMode === "system") {
          setThemePreferenceState(parsed.appearanceMode);
        }
      } catch {
        // 設定資料受損時維持跟隨系統；不得讓啟動流程中斷。
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    applyScheme(colorScheme);
    Appearance.setColorScheme?.(themePreference === "system" ? null : colorScheme);
  }, [applyScheme, colorScheme, themePreference]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-surfaceElevated": SchemeColors[colorScheme].surfaceElevated,
        "color-surfaceInset": SchemeColors[colorScheme].surfaceInset,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
        "color-accent": (SchemeColors[colorScheme] as any).accent ?? SchemeColors[colorScheme].primary,
        "color-tint": (SchemeColors[colorScheme] as any).tint ?? SchemeColors[colorScheme].primary,
        "color-overlay": SchemeColors[colorScheme].overlay,
        "color-onAccent": SchemeColors[colorScheme].onAccent,
        "color-onError": SchemeColors[colorScheme].onError,
        "color-onWarning": SchemeColors[colorScheme].onWarning,
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      themePreference,
      setColorScheme,
      setThemePreference,
    }),
    [colorScheme, setColorScheme, setThemePreference, themePreference],
  );
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
