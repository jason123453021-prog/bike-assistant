import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configSource = readFileSync(resolve(process.cwd(), "app.config.ts"), "utf8");
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
    expect(configSource).toContain('"android.permission.SYSTEM_ALERT_WINDOW"');
  });

  it("uses Expo-supported release optimization and required asset plugins", () => {
    expect(configSource).toContain("enableMinifyInReleaseBuilds: true");
    expect(configSource).toContain("enableShrinkResourcesInReleaseBuilds: true");
    expect(configSource).toContain('"expo-font"');
    expect(configSource).toContain('"expo-asset"');
  });

  it("uses the current EAS Android app-bundle profile without obsolete submit credentials", () => {
    expect(easConfig.build.production.android.buildType).toBe("app-bundle");
    expect(easConfig.submit).toBeUndefined();
  });
});
