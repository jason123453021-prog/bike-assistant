import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { calculateAgeFromBirthday, normalizeBirthday } from "./personal-profile";
import {
  DEFAULT_NAVIGATION_FIELD_ORDER,
  migrateLegacyNavigationDashboardDefaults,
  type NavigationDashboardFieldKey,
} from "./navigation-dashboard-defaults";
import {
  DEFAULT_TOUCH_GUARD_UNLOCK_HOLD_MS,
  TOUCH_GUARD_UNLOCK_HOLD_PRESETS,
} from "./live-ride-readings";

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
  showTotalAscent: boolean; // 累計爬升
  showCurrentAltitude: boolean; // 目前海拔
  showGradeDistribution: boolean; // 坡度分布
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
  showTotalAscent: boolean;  // 累計爬升
  showCurrentAltitude: boolean; // 目前海拔
}

// 儀表板欄位 key 型別
export type NormalFieldKey = NavigationDashboardFieldKey;
export type SimplifiedFieldKey = keyof SimplifiedModeFields;

// 預設欄位排序（與 NormalModeFields key 對應）
export const DEFAULT_FIELD_ORDER: NormalFieldKey[] = [
  ...DEFAULT_NAVIGATION_FIELD_ORDER,
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
  "showTotalAscent",
  "showCurrentAltitude",
];

// 補給品項目型別
export interface SupplyItem {
  id: string;                    // 唯一識別符
  name: string;                  // 補給品名稱
  target: "energy" | "water";   // 併入既有能量或補水提醒流程
  triggerType: "time" | "distance"; // 觸發方式：時間或距離
  triggerValue?: number;         // 觸發值（公里）- 距離觸發用
  triggerHours?: number;         // 時（時間觸發用）
  triggerMinutes?: number;       // 分（時間觸發用）
  triggerSeconds?: number;       // 秒（時間觸發用）
  enabled: boolean;              // 是否啟用
}

function normalizeSupplyItems(value: unknown): SupplyItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SupplyItem[] => {
    if (!item || typeof item !== "object") return [];
    const legacy = item as Record<string, unknown>;
    if (typeof legacy.id !== "string" || typeof legacy.name !== "string") return [];
    const triggerType = legacy.triggerType === "distance" ? "distance" : "time";
    return [{
      id: legacy.id,
      name: legacy.name.trim() || "自訂補給品",
      target: legacy.target === "water" ? "water" : "energy",
      triggerType,
      triggerValue: triggerType === "distance" && typeof legacy.triggerValue === "number" ? legacy.triggerValue : undefined,
      triggerHours: triggerType === "time" && typeof legacy.triggerHours === "number" ? legacy.triggerHours : undefined,
      triggerMinutes: triggerType === "time" && typeof legacy.triggerMinutes === "number" ? legacy.triggerMinutes : undefined,
      triggerSeconds: triggerType === "time" && typeof legacy.triggerSeconds === "number" ? legacy.triggerSeconds : undefined,
      enabled: legacy.enabled !== false,
    }];
  });
}

export type SupplyCalculationMode = "smart" | "custom";

