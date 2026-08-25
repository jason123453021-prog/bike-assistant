import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const navigateSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/navigate.tsx"),
  "utf8",
);

describe("GPX energy supply carry UI", () => {
  it("shows automatic minimum and maximum energy servings in the route confirmation card", () => {
    expect(navigateSource).toContain('t("routes.energyCarry")');
    expect(navigateSource).toContain('t("routes.minimumCarry")');
    expect(navigateSource).toContain('t("routes.maximumCarry")');
    expect(navigateSource).toContain(
      "routeEstimate.energySupplyCarry.minimumServings",
    );
    expect(navigateSource).toContain(
      "routeEstimate.energySupplyCarry.maximumServings",
    );
    expect(navigateSource).toContain('t("routes.servingCarbohydrate"');
    expect(navigateSource).toMatch(
      /routeEstimate\.energySupplyCarry\s*\.standardServingCarbohydrateG/,
    );
  });
});
