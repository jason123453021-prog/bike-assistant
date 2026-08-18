import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Android ride PiP integration", () => {
  it("declares a prebuild-safe Kotlin PiP integration without an overlay permission", () => {
    const config = read("app.config.ts");
    const plugin = read("plugins/with-bike-ride-pip.js");

    expect(config).toContain('"./plugins/with-bike-ride-pip"');
    expect(plugin).toContain('android:supportsPictureInPicture');
    expect(plugin).toContain("PictureInPictureParams.Builder");
    expect(plugin).toContain("onUserLeaveHint");
    expect(plugin).toContain("BikeRidePipPackage");
    expect(plugin).toContain("EX_DEV_CLIENT_NETWORK_INSPECTOR");
    expect(plugin).toContain("Build.VERSION.SDK_INT < Build.VERSION_CODES.S");
    expect(plugin).toContain("builder.setSeamlessResizeEnabled(false)");
    expect(plugin).toContain("Configuration.UI_MODE_NIGHT_MASK");
    expect(plugin).toContain("private fun applyRidePipTheme()");
    expect(plugin).toContain("override fun onConfigurationChanged(newConfig: Configuration)");
    expect(plugin).toContain("private fun restoreFullNavigationFromPip()");
    expect(plugin).toContain("window.decorView.requestFocus()");
    expect(plugin).not.toContain("SYSTEM_ALERT_WINDOW");
    expect(plugin).not.toContain("Nitro");
    expect(plugin).not.toContain("C++");
  });

  it("uses the current ride and navigation state as a read-only PiP snapshot", () => {
    const map = read("app/(tabs)/map.tsx");
    expect(map).toContain("buildRidePipSnapshot");
    expect(map).toContain("updateAndroidRidePipSnapshot(ridePipSnapshot)");
    expect(map).toContain("closeAndroidRidePip()");
    expect(map).toContain("status: state.status");
    expect(map).toContain("instruction: isNavigating ? navInstruction : \"騎乘中\"");
  });
});
