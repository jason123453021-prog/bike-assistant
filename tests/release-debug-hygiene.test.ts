import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("release debug hygiene", () => {
  it("keeps high-frequency ride and startup paths free of development console logs", () => {
    for (const path of [
      "app/(tabs)/map.tsx",
      "lib/background-location.ts",
      "lib/_core/manus-runtime.ts",
      "lib/power-saving/smart-power-saving-system.ts",
      "lib/route-service.ts",
    ]) {
      expect(read(path)).not.toMatch(/console\.(log|info|debug)\(/);
    }
  });

  it("enables release optimization and disables the development network inspector", () => {
    const gradleProperties = read("android/gradle.properties");
    const configSource = read("app.config.ts");
    expect(gradleProperties).toContain("EX_DEV_CLIENT_NETWORK_INSPECTOR=false");
    expect(configSource).toContain("enableMinifyInReleaseBuilds: isProductionEasBuild");
    expect(configSource).toContain("enableShrinkResourcesInReleaseBuilds: isProductionEasBuild");
  });
});
