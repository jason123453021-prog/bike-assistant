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
import { DEFAULT_ROAD_BIKE_MASS_KG } from "./power-calc";
import type { SportType } from "./sport-metrics";

export const MIN_BIKE_WEIGHT_KG = 3;
export const MAX_BIKE_WEIGHT_KG = 35;
export const AUTO_LAP_DISTANCE_PRESETS_KM = [1, 5, 10] as const;
export type AppearanceMode = "system" | "light" | "dark";
const SPORT_TYPES: SportType[] = ["cycling", "running", "hiking", "trail_running"];

function normalizeDefaultSportType(value: unknown): SportType {
  return typeof value === "string" && SPORT_TYPES.includes(value as SportType)
    ? value as SportType
    : "cycling";
}

/** 將舊版或任意輸入收斂為儀表板可讀、可驗證的常用自動計圈距離。 */
export function normalizeAutoLapDistanceKm(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 5;
  return AUTO_LAP_DISTANCE_PRESETS_KM.reduce((nearest, preset) => (
    Math.abs(preset - numeric) < Math.abs(nearest - numeric) ? preset : nearest
  ));
}

/** 將舊設定、手動輸入與重設流程收斂至適用於公路車、通勤車與輕型電輔車的安全範圍。 */
export function normalizeBikeWeightKg(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_ROAD_BIKE_MASS_KG;
  return Math.min(MAX_BIKE_WEIGHT_KG, Math.max(MIN_BIKE_WEIGHT_KG, Math.round(numeric * 10) / 10));
}

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
  bikeWeight: number;   // kg 自行車與隨車裝備總重
  /** 全域自動計圈主開關；關閉時不建立距離分段。 */
  lapEnabled: boolean;
  /** 每次累計達此距離（km）自動建立一筆分段。 */
  autoLapDistanceKm: number;
  /** 下次開始騎乘時預先選取的運動類型；不會改寫進行中的活動。 */
  defaultSportType: SportType;
  /** 單車模式的自動暫停速度閾值（km/h）；仍須通過模型治理的連續低速防抖。 */
  autoPauseSpeedThresholdKmh: number;
  /** 跟隨系統、固定淺色或固定深色的全域外觀偏好。 */
  appearanceMode: AppearanceMode;
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
  /** 智慧能量倒數的獨立開關；可與智慧補水分別使用。 */
  smartEnergySupplyEnabled: boolean;
  /** 智慧補水倒數的獨立開關；可與智慧能量分別使用。 */
  smartWaterSupplyEnabled: boolean;
  /** 補給與補水提醒的總開關；關閉時保留所有偏好設定但不再觸發任何提醒。 */
  supplyReminderEnabled: boolean;
  /** 由本機多次有效騎乘與智慧補水確認自動更新的汗率倍率，限制為保守範圍。 */
  sweatRateCalibrationMultiplier: number;
  sweatRateCalibrationCount: number;
  /** 防止同一筆已完成活動重複觸發自動汗率校正。 */
  sweatRateCalibrationLastRideId?: string;
  /** 唯一的未確認補給重複提醒設定：0 = 關閉；>0 = 每幾秒重複提醒。 */
  supplyReminderRepeatSec: number;
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
  calorieAutoDismissSeconds?: number;    // 自動關閉延遲（秒）
  // 水分高級設定
  waterAutoDismissSeconds?: number;      // 自動關閉延遲（秒）
  supplyItems: SupplyItem[];   // 自訂補給品清單
  // Feedback
  vibrationEnabled: boolean;
  ttsEnabled: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  // 精簡導航模式
  simplifiedNavMode: "off" | "manual" | "auto"; // off=關閉, manual=手動, auto=自動
  simplifiedNavIdleSec: number; // 自動模式開啟前的閒置秒數（預設 30 秒）
  /** 使用者平移或旋轉地圖後，多久自動回到目前位置；不改變使用者選擇的方向。 */
  autoRecenterSec: number;
  // 騎乘防誤觸：鎖定時仍可直接閱讀資訊，僅阻擋地圖與控制誤觸
  touchGuardEnabled: boolean;
  /** 長按此毫秒數後解除騎乘防誤觸；設定頁僅提供 400、800、1200 ms。 */
  touchGuardUnlockHoldMs: number;
  /** 用來區分早期 1200 ms 預設與使用者後續手動選擇的自訂時間。 */
  touchGuardUnlockHoldMsSchemaVersion: number;
  /** 解鎖後重新自動鎖定的秒數；只在騎乘進行中生效。 */
  touchGuardAutoRelockSec: number;
  /** 一包能量補給品可提供的碳水克數，供智慧能量倒數與路線攜帶規劃共用。 */
  energyServingCarbohydrateG: number;
  /** 每小時碳水上限可由科學建議推導或由使用者手動設定。 */
  energyCarbohydrateHourlyLimitMode: "science" | "manual";
  /** 手動模式的每小時碳水上限；科學模式保留此值以便隨時切回手動。 */
  energyCarbohydrateHourlyLimitG: number;
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
  bikeWeight: DEFAULT_ROAD_BIKE_MASS_KG,
  lapEnabled: true,
  autoLapDistanceKm: 5,
  defaultSportType: "cycling",
  autoPauseSpeedThresholdKmh: 1.1,
  appearanceMode: "system",
  autoPersonalMetricsEnabled: true,
  autoRpeEnabled: true,
  maxHeartRate: 200,
  restingHeartRate: 60,
  calorieThreshold: 300,
  waterThreshold: 500,
  // 新安裝預設使用全自動智慧計畫；舊自訂值只保留供相容性遷移，永不影響智慧模式。
  supplyCalculationMode: "smart",
  smartEnergySupplyEnabled: true,
  smartWaterSupplyEnabled: true,
  supplyReminderEnabled: true,
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
  autoRecenterSec: 12,
  touchGuardEnabled: true,
  touchGuardUnlockHoldMs: DEFAULT_TOUCH_GUARD_UNLOCK_HOLD_MS,
  touchGuardUnlockHoldMsSchemaVersion: 2,
  touchGuardAutoRelockSec: 3,
  energyServingCarbohydrateG: 25,
  energyCarbohydrateHourlyLimitMode: "science",
  energyCarbohydrateHourlyLimitG: 60,
  gpsAccuracy: "standard",
  idleAutoPauseEnabled: true,
  idleAutoPauseSeconds: 120,
  normalModeFields: DEFAULT_NORMAL_FIELDS,
  simplifiedModeFields: DEFAULT_SIMPLIFIED_FIELDS,
  normalModeFieldOrder: DEFAULT_FIELD_ORDER,
  simplifiedModeFieldOrder: DEFAULT_SIMPLIFIED_FIELD_ORDER,
};

function createDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    supplyItems: [],
    normalModeFields: { ...DEFAULT_SETTINGS.normalModeFields },
    simplifiedModeFields: { ...DEFAULT_SETTINGS.simplifiedModeFields },
    normalModeFieldOrder: [...DEFAULT_SETTINGS.normalModeFieldOrder],
    simplifiedModeFieldOrder: [...DEFAULT_SETTINGS.simplifiedModeFieldOrder],
  };
}

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
  /** 僅重設 @bike_settings 的偏好值；不會讀取、修改或刪除騎乘活動、軌跡或相片。 */
  resetAllSettings: () => Promise<void>;
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
  const [settings, setSettings] = useState<AppSettings>(() => createDefaultSettings());

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
          calorieRepeatUntilDismissed: _legacyCalorieRepeatUntilDismissed,
          waterRepeatUntilDismissed: _legacyWaterRepeatUntilDismissed,
          caloriePauseOnDownhill: _legacyCaloriePauseOnDownhill,
          waterPauseOnDownhill: _legacyWaterPauseOnDownhill,
          lapMode: _legacyLapMode,
          daylightAlertEnabled: _legacyDaylightAlertEnabled,
          daylightAlertLeadMinutes: _legacyDaylightAlertLeadMinutes,
          daylightAlertMode: _legacyDaylightAlertMode,
          ...savedWithoutRemovedSettings
        } = saved;
        const hasIndependentIntervalSettings = [
          "supplyEnergyTimeIntervalEnabled",
          "supplyEnergyDistanceIntervalEnabled",
          "supplyWaterTimeIntervalEnabled",
          "supplyWaterDistanceIntervalEnabled",
        ].some((key) => Object.prototype.hasOwnProperty.call(saved, key));
        const legacyIntervalActive = legacyIntervalEnabled === true;
        const legacySmartEnabled = saved.supplyCalculationMode !== "custom";
        const smartEnergySupplyEnabled = typeof saved.smartEnergySupplyEnabled === "boolean"
          ? saved.smartEnergySupplyEnabled
          : legacySmartEnabled;
        const smartWaterSupplyEnabled = typeof saved.smartWaterSupplyEnabled === "boolean"
          ? saved.smartWaterSupplyEnabled
          : legacySmartEnabled;
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
          smartEnergySupplyEnabled,
          smartWaterSupplyEnabled,
          supplyCalculationMode: smartEnergySupplyEnabled || smartWaterSupplyEnabled ? "smart" : "custom",
          // 舊版資料沒有此欄位時，維持既有補給提醒可用；只有明確 false 才關閉。
          supplyReminderEnabled: saved.supplyReminderEnabled !== false,
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
          touchGuardAutoRelockSec: Math.min(60, Math.max(1, Number(saved.touchGuardAutoRelockSec) || DEFAULT_SETTINGS.touchGuardAutoRelockSec)),
          autoRecenterSec: Math.min(60, Math.max(3, Number(saved.autoRecenterSec) || DEFAULT_SETTINGS.autoRecenterSec)),
          bikeWeight: normalizeBikeWeightKg(saved.bikeWeight),
          lapEnabled: saved.lapEnabled !== false,
          autoLapDistanceKm: normalizeAutoLapDistanceKm(saved.autoLapDistanceKm),
          defaultSportType: normalizeDefaultSportType(saved.defaultSportType),
          autoPauseSpeedThresholdKmh: Math.min(5, Math.max(0.5, Number.isFinite(Number(saved.autoPauseSpeedThresholdKmh)) ? Number(saved.autoPauseSpeedThresholdKmh) : 1.1)),
          appearanceMode: saved.appearanceMode === "light" || saved.appearanceMode === "dark" ? saved.appearanceMode : "system",
          energyServingCarbohydrateG: Math.min(100, Math.max(10, Number(saved.energyServingCarbohydrateG) || DEFAULT_SETTINGS.energyServingCarbohydrateG)),
          energyCarbohydrateHourlyLimitMode: saved.energyCarbohydrateHourlyLimitMode === "manual" ? "manual" : "science",
          energyCarbohydrateHourlyLimitG: Math.min(90, Math.max(20, Number(saved.energyCarbohydrateHourlyLimitG) || DEFAULT_SETTINGS.energyCarbohydrateHourlyLimitG)),
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
    const legacyModeOverride = partial.supplyCalculationMode;
    const nextEnergySmartEnabled = partial.smartEnergySupplyEnabled
      ?? (legacyModeOverride !== undefined ? legacyModeOverride === "smart" : settings.smartEnergySupplyEnabled);
    const nextWaterSmartEnabled = partial.smartWaterSupplyEnabled
      ?? (legacyModeOverride !== undefined ? legacyModeOverride === "smart" : settings.smartWaterSupplyEnabled);
    const next = {
      ...settings,
      ...partial,
      birthday,
      bikeWeight: normalizeBikeWeightKg(partial.bikeWeight ?? settings.bikeWeight),
      lapEnabled: partial.lapEnabled ?? settings.lapEnabled,
      autoLapDistanceKm: normalizeAutoLapDistanceKm(partial.autoLapDistanceKm ?? settings.autoLapDistanceKm),
      defaultSportType: normalizeDefaultSportType(partial.defaultSportType ?? settings.defaultSportType),
      autoPauseSpeedThresholdKmh: Math.min(5, Math.max(0.5, Number.isFinite(Number(partial.autoPauseSpeedThresholdKmh)) ? Number(partial.autoPauseSpeedThresholdKmh) : settings.autoPauseSpeedThresholdKmh)),
      appearanceMode: partial.appearanceMode === "light" || partial.appearanceMode === "dark" || partial.appearanceMode === "system"
        ? partial.appearanceMode
        : settings.appearanceMode,
      age: calculateAgeFromBirthday(birthday) ?? settings.age,
      smartEnergySupplyEnabled: nextEnergySmartEnabled,
      smartWaterSupplyEnabled: nextWaterSmartEnabled,
      supplyCalculationMode: nextEnergySmartEnabled || nextWaterSmartEnabled ? "smart" : "custom" as SupplyCalculationMode,
      autoPersonalMetricsEnabled: true,
      autoRpeEnabled: true,
      touchGuardUnlockHoldMsSchemaVersion: partial.touchGuardUnlockHoldMs !== undefined
        ? TOUCH_GUARD_UNLOCK_HOLD_MS_SCHEMA_VERSION
        : settings.touchGuardUnlockHoldMsSchemaVersion,
    };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const resetAllSettings = async () => {
    const next = createDefaultSettings();
    // 只覆寫設定專用 key；騎乘活動、軌跡、相片與活動統計使用其他本機資料，不會被清除。
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setSettings(next);
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
    <SettingsContext.Provider value={{ settings, updateSettings, resetAllSettings, updateNormalFields, updateSimplifiedFields, updateFieldOrder, updateSimplifiedFieldOrder, addSupplyItem, updateSupplyItem, deleteSupplyItem }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
