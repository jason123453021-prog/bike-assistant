import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appConfigSource = readFileSync(
  resolve(process.cwd(), "app.config.ts"),
  "utf8",
);

describe("Expo Go runtime 相容性", () => {
  it("僅讓 production EAS AAB 固定 runtimeVersion，避免 Expo Go 開發 bundle 與已安裝 SDK runtime 不相容", () => {
    expect(appConfigSource).toContain(
      'const isProductionEasBuild = process.env.EAS_BUILD_PROFILE === "production"',
    );
    expect(appConfigSource).toContain('version: "1.0.94"');
    expect(appConfigSource).toContain("versionCode: 10094");
    expect(appConfigSource).toContain(
      'runtimeVersion: isProductionEasBuild ? "1.0.94" : undefined',
    );
    expect(appConfigSource).not.toContain('runtimeVersion: "1.0.94",');
  });
});
