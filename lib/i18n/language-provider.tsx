import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Animated, AppState, Easing, StyleSheet, View, type AppStateStatus } from "react-native";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Localization from "expo-localization";
import i18n, { resolveLanguagePreference, type LanguagePreference, type SupportedLocale } from "./i18n";
import { LANGUAGE_PREFERENCE_STORAGE_KEY, isLanguagePreference } from "./types";
import { useSettings } from "../settings-context";
import { getLayoutDirection, type LayoutDirection } from "./layout-direction";

interface LanguageContextValue { preference: LanguagePreference; activeLanguage: SupportedLocale; isReady: boolean; isSwitching: boolean; layoutDirection: LayoutDirection; isRTL: boolean; setLanguagePreference: (preference: LanguagePreference) => Promise<void>; }
const LanguageContext = createContext<LanguageContextValue | null>(null);

function getSystemLanguageTags(): string[] {
  try {
    return Localization.getLocales().map((locale) => locale.languageTag);
  } catch {
    return [];
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const [preference, setPreference] = useState<LanguagePreference>("system");
  const [activeLanguage, setActiveLanguage] = useState<SupportedLocale>(() => resolveLanguagePreference("system", getSystemLanguageTags()));
  const [isReady, setIsReady] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const transitionOpacity = useRef(new Animated.Value(0)).current;
  const lastSettingsPreference = useRef<LanguagePreference>(settings.languagePreference);
  const changeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const applyPreferenceNow = useCallback(async (nextPreference: LanguagePreference, options: { persist: boolean; syncSettings: boolean }) => {
    const nextLanguage = resolveLanguagePreference(nextPreference, getSystemLanguageTags());
    const currentLanguage = (i18n.resolvedLanguage ?? activeLanguage) as SupportedLocale;
    const languageChanged = nextLanguage !== currentLanguage;
    if (languageChanged) {
      setIsSwitching(true);
      Animated.timing(transitionOpacity, { toValue: 1, duration: 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    await i18n.changeLanguage(nextLanguage);
    setPreference(nextPreference); setActiveLanguage(nextLanguage);
    if (options.persist) await AsyncStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, nextPreference);
    if (options.syncSettings && settings.languagePreference !== nextPreference) { lastSettingsPreference.current = nextPreference; await updateSettings({ languagePreference: nextPreference }); }
    if (languageChanged) {
      Animated.timing(transitionOpacity, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => setIsSwitching(false));
    }
  }, [activeLanguage, settings.languagePreference, transitionOpacity, updateSettings]);
  const applyPreference = useCallback((nextPreference: LanguagePreference, options: { persist: boolean; syncSettings: boolean }) => {
    const nextTask = changeQueueRef.current.catch(() => undefined).then(() => applyPreferenceNow(nextPreference, options));
    changeQueueRef.current = nextTask;
    return nextTask;
  }, [applyPreferenceNow]);
  useEffect(() => { let mounted = true; void (async () => { const storedPreference = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY); const initialPreference = isLanguagePreference(storedPreference) ? storedPreference : settings.languagePreference; await applyPreference(initialPreference, { persist: true, syncSettings: true }); if (mounted) setIsReady(true); })(); return () => { mounted = false; }; }, []);
  useEffect(() => { if (!isReady || lastSettingsPreference.current === settings.languagePreference) return; lastSettingsPreference.current = settings.languagePreference; void applyPreference(settings.languagePreference, { persist: true, syncSettings: false }); }, [applyPreference, isReady, settings.languagePreference]);
  useEffect(() => { const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => { if (nextState === "active" && preference === "system") void applyPreference("system", { persist: false, syncSettings: false }); }); return () => subscription.remove(); }, [applyPreference, preference]);
  const layoutDirection = getLayoutDirection(activeLanguage);
  return <LanguageContext.Provider value={{ preference, activeLanguage, isReady, isSwitching, layoutDirection, isRTL: layoutDirection === "rtl", setLanguagePreference: (nextPreference) => applyPreference(nextPreference, { persist: true, syncSettings: true }) }}><View style={[styles.root, { direction: layoutDirection }]}>{children}</View><Animated.View pointerEvents="none" accessibilityElementsHidden={!isSwitching} style={[styles.transitionOverlay, { opacity: transitionOpacity }]}><ActivityIndicator size="small" color="#0A7EA4" /></Animated.View></LanguageContext.Provider>;
}
export function useLanguage() { const context = useContext(LanguageContext); if (!context) throw new Error("useLanguage must be used within LanguageProvider"); return context; }

const styles = StyleSheet.create({
  root: { flex: 1 },
  transitionOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10, 126, 164, 0.08)" },
});
