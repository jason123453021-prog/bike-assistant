import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");

describe("ride start location readiness", () => {
  it("does not create a ride when device location services are disabled", () => {
    expect(source).toContain("Location.hasServicesEnabledAsync()");
    expect(source).toContain("定位服務未開啟");
    expect(source).toContain("請先在手機系統設定開啟定位服務，再開始騎乘紀錄。");
  });

  it("requests foreground location before starting and clearly reports a denial", () => {
    expect(source).toContain("Location.getForegroundPermissionsAsync()");
    expect(source).toContain("Location.requestForegroundPermissionsAsync()");
    expect(source).toContain("開始騎乘需要精確定位權限");
  });

  it("keeps the foreground ride usable but reports when background tracking cannot start", () => {
    expect(source).toContain("const backgroundTrackingStarted = await startBackgroundLocationTracking");
    expect(source).toContain("背景騎乘未啟用");
    expect(source).toContain("允許背景定位與電池不受限制");
  });
});
