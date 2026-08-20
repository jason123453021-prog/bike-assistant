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
    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("bike-assistant-preview-apk");
  });
});
