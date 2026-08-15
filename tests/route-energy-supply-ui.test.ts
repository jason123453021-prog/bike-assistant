import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const navigateSource = readFileSync(resolve(process.cwd(), "app/(tabs)/navigate.tsx"), "utf8");

describe("GPX energy supply carry UI", () => {
  it("shows automatic minimum and maximum energy servings in the route confirmation card", () => {
    expect(navigateSource).toContain("建議攜帶能量補給");
    expect(navigateSource).toContain("最少攜帶");
    expect(navigateSource).toContain("最多攜帶");
    expect(navigateSource).toContain("routeEstimate.energySupplyCarry.minimumServings");
    expect(navigateSource).toContain("routeEstimate.energySupplyCarry.maximumServings");
    expect(navigateSource).toContain("每份約 {routeEstimate.energySupplyCarry.standardServingCarbohydrateG} g 碳水");
  });
});