export interface AppSettings {
  // Personal
  weight: number;       // kg 騎手體重
  height: number;       // cm
  /** 使用者唯一需填寫的出生日期；年齡每次由此值即時計算。 */
  birthday?: string;
  age: number;          // 騎手年齡（用於推算最大心率 MHR）
  ftp: number;          // Functional Threshold Power (watts)
  bikeWeight: number;   // kg 单軋+裝備總重
  /** 預設使用本機歷史推定 FTP 與心率基準；關閉後才完全採用手動數值。 */
  autoPersonalMetricsEnabled: boolean;
  /** 騎乘完成後自動寫入 App 推定 RPE；使用者仍可於活動編輯手動覆寫。 */
  autoRpeEnabled: boolean;
  // 心率區間校準
  maxHeartRate?: number;      // 最大心率（自動偵測或手動設定）
  restingHeartRate?: number;  // 靜息心率（自動估算或手動設定）
  /** 內部安全預設，僅供非智慧相容流程使用；不對使用者開放輸入。 */
  calorieThreshold: number;
  /** 內部安全預設，僅供非智慧相容流程使用；不對使用者開放輸入。 */
  waterThreshold: number;
  /** smart：依個人、騎乘與環境資料全自動調整提醒；custom：採用保守本機預設。 */
  supplyCalculationMode: SupplyCalculationMode;
  /** 由本機多次有效騎乘與智慧補水確認自動更新的汗率倍率，限制為保守範圍。 */
  sweatRateCalibrationMultiplier: number;
  sweatRateCalibrationCount: number;
  /** 防止同一筆已完成活動重複觸發自動汗率校正。 */
  sweatRateCalibrationLastRideId?: string;
  supplyReminderRepeatSec: number; // 0 = 不重複；>0 = 每幾秒重複語音提醒
  // 手動能量提醒：可依騎乘時間、距離或兩者提醒。
  supplyEnergyTimeIntervalEnabled: boolean;
  supplyEnergyTimeIntervalMinutes: number;
  supplyEnergyDistanceIntervalEnabled: boolean;
  supplyEnergyDistanceIntervalKm: number;
  // 手動補水提醒：可依騎乘時間、距離或兩者提醒。
  supplyWaterTimeIntervalEnabled: boolean;
  supplyWaterTimeIntervalMinutes: number;
  supplyWaterDistanceIntervalEnabled: boolean;
  supplyWaterDistanceIntervalKm: number;
  // 卡路里高級設定
  calorieRepeatUntilDismissed?: boolean; // 未關閉時重複提醒
  calorieAutoDismissSeconds?: number;    // 自動關閉延遲（秒）
  caloriePauseOnDownhill?: boolean;      // 長下坡暫停提醒
  // 水分高級設定
  waterRepeatUntilDismissed?: boolean;   // 未關閉時重複提醒
  waterAutoDismissSeconds?: number;      // 自動關閉延遲（秒）
  waterPauseOnDownhill?: boolean;        // 長下坡暫停提醒
  supplyItems: SupplyItem[];   // 自訂補給品清單
  // Feedback
  vibrationEnabled: boolean;
  ttsEnabled: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  // 精簡導航模式
  simplifiedNavMode: "off" | "manual" | "auto"; // off=關閉, manual=手動, auto=自動
  simplifiedNavIdleSec: number; // 自動模式開啟前的閒置秒數（預設 30 秒）
  // 騎乘防誤觸：鎖定時仍可直接閱讀資訊，僅阻擋地圖與控制誤觸
  touchGuardEnabled: boolean;
  /** 長按此毫秒數後解除騎乘防誤觸；設定頁僅提供 400、800、1200 ms。 */
  touchGuardUnlockHoldMs: number;
  /** 用來區分早期 1200 ms 預設與使用者後續手動選擇的自訂時間。 */
  touchGuardUnlockHoldMsSchemaVersion: number;
  // 背景 GPS 精度
  gpsAccuracy: "power_saving" | "standard" | "high_accuracy"; // 背景 GPS 更新頻率
  // 騎乘靜止後的完全自動省電定位：切換為低功耗監測，重新移動時自動恢復。
  idleAutoPauseEnabled: boolean;
  idleAutoPauseSeconds: number;
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
  showAvgSpeed: false,
  showCalories: false,
  showPausedTime: false,
  showTotalAscent: true,
  showCurrentAltitude: false,
  showGradeDistribution: false,
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
  showTotalAscent: false,
  showCurrentAltitude: false,
};

