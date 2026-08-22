/**
 * 離線運動模型治理層。
 *
 * 所有數字僅作為一般性運動估算，不構成醫療或營養處方；更新時必須以可追溯的
 * 學術來源、版本號與回歸測試一併提交，並保留完全離線運作。
 */
export type GovernedSportType = "cycling" | "running" | "hiking" | "trail_running";

export interface SportModelProfile {
  label: string;
  tracking: {
    gpsDistanceIntervalM: number;
    stationaryDriftThresholdM: number;
    autoPauseMode: "automatic" | "suggest";
    autoPauseSpeedBelowKmh: number;
    autoPauseStillForSeconds: number;
    requiresStillness: boolean;
  };
  calorieMetMultiplier: number;
  supply: {
    carbohydrateRateMultiplier: number;
    hydrationRateMultiplier: number;
  };
}

export const MODEL_GOVERNANCE = {
  version: "2026.08.22-r2",
  updatePolicy: "離線內建資料；僅在來源審核、版本號更新與回歸測試同時通過後更新。",
  sources: [
    {
      id: "adult-compendium-2024",
      title: "2024 Adult Compendium of Physical Activities",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10818145/",
      role: "MET 基準與活動分類",
    },
    {
      id: "minetti-2002",
      title: "Energy cost of walking and running at extreme uphill and downhill slopes",
      url: "https://pubmed.ncbi.nlm.nih.gov/12183501/",
      role: "坡度跑步與 GAP 的透明能耗近似",
    },
    {
      id: "martin-1998",
      title: "Validation of a Mathematical Model for Road Cycling Power",
      url: "https://pubmed.ncbi.nlm.nih.gov/28121252/",
      role: "單車空阻、滾阻、坡度與速度的物理功率模型",
    },
    {
      id: "acsm-fluid-replacement",
      title: "ACSM Position Stand: Exercise and Fluid Replacement",
      url: "https://pubmed.ncbi.nlm.nih.gov/17277604/",
      role: "以個體汗率和運動條件調整補水節奏的原則",
    },
    {
      id: "endurance-carbohydrates-2023",
      title: "Carbohydrates and Endurance Exercise: A Narrative Review",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10054587/",
      role: "耐力運動碳水補給節奏的保守範圍",
    },
  ],
} as const;

export const SPORT_MODEL_PROFILES: Record<GovernedSportType, SportModelProfile> = {
  cycling: {
    label: "單車",
    tracking: { gpsDistanceIntervalM: 3, stationaryDriftThresholdM: 1.5, autoPauseMode: "automatic", autoPauseSpeedBelowKmh: 1.08, autoPauseStillForSeconds: 8, requiresStillness: false },
    calorieMetMultiplier: 1,
    supply: { carbohydrateRateMultiplier: 1, hydrationRateMultiplier: 1 },
  },
  running: {
    label: "跑步",
    tracking: { gpsDistanceIntervalM: 3, stationaryDriftThresholdM: 1.2, autoPauseMode: "automatic", autoPauseSpeedBelowKmh: 3, autoPauseStillForSeconds: 18, requiresStillness: true },
    calorieMetMultiplier: 1,
    supply: { carbohydrateRateMultiplier: 1.02, hydrationRateMultiplier: 1 },
  },
  hiking: {
    label: "登山／爬山",
    tracking: { gpsDistanceIntervalM: 1.5, stationaryDriftThresholdM: 0.35, autoPauseMode: "suggest", autoPauseSpeedBelowKmh: 0.35, autoPauseStillForSeconds: 150, requiresStillness: false },
    calorieMetMultiplier: 1,
    supply: { carbohydrateRateMultiplier: 0.9, hydrationRateMultiplier: 0.95 },
  },
  trail_running: {
    label: "越野跑",
    tracking: { gpsDistanceIntervalM: 3, stationaryDriftThresholdM: 1.2, autoPauseMode: "automatic", autoPauseSpeedBelowKmh: 2.4, autoPauseStillForSeconds: 28, requiresStillness: true },
    calorieMetMultiplier: 1.03,
    supply: { carbohydrateRateMultiplier: 1.05, hydrationRateMultiplier: 1.08 },
  },
};

let activeModelVersion: string = MODEL_GOVERNANCE.version;
let activeSportModelProfiles: Record<GovernedSportType, SportModelProfile> = SPORT_MODEL_PROFILES;
let modelRevision = 0;
const modelUpdateListeners = new Set<(revision: number) => void>();

export function getActiveModelVersion(): string {
  return activeModelVersion;
}

export function getModelRevision(): number {
  return modelRevision;
}

export function subscribeModelUpdates(listener: (revision: number) => void): () => void {
  modelUpdateListeners.add(listener);
  return () => modelUpdateListeners.delete(listener);
}

export function getActiveSportModelProfiles(): Record<GovernedSportType, SportModelProfile> {
  return activeSportModelProfiles;
}

/** 僅由完成結構與 SHA-256 驗證的更新服務呼叫。 */
export function applyVerifiedSportModelProfiles(version: string, profiles: Record<GovernedSportType, SportModelProfile>) {
  activeModelVersion = version;
  activeSportModelProfiles = profiles;
  modelRevision += 1;
  modelUpdateListeners.forEach((listener) => listener(modelRevision));
}

export function getSportModelProfile(sportType: GovernedSportType = "cycling"): SportModelProfile {
  return activeSportModelProfiles[sportType];
}
