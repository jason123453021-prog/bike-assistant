import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/android-apk.yml"),
  "utf8",
);

describe("GitHub Actions Android 驗收 APK 建置守門", () => {
  it("以官方 Expo prebuild 與 Gradle 建置 APK，不依賴 EAS 雲端建置", () => {
    expect(workflow).toContain(
      "npx expo prebuild --platform android --clean --no-install",
    );
    expect(workflow).toContain(
      "./gradlew assembleRelease --no-daemon --stacktrace",
    );
    expect(workflow).not.toMatch(/^\s+run:\s*eas\s+build\b/im);
    expect(workflow).not.toMatch(/^\s+run:\s*\|\s*\n\s*eas\s+build\b/im);
  });

  it("先完成品質檢查，並上傳可下載的 APK artifact", () => {
    expect(workflow).toContain("actions/setup-java@v5");
    expect(workflow).not.toContain("cache: gradle");
    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("bike-assistant-preview-apk");
  });

  it("在 main 推送後自動執行，且品質檢查一定先於原生建置與 APK 上傳", () => {
    const qualityGateIndex = workflow.indexOf("- name: 執行程式品質守門");
    const prebuildIndex = workflow.indexOf("- name: 產生 Android 原生專案");
    const gradleIndex = workflow.indexOf("- name: 建置可安裝的驗收 APK");
    const artifactIndex = workflow.indexOf("- name: 上傳 Android APK artifact");

    expect(workflow).toContain("branches: [main]");
    expect(qualityGateIndex).toBeGreaterThan(-1);
    expect(prebuildIndex).toBeGreaterThan(qualityGateIndex);
    expect(gradleIndex).toBeGreaterThan(prebuildIndex);
    expect(artifactIndex).toBeGreaterThan(gradleIndex);
  });
});
