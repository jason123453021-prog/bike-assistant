import { describe, expect, it } from "vitest";

// CommonJS script is intentional: GitHub Actions invokes it after Expo prebuild,
// before Gradle receives the protected upload-key environment variables.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyAndroidReleaseSigningConfig } = require("../scripts/android-release-signing.cjs") as {
  applyAndroidReleaseSigningConfig: (source: string) => string;
};

describe("Google Play Android release signing configuration", () => {
  const generatedGradle = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}`;

  it("injects a protected upload-key configuration and uses it only for release", () => {
    const result = applyAndroidReleaseSigningConfig(generatedGradle);

    expect(result).toContain("release {\n            storeFile file(System.getenv('PLAY_UPLOAD_KEYSTORE_PATH'))");
    expect(result).toContain("keyAlias System.getenv('PLAY_UPLOAD_KEY_ALIAS')");
    expect(result).toContain("release {\n            signingConfig signingConfigs.release");
    expect(result).toContain("debug {\n            signingConfig signingConfigs.debug");
  });

  it("rejects an unexpected generated Gradle layout instead of silently using debug signing", () => {
    expect(() => applyAndroidReleaseSigningConfig("android { }")).toThrow(
      "找不到 Android Gradle 的 signingConfigs 或 buildTypes 區塊。",
    );
  });
});
