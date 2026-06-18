import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 正常導航模式可顯示的欄位
export interface NormalModeFields {
  showElapsed: boolean;   // 騎乘時間
  showSpeed: boolean;     // 速度
  showDistance: boolean;  // 距離
  showGrade: boolean;     // 坡度
  showPower: boolean;     // 功率
  showAvgSpeed: boolean;  // 均速
  showCalories: boolean;  // 卡路里
  showPausedTime: boolean; // 暫停時間
}

// 精簡導航模式可顯示的欄位
export interface SimplifiedModeFields {
  showSpeed: boolean;        // 速度（主要大字）
  showDistance: boolean;     // 距離
  showElapsed: boolean;      // 騎乘時間
  showCurrentTime: boolean;  // 現在時間
  showRemaining: boolean;    // 剩餘距離（導航中）
  showDirection: boolean;    // 方向指引
}

export interface AppSettings {
  // Personal
  weight: number;       // kg 騎手體重
  height: number;       // cm
  age: number;          // 騎手年齡（用於推算最大心率 MHR）
  ftp: number;          // Functional Threshold Power (watts)
  bikeWeight: number;   // kg 單車+裝備總重
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
  // 精簡導航模式
  simplifiedNavMode: "off" | "manual" | "auto"; // off=關閉, manual=手動, auto=自動
  simplifiedNavIdleSec: number; // 自動模式開啟前的閒置秒數（預設 30 秒）
  // 隊伍遙測
  teamTelemetryEnabled: boolean; // 是否開啟隊伍遙測
  showFriendDistance: boolean;   // 顯示隊友距離
  showFriendLocation: boolean;   // 顯示隊友位置
  // 隱私
  ghostMode: boolean;            // 隱身模式：不分享自己位置
  shareLocation: boolean;        // 是否分享位置給好友
  // 自訂顯示欄位
  normalModeFields: NormalModeFields;
  simplifiedModeFields: SimplifiedModeFields;
}

const DEFAULT_NORMAL_FIELDS: NormalModeFields = {
  showElapsed: true,
  showSpeed: true,
  showDistance: true,
  showGrade: true,
  showPower: true,
  showAvgSpeed: true,
  showCalories: false,
  showPausedTime: false,
};

const DEFAULT_SIMPLIFIED_FIELDS: SimplifiedModeFields = {
  showSpeed: true,
  showDistance: true,
  showElapsed: true,
  showCurrentTime: true,
  showRemaining: true,
  showDirection: true,
};

const DEFAULT_SETTINGS: AppSettings = {
  weight: 70,
  height: 175,
  age: 32,
  ftp: 200,
  bikeWeight: 10,
  calorieThreshold: 300,
  waterThreshold: 500,
  vibrationEnabled: true,
  ttsEnabled: true,
  soundEnabled: true,
  notificationEnabled: true,
  darkMode: true,
  weatherApiKey: "",
  simplifiedNavMode: "off",
  simplifiedNavIdleSec: 30,
  teamTelemetryEnabled: false,
  showFriendDistance: true,
  showFriendLocation: true,
  ghostMode: false,
  shareLocation: true,
  normalModeFields: DEFAULT_NORMAL_FIELDS,
  simplifiedModeFields: DEFAULT_SIMPLIFIED_FIELDS,
};

const SETTINGS_KEY = "@bike_settings";

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  updateNormalFields: (partial: Partial<NormalModeFields>) => Promise<void>;
  updateSimplifiedFields: (partial: Partial<SimplifiedModeFields>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((data) => {
      if (data) {
        const saved = JSON.parse(data);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...saved,
          normalModeFields: { ...DEFAULT_NORMAL_FIELDS, ...(saved.normalModeFields ?? {}) },
          simplifiedModeFields: { ...DEFAULT_SIMPLIFIED_FIELDS, ...(saved.simplifiedModeFields ?? {}) },
        });
      }
    });
  }, []);

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const updateNormalFields = async (partial: Partial<NormalModeFields>) => {
    const next = {
      ...settings,
      normalModeFields: { ...settings.normalModeFields, ...partial },
    };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const updateSimplifiedFields = async (partial: Partial<SimplifiedModeFields>) => {
    const next = {
      ...settings,
      simplifiedModeFields: { ...settings.simplifiedModeFields, ...partial },
    };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, updateNormalFields, updateSimplifiedFields }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