const DEFAULT_SETTINGS: AppSettings = {
  weight: 70,
  height: 175,
  age: 32,
  ftp: 200,
  bikeWeight: 10,
  autoPersonalMetricsEnabled: true,
  autoRpeEnabled: true,
  maxHeartRate: 200,
  restingHeartRate: 60,
  calorieThreshold: 300,
  waterThreshold: 500,
  // 新安裝預設使用全自動智慧計畫；舊自訂值只保留供相容性遷移，永不影響智慧模式。
  supplyCalculationMode: "smart",
  sweatRateCalibrationMultiplier: 1,
  sweatRateCalibrationCount: 0,
  supplyReminderRepeatSec: 60,
  // 升級後預設不主動開啟，須由使用者依自身補給策略各自啟用。
  supplyEnergyTimeIntervalEnabled: false,
  supplyEnergyTimeIntervalMinutes: 45,
  supplyEnergyDistanceIntervalEnabled: false,
  supplyEnergyDistanceIntervalKm: 20,
  supplyWaterTimeIntervalEnabled: false,
  supplyWaterTimeIntervalMinutes: 20,
  supplyWaterDistanceIntervalEnabled: false,
  supplyWaterDistanceIntervalKm: 10,
  supplyItems: [],
  vibrationEnabled: true,
  ttsEnabled: true,
  soundEnabled: true,
  notificationEnabled: true,
  simplifiedNavMode: "off",
  simplifiedNavIdleSec: 30,
  touchGuardEnabled: true,
  touchGuardUnlockHoldMs: DEFAULT_TOUCH_GUARD_UNLOCK_HOLD_MS,
  touchGuardUnlockHoldMsSchemaVersion: 2,
  gpsAccuracy: "standard",
  idleAutoPauseEnabled: true,
  idleAutoPauseSeconds: 120,
  normalModeFields: DEFAULT_NORMAL_FIELDS,
  simplifiedModeFields: DEFAULT_SIMPLIFIED_FIELDS,
  normalModeFieldOrder: DEFAULT_FIELD_ORDER,
  simplifiedModeFieldOrder: DEFAULT_SIMPLIFIED_FIELD_ORDER,
};

const SETTINGS_KEY = "@bike_settings";
export const TOUCH_GUARD_UNLOCK_HOLD_MS_SCHEMA_VERSION = 2;

/**
 * 舊版預設值曾是 1200 ms；僅未標記新版設定的資料才會遷移至 400 ms。
 * 目前設定頁只允許三個快速選項，既有的任意數值會安全收斂至最接近的選項。
 */
