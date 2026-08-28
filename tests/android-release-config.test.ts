import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configSource = readFileSync(resolve(process.cwd(), "app.config.ts"), "utf8");
const packageSource = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
const easConfig = JSON.parse(readFileSync(resolve(process.cwd(), "eas.json"), "utf8")) as {
  build: { production: { android: { buildType: string } } };
  submit?: unknown;
};

describe("Android 15/16 release configuration", () => {
  it("avoids app-level boot receivers and portrait-only orientation while retaining target API 36", () => {
    expect(configSource).toContain('orientation: "default"');
    expect(configSource).toContain("supportsTablet: true");
    expect(configSource).toContain("targetSdkVersion: 36");
    expect(configSource).not.toContain("with-audio-boot-receiver-fix");
    expect(configSource).not.toContain("with-foreground-service-plugin");
    expect(configSource).toContain("blockedPermissions");
    expect(configSource).toContain('"android.permission.RECEIVE_BOOT_COMPLETED"');
    expect(configSource).not.toContain('"android.permission.SYSTEM_ALERT_WINDOW"');
  });

  it("enables R8 and resource shrinking for every release variant", () => {
    expect(configSource).toContain('const isProductionEasBuild = process.env.EAS_BUILD_PROFILE === "production"');
    expect(configSource).toContain("enableMinifyInReleaseBuilds: true");
    expect(configSource).toContain("enableShrinkResourcesInReleaseBuilds: true");
    expect(configSource).toContain("with-android-release-optimization.cjs");
    expect(configSource).toContain('"expo-font"');
    expect(configSource).toContain('"expo-asset"');
  });

  it("uses Android 15/16 platform-default edge-to-edge without deprecated navigation-bar configuration", () => {
    expect(configSource).not.toContain("edgeToEdgeEnabled");
    expect(configSource).not.toContain('"expo-navigation-bar"');
    expect(packageSource).not.toContain('"expo-navigation-bar"');
  });

  it("uses the Expo SDK 57 default new architecture for Reanimated 4", () => {
    expect(configSource).not.toContain("newArchEnabled:");
    expect(packageSource).toContain('"react-native-reanimated"');
    expect(packageSource).toContain('"react-native": "0.86.3"');
  });

  it("uses the current EAS Android app-bundle profile without obsolete submit credentials", () => {
    expect(easConfig.build.production.android.buildType).toBe("app-bundle");
    expect(easConfig.submit).toBeUndefined();
  });
});
