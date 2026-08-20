import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const appConfigSource = readFileSync(resolve(projectRoot, "app.config.ts"), "utf8");

describe("正式版 OTA 更新政策", () => {
  it("停用 Expo OTA 更新與自動更新檢查", () => {
    expect(appConfigSource).toContain("updates: {");
    expect(appConfigSource).toContain("enabled: false");
    expect(appConfigSource).toContain('checkAutomatically: "NEVER"');
  });

  it("保留 Expo Go 開發 bundle 與正式 AAB OTA 的流程邊界說明", () => {
    expect(appConfigSource).toContain("Expo Go 的 Metro development bundle");
    expect(appConfigSource).toContain("isProductionEasBuild");
  });
});
