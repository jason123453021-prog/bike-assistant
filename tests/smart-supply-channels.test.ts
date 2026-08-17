import { describe, expect, it } from "vitest";

import {
  deriveSupplyCalculationMode,
  isSmartSupplyChannelEnabled,
  resolveSmartSupplyChannels,
} from "../lib/smart-supply-channels";

describe("獨立智慧能量與補水開關", () => {
  it.each([
    [true, true, { energy: true, water: true }, "smart"],
    [true, false, { energy: true, water: false }, "smart"],
    [false, true, { energy: false, water: true }, "smart"],
    [false, false, { energy: false, water: false }, "custom"],
  ] as const)("支援能量=%s、補水=%s 的組合", (energy, water, expected, mode) => {
    const settings = {
      supplyCalculationMode: mode,
      smartEnergySupplyEnabled: energy,
      smartWaterSupplyEnabled: water,
    } as const;

    expect(resolveSmartSupplyChannels(settings)).toEqual(expected);
    expect(isSmartSupplyChannelEnabled(settings, "calorie")).toBe(expected.energy);
    expect(isSmartSupplyChannelEnabled(settings, "water")).toBe(expected.water);
    expect(deriveSupplyCalculationMode(energy, water)).toBe(mode);
  });

  it("將未含新欄位的舊版共用智慧模式遷移為雙通道智慧", () => {
    expect(resolveSmartSupplyChannels({ supplyCalculationMode: "smart" })).toEqual({ energy: true, water: true });
    expect(resolveSmartSupplyChannels({ supplyCalculationMode: "custom" })).toEqual({ energy: false, water: false });
  });
});