export function migrateTouchGuardUnlockHoldMs(value: unknown, schemaVersion?: unknown): number {
  const normalized = Number(value);
  if (Number(schemaVersion) !== TOUCH_GUARD_UNLOCK_HOLD_MS_SCHEMA_VERSION && normalized === 1200) {
    return DEFAULT_TOUCH_GUARD_UNLOCK_HOLD_MS;
  }
  if (!Number.isFinite(normalized)) return DEFAULT_TOUCH_GUARD_UNLOCK_HOLD_MS;
  return TOUCH_GUARD_UNLOCK_HOLD_PRESETS.reduce((nearest, preset) => (
    Math.abs(preset - normalized) < Math.abs(nearest - normalized) ? preset : nearest
  ));
}

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
        const {
          performanceMode: _performanceMode,
          autoPerformanceMode: _autoPerformanceMode,
          weeklyRideGoal: _weeklyRideGoal,
          weeklyDistanceGoalKm: _weeklyDistanceGoalKm,
          teamTelemetryEnabled: _teamTelemetryEnabled,
          showFriendDistance: _showFriendDistance,
          showFriendLocation: _showFriendLocation,
          ghostMode: _ghostMode,
          shareLocation: _shareLocation,
          autoCalibrationEnabled: _autoCalibrationEnabled,
          darkMode: _darkMode,
          weatherApiKey: _weatherApiKey,
          calorieThreshold: _legacyCalorieThreshold,
          waterThreshold: _legacyWaterThreshold,
          supplyIntervalReminderEnabled: legacyIntervalEnabled,
          supplyTimeIntervalEnabled: legacyTimeIntervalEnabled,
          supplyTimeIntervalMinutes: legacyTimeIntervalMinutes,
          supplyDistanceIntervalEnabled: legacyDistanceIntervalEnabled,
          supplyDistanceIntervalKm: legacyDistanceIntervalKm,
          ...savedWithoutRemovedSettings
        } = saved;
        const hasIndependentIntervalSettings = [
          "supplyEnergyTimeIntervalEnabled",
          "supplyEnergyDistanceIntervalEnabled",
          "supplyWaterTimeIntervalEnabled",
          "supplyWaterDistanceIntervalEnabled",
        ].some((key) => Object.prototype.hasOwnProperty.call(saved, key));
        const legacyIntervalActive = legacyIntervalEnabled === true;
        const migratedIntervalSettings = hasIndependentIntervalSettings ? {} : {
          supplyEnergyTimeIntervalEnabled: legacyIntervalActive && legacyTimeIntervalEnabled !== false,
          supplyEnergyTimeIntervalMinutes: legacyTimeIntervalMinutes ?? DEFAULT_SETTINGS.supplyEnergyTimeIntervalMinutes,
          supplyEnergyDistanceIntervalEnabled: legacyIntervalActive && legacyDistanceIntervalEnabled === true,
          supplyEnergyDistanceIntervalKm: legacyDistanceIntervalKm ?? DEFAULT_SETTINGS.supplyEnergyDistanceIntervalKm,
          supplyWaterTimeIntervalEnabled: legacyIntervalActive && legacyTimeIntervalEnabled !== false,
          supplyWaterTimeIntervalMinutes: legacyTimeIntervalMinutes ?? DEFAULT_SETTINGS.supplyWaterTimeIntervalMinutes,
          supplyWaterDistanceIntervalEnabled: legacyIntervalActive && legacyDistanceIntervalEnabled === true,
          supplyWaterDistanceIntervalKm: legacyDistanceIntervalKm ?? DEFAULT_SETTINGS.supplyWaterDistanceIntervalKm,
        };
        const {
          showHeartRate: _showHeartRate,
          showCadence: _showCadence,
          ...savedNormalModeFields
        } = saved.normalModeFields ?? {};
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
        const migratedDashboard = migrateLegacyNavigationDashboardDefaults(savedNormalModeFields, mergedOrder);
        const migratedUnlockHoldMs = migrateTouchGuardUnlockHoldMs(
          saved.touchGuardUnlockHoldMs,
          saved.touchGuardUnlockHoldMsSchemaVersion,
        );
        const nextSettings: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...savedWithoutRemovedSettings,
          ...migratedIntervalSettings,
          supplyItems: normalizeSupplyItems(saved.supplyItems),
          birthday: normalizeBirthday(saved.birthday),
          age: calculateAgeFromBirthday(saved.birthday) ?? saved.age ?? DEFAULT_SETTINGS.age,
          autoPersonalMetricsEnabled: true,
          autoRpeEnabled: true,
          normalModeFields: { ...DEFAULT_NORMAL_FIELDS, ...migratedDashboard.fields },
          simplifiedModeFields: { ...DEFAULT_SIMPLIFIED_FIELDS, ...(saved.simplifiedModeFields ?? {}) },
          normalModeFieldOrder: migratedDashboard.order,
          simplifiedModeFieldOrder: mergedSimplifiedOrder,
          touchGuardUnlockHoldMs: migratedUnlockHoldMs,
          touchGuardUnlockHoldMsSchemaVersion: TOUCH_GUARD_UNLOCK_HOLD_MS_SCHEMA_VERSION,
        };
        if (nextSettings.supplyEnergyTimeIntervalEnabled && nextSettings.supplyEnergyDistanceIntervalEnabled) {
          nextSettings.supplyEnergyDistanceIntervalEnabled = false;
        }
        if (nextSettings.supplyWaterTimeIntervalEnabled && nextSettings.supplyWaterDistanceIntervalEnabled) {
          nextSettings.supplyWaterDistanceIntervalEnabled = false;
        }
        setSettings(nextSettings);
        void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
      }
    });
  }, []);

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const birthday = partial.birthday !== undefined ? normalizeBirthday(partial.birthday) : settings.birthday;
    const next = {
      ...settings,
      ...partial,
      birthday,
      age: calculateAgeFromBirthday(birthday) ?? settings.age,
      autoPersonalMetricsEnabled: true,
      autoRpeEnabled: true,
      touchGuardUnlockHoldMsSchemaVersion: partial.touchGuardUnlockHoldMs !== undefined
        ? TOUCH_GUARD_UNLOCK_HOLD_MS_SCHEMA_VERSION
        : settings.touchGuardUnlockHoldMsSchemaVersion,
    };
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
    const normalized = normalizeSupplyItems([item])[0];
    if (!normalized) return;
    const next = {
      ...settings,
      supplyItems: [...settings.supplyItems, normalized],
    };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const updateSupplyItem = async (id: string, partial: Partial<SupplyItem>) => {
    const next = {
      ...settings,
      supplyItems: settings.supplyItems.flatMap((item) =>
        item.id === id ? normalizeSupplyItems([{ ...item, ...partial }]) : [item]
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
