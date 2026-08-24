import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Localization from "expo-localization";
import i18n, { resolveLanguagePreference, type LanguagePreference, type SupportedLocale } from "./i18n";
import { LANGUAGE_PREFERENCE_STORAGE_KEY, isLanguagePreference } from "./types";
import { useSettings } from "../settings-context";

interface LanguageContextValue { preference: LanguagePreference; activeLanguage: SupportedLocale; isReady: boolean; setLanguagePreference: (preference: LanguagePreference) => Promise<void>; }
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
  const lastSettingsPreference = useRef<LanguagePreference>(settings.languagePreference);
  const applyPreference = useCallback(async (nextPreference: LanguagePreference, options: { persist: boolean; syncSettings: boolean }) => {
    const nextLanguage = resolveLanguagePreference(nextPreference, getSystemLanguageTags());
    await i18n.changeLanguage(nextLanguage);
    setPreference(nextPreference); setActiveLanguage(nextLanguage);
    if (options.persist) await AsyncStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, nextPreference);
    if (options.syncSettings && settings.languagePreference !== nextPreference) { lastSettingsPreference.current = nextPreference; await updateSettings({ languagePreference: nextPreference }); }
  }, [settings.languagePreference, updateSettings]);
  useEffect(() => { let mounted = true; void (async () => { const storedPreference = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY); const initialPreference = isLanguagePreference(storedPreference) ? storedPreference : settings.languagePreference; await applyPreference(initialPreference, { persist: true, syncSettings: true }); if (mounted) setIsReady(true); })(); return () => { mounted = false; }; }, []);
  useEffect(() => { if (!isReady || lastSettingsPreference.current === settings.languagePreference) return; lastSettingsPreference.current = settings.languagePreference; void applyPreference(settings.languagePreference, { persist: true, syncSettings: false }); }, [applyPreference, isReady, settings.languagePreference]);
  useEffect(() => { const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => { if (nextState === "active" && preference === "system") void applyPreference("system", { persist: false, syncSettings: false }); }); return () => subscription.remove(); }, [applyPreference, preference]);
  return <LanguageContext.Provider value={{ preference, activeLanguage, isReady, setLanguagePreference: (nextPreference) => applyPreference(nextPreference, { persist: true, syncSettings: true }) }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { const context = useContext(LanguageContext); if (!context) throw new Error("useLanguage must be used within LanguageProvider"); return context; }
