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

// 精簡導航模式可顯示的欄位（與正常模式一致）
export interface SimplifiedModeFields {
  showSpeed: boolean;        // 速度（主要大字）
  showDistance: boolean;     // 距離
  showElapsed: boolean;      // 騎乘時間
  showCurrentTime: boolean;  // 現在時間
  showRemaining: boolean;    // 剩餘距離（導航中）
  showDirection: boolean;    // 方向指引
  showGrade: boolean;        // 坡度
  showPower: boolean;        // 功率
  showAvgSpeed: boolean;     // 均速
  showCalories: boolean;     // 卡路里
  showPausedTime: boolean;   // 暫停時間
}

// 儀表板欄位 key 型別
export type NormalFieldKey = keyof NormalModeFields;
export type SimplifiedFieldKey = keyof SimplifiedModeFields;

// 預設欄位排序（與 NormalModeFields key 對應）
export const DEFAULT_FIELD_ORDER: NormalFieldKey[] = [
  "showElapsed",
  "showSpeed",
  "showDistance",
  "showGrade",
  "showPower",
  "showAvgSpeed",
  "showCalories",
  "showPausedTime",
];

// 精簡模式欄位預設排序
export const DEFAULT_SIMPLIFIED_FIELD_ORDER: SimplifiedFieldKey[] = [
  "showDirection",
  "showRemaining",
  "showSpeed",
  "showDistance",
  "showElapsed",
  "showCurrentTime",
  "showGrade",
  "showPower",
  "showAvgSpeed",
  "showCalories",
  "showPausedTime",
];

// 補給品項目型別
export interface SupplyItem {
  id: string;                    // 唯一識別符
  name: string;                  // 補給品名稱（e.g., "運動飲料", "能量棒"）
  triggerType: "time" | "distance"; // 觸發方式：時間或距離
  triggerValue: number;          // 觸發值（秒 or 公里）
  repeatMode: "once" | "every" | "off"; // 重複模式：只提醒一次/每次/不提醒
  enabled: boolean;              // 是否啟用
}

// 效能模式型別
export type PerformanceMode = 'battery-saver' | 'balanced' | 'performance';

// 預設補給品樣板
export const SUPPLY_ITEM_TEMPLATES = [
  { name: "能量棒", triggerType: "time" as const, triggerValue: 600, repeatMode: "every" as const },
  { name: "電解質飲料", triggerType: "time" as const, triggerValue: 900, repeatMode: "every" as const },
  { name: "水", triggerType: "time" as const, triggerValue: 600, repeatMode: "every" as const },
  { name: "鹿茶", triggerType: "distance" as const, triggerValue: 10, repeatMode: "every" as const },
  { name: "膠原蛋白飲", triggerType: "time" as const, triggerValue: 1200, repeatMode: "every" as const },
]

export interface AppSettings {
  // Personal
  weight: number;       // kg 騎手體重
  height: number;       // cm
  age: number;          // 騎手年齡（用於推算最大心率 MHR）
  ftp: number;          // Functional Threshold Power (watts)
  bikeWeight: number;   // kg 单軋+裝備總重
  // 效能模式
  performanceMode: PerformanceMode; // 效能模式（省電、平衡、性能）
  autoPerformanceMode: boolean;      // 是否根據電量自動調整
  // Thresholds
  calorieThreshold: number;   // kcal before reminder
  waterThreshold: number;     // ml before reminder
  supplyReminderRepeatSec: number; // 0 = 不重複；>0 = 每幾秒重複語音提醒
  supplyItems: SupplyItem[];   // 自訂補給品清單
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
  // 儀表板欄位排序（key 陣列，決定渲染順序）
  normalModeFieldOrder: NormalFieldKey[];
  // 精簡模式欄位排序
  simplifiedModeFieldOrder: SimplifiedFieldKey[];
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
  showGrade: false,
  showPower: false,
  showAvgSpeed: false,
  showCalories: false,
  showPausedTime: false,
};

