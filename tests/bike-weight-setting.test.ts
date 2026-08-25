import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MAX_BIKE_WEIGHT_KG,
  MIN_BIKE_WEIGHT_KG,
  normalizeBikeWeightKg,
} from "../lib/settings-context";
import { calculatePower, DEFAULT_ROAD_BIKE_MASS_KG } from "../lib/power-calc";

const projectRoot = resolve(process.cwd());
const settingsSource = readFileSync(
  resolve(projectRoot, "app/(tabs)/settings.tsx"),
  "utf8",
);
const mapSource = readFileSync(
  resolve(projectRoot, "app/(tabs)/map.tsx"),
  "utf8",
);
const navigateSource = readFileSync(
  resolve(projectRoot, "app/(tabs)/navigate.tsx"),
  "utf8",
);
const backgroundSource = readFileSync(
  resolve(projectRoot, "lib/background-location.ts"),
  "utf8",
);
const routeTimeSource = readFileSync(
  resolve(projectRoot, "lib/route-time-estimator.ts"),
  "utf8",
);

describe("自行車重量設定", () => {
  it("以 9 kg 作為本機預設，並安全收斂使用者輸入至 3–35 kg", () => {
    expect(DEFAULT_ROAD_BIKE_MASS_KG).toBe(9);
    expect(MIN_BIKE_WEIGHT_KG).toBe(3);
    expect(MAX_BIKE_WEIGHT_KG).toBe(35);
    expect(normalizeBikeWeightKg(undefined)).toBe(9);
    expect(normalizeBikeWeightKg(2)).toBe(3);
    expect(normalizeBikeWeightKg(8.26)).toBe(8.3);
    expect(normalizeBikeWeightKg(42)).toBe(35);
  });

  it("使較重的自行車在相同騎士、速度與坡度下需要較高的虛擬功率", () => {
    const sharedInput = {
      speedMs: 20 / 3.6,
      prevSpeedMs: 20 / 3.6,
      intervalSec: 3,
      gradePct: 5,
      windSpeedMs: 0,
      riderMassKg: 70,
    };
    const lightBike = calculatePower({ ...sharedInput, bikeMassKg: 6 });
    const heavyBike = calculatePower({ ...sharedInput, bikeMassKg: 20 });

    expect(heavyBike).toBeGreaterThan(lightBike);
  });

  it("在設定頁顯示輸入入口，並將值傳入即時、背景與 GPX 路線資料鏈", () => {
    expect(settingsSource).toContain("自行車重量");
    expect(settingsSource).toContain("可設定 3–35 kg");
    expect(settingsSource).toMatch(/openEdit\(\s*"bikeWeight"/);
    expect(mapSource).toContain(
      "bikeMassKg: settings.bikeWeight ?? DEFAULT_ROAD_BIKE_MASS_KG",
    );
    expect(mapSource).toContain(
      "bikeWeightKg: settings.bikeWeight ?? DEFAULT_ROAD_BIKE_MASS_KG",
    );
    expect(navigateSource).toContain(
      "const bikeKg = settings.bikeWeight ?? DEFAULT_ROAD_BIKE_MASS_KG",
    );
    expect(backgroundSource).toContain(
      "bikeWeightKg: DEFAULT_ROAD_BIKE_MASS_KG",
    );
    expect(routeTimeSource).toContain(
      "input.bikeWeightKg ?? DEFAULT_ROAD_BIKE_MASS_KG",
    );
  });
});
