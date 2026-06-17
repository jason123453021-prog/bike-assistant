import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AppSettings {
  // Personal
  weight: number;       // kg
  height: number;       // cm
  ftp: number;          // Functional Threshold Power (watts)
  // Thresholds
  calorieThreshold: number;   // kcal before reminder
  waterThreshold: number;     // ml before reminder
  // Feedback
  vibrationEnabled: boolean;
  ttsEnabled: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  // UI
  darkMode: boolean;
  // Weather
  weatherApiKey: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  weight: 70,
  height: 175,
  ftp: 200,
  calorieThreshold: 300,
  waterThreshold: 500,
  vibrationEnabled: true,
  ttsEnabled: true,
  soundEnabled: true,
  notificationEnabled: true,
  darkMode: true,
  weatherApiKey: "",
};

const SETTINGS_KEY = "@bike_settings";

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((data) => {
      if (data) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(data) });
      }
    });
  }, []);

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