const DEFAULT_SETTINGS: AppSettings = {
  weight: 70,
  height: 175,
  age: 32,
  ftp: 200,
  bikeWeight: 10,
  performanceMode: 'balanced' as PerformanceMode,
  autoPerformanceMode: true,
  calorieThreshold: 300,
  waterThreshold: 500,
  supplyReminderRepeatSec: 60,  // 預設 60 秒重複一次
  supplyItems: [],  // 初始空補給品清單
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
  normalModeFieldOrder: DEFAULT_FIELD_ORDER,
  simplifiedModeFieldOrder: DEFAULT_SIMPLIFIED_FIELD_ORDER,
};

const SETTINGS_KEY = "@bike_settings";

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  updateNormalFields: (partial: Partial<NormalModeFields>) => Promise<void>;
  updateSimplifiedFields: (partial: Partial<SimplifiedModeFields>) => Promise<void>;
  updateFieldOrder: (order: NormalFieldKey[]) => Promise<void>;
  updateSimplifiedFieldOrder: (order: SimplifiedFieldKey[]) => Promise<void>;
  addSupplyItem: (item: SupplyItem) => Promise<void>;
  updateSupplyItem: (id: string, partial: Partial<SupplyItem>) => Promise<void>;
  deleteSupplyItem: (id: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((data) => {
      if (data) {
        const saved = JSON.parse(data);
        // 確保 fieldOrder 包含所有 key（向後相容）
        const savedOrder: NormalFieldKey[] = saved.normalModeFieldOrder ?? [];
        const mergedOrder = [
          ...savedOrder.filter((k: NormalFieldKey) => DEFAULT_FIELD_ORDER.includes(k)),
          ...DEFAULT_FIELD_ORDER.filter((k) => !savedOrder.includes(k)),
        ];
        const savedSimplifiedOrder: SimplifiedFieldKey[] = saved.simplifiedModeFieldOrder ?? [];
        const mergedSimplifiedOrder = [
          ...savedSimplifiedOrder.filter((k: SimplifiedFieldKey) => DEFAULT_SIMPLIFIED_FIELD_ORDER.includes(k)),
          ...DEFAULT_SIMPLIFIED_FIELD_ORDER.filter((k) => !savedSimplifiedOrder.includes(k)),
        ];
        setSettings({
          ...DEFAULT_SETTINGS,
          ...saved,
          normalModeFields: { ...DEFAULT_NORMAL_FIELDS, ...(saved.normalModeFields ?? {}) },
          simplifiedModeFields: { ...DEFAULT_SIMPLIFIED_FIELDS, ...(saved.simplifiedModeFields ?? {}) },
          normalModeFieldOrder: mergedOrder,
          simplifiedModeFieldOrder: mergedSimplifiedOrder,
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

  const updateFieldOrder = async (order: NormalFieldKey[]) => {
    const next = { ...settings, normalModeFieldOrder: order };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const updateSimplifiedFieldOrder = async (order: SimplifiedFieldKey[]) => {
    const next = { ...settings, simplifiedModeFieldOrder: order };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const addSupplyItem = async (item: SupplyItem) => {
    const next = {
      ...settings,
      supplyItems: [...settings.supplyItems, item],
    };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const updateSupplyItem = async (id: string, partial: Partial<SupplyItem>) => {
    const next = {
      ...settings,
      supplyItems: settings.supplyItems.map((item) =>
        item.id === id ? { ...item, ...partial } : item
      ),
    };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const deleteSupplyItem = async (id: string) => {
    const next = {
      ...settings,
      supplyItems: settings.supplyItems.filter((item) => item.id !== id),
    };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, updateNormalFields, updateSimplifiedFields, updateFieldOrder, updateSimplifiedFieldOrder, addSupplyItem, updateSupplyItem, deleteSupplyItem }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
