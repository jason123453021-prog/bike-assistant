import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settingsSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/settings.tsx"),
  "utf8",
);
const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
);
const routeSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/navigate.tsx"),
  "utf8",
);

describe("單次能量補給碳水設定", () => {
  it("在智慧補給區清楚顯示目前份量，並提供 10–100 g 的設定入口", () => {
    expect(settingsSource).toContain('t("settingsDetail.smartBothHint", {');
    expect(settingsSource).toContain('t("settingsDetail.smartEnergy")');
    expect(settingsSource).toContain('t("settingsDetail.smartHydration")');
    expect(settingsSource).toContain(
      't("settingsDetail.servingCarbohydrate")',
    );
    expect(settingsSource).toContain(
      't("settingsDetail.servingCarbohydrateHint")',
    );
    expect(settingsSource).toMatch(/openEdit\(\s*"energyServingCarbohydrateG"/);
  });

  it("將同一份量傳入即時智慧補給與 GPX 路線估算", () => {
    expect(mapSource).toContain(
      "energyServingCarbohydrateG: settings.energyServingCarbohydrateG",
    );
    expect(routeSource).toContain(
      "energyServingCarbohydrateG: settings.energyServingCarbohydrateG",
    );
  });
});
