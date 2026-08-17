export type SmartSupplyKind = "calorie" | "water";

export interface SmartSupplyChannelSettings {
  supplyCalculationMode?: "smart" | "custom";
  smartEnergySupplyEnabled?: boolean;
  smartWaterSupplyEnabled?: boolean;
}

/**
 * 將舊版共用智慧模式安全遷移為兩個可獨立啟用的通道。
 * 既有未含新欄位的智慧模式保留雙通道啟用；自訂模式則維持雙通道關閉。
 */
export function resolveSmartSupplyChannels(settings: SmartSupplyChannelSettings): {
  energy: boolean;
  water: boolean;
} {
  const legacySmartEnabled = settings.supplyCalculationMode === "smart";
  return {
    energy: settings.smartEnergySupplyEnabled ?? legacySmartEnabled,
    water: settings.smartWaterSupplyEnabled ?? legacySmartEnabled,
  };
}

export function isSmartSupplyChannelEnabled(
  settings: SmartSupplyChannelSettings,
  kind: SmartSupplyKind,
): boolean {
  const channels = resolveSmartSupplyChannels(settings);
  return kind === "calorie" ? channels.energy : channels.water;
}

export function deriveSupplyCalculationMode(energyEnabled: boolean, waterEnabled: boolean): "smart" | "custom" {
  return energyEnabled || waterEnabled ? "smart" : "custom";
}
