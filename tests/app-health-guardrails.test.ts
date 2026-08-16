import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const containerSource = readFileSync(resolve(process.cwd(), "components/screen-container.tsx"), "utf8");
const settingsSource = readFileSync(resolve(process.cwd(), "app/(tabs)/settings.tsx"), "utf8");

describe("app health guardrails", () => {
  it("keeps understandable Chinese fallbacks for location, offline address search, and local storage failures", () => {
    expect(mapSource).toContain("需要定位權限");
    expect(mapSource).toContain("地址搜尋暫時不可用");
    expect(mapSource).toContain("本機儲存失敗");
    expect(mapSource).toContain("請確認可用空間後重新開啟 App");
  });

  it("uses safe-area aware screen containment for device cutouts and navigation bars", () => {
    expect(containerSource).toContain("SafeAreaView");
    expect(containerSource).toContain('edges = ["top", "left", "right"]');
  });

  it("keeps a recoverable copy until the completed activity has been stored", () => {
    const saveRecordIndex = mapSource.indexOf("const savedRecordId = await saveRecord");
    const clearSnapshotIndex = mapSource.indexOf("await clearSnapshot();", saveRecordIndex);

    expect(saveRecordIndex).toBeGreaterThan(-1);
    expect(clearSnapshotIndex).toBeGreaterThan(saveRecordIndex);
    expect(mapSource).toContain('if (!savedRecordId) throw new Error("活動記錄未建立")');
  });

  it("releases late GPS and heading subscriptions instead of retaining listeners after unmount", () => {
    expect(mapSource).toContain("let locationSubscription: Location.LocationSubscription | null = null");
    expect(mapSource).toContain("let headingSubscription: Location.LocationSubscription | null = null");
    expect(mapSource).toContain("if (!active) {\n        sub.remove();\n        return;");
    expect(mapSource).toContain("locationSubscription?.remove();");
    expect(mapSource).toContain("headingSubscription?.remove();");
  });

  it("keeps custom supply tracker data explicit and removes high-frequency supply debug logs", () => {
    expect(mapSource).toContain("type CustomSupplyTracker = {");
    expect(mapSource).not.toContain("Record<string, any>");
    expect(mapSource).not.toContain("console.log(`[補給]");
  });

  it("uses only the three touch-guard quick choices instead of a free-form time input", () => {
    expect(settingsSource).toContain("TOUCH_GUARD_UNLOCK_HOLD_PRESETS.map");
    expect(settingsSource).toContain("預設 400 毫秒；選擇常用解除時間");
    expect(settingsSource).not.toContain("touchGuardUnlockHoldDraft");
    expect(settingsSource).not.toContain("commitTouchGuardUnlockHoldMs");
  });
});
