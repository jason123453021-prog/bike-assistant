import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

describe("日照警示設定介面守門", () => {
  it("提供可持久化的總開關、0–60 分鐘自訂值與 15 分鐘快速選項", () => {
    const settingsSource = readFileSync(resolve(projectRoot, "lib/settings-context.tsx"), "utf8");
    const screenSource = readFileSync(resolve(projectRoot, "app/(tabs)/settings.tsx"), "utf8");
    expect(settingsSource).toContain("daylightAlertEnabled: boolean");
    expect(settingsSource).toContain("daylightAlertLeadMinutes: number");
    expect(settingsSource).toContain("daylightAlertMode: DaylightAlertMode");
    expect(settingsSource).toContain("normalizeDaylightAlertMode(saved.daylightAlertMode)");
    expect(settingsSource).toContain("normalizeDaylightAlertLeadMinutes(saved.daylightAlertLeadMinutes)");
    expect(screenSource).toContain("const daylightControlsDisabled = !settings.notificationEnabled || !settings.daylightAlertEnabled");
    expect(screenSource).toContain("[0, 5, 10, 15, 30].map((minutes)");
    expect(screenSource).toContain('openEdit("daylightAlertLeadMinutes", "日照提前提醒時間（0–60 分鐘）"');
    expect(screenSource).toContain("disabled={daylightControlsDisabled}");
    expect(screenSource).toContain('{ key: "sunrise-only", label: "僅日出" }');
    expect(screenSource).toContain('{ key: "sunset-only", label: "僅日落" }');
    expect(screenSource).toContain("styles.daylightModeOptions");
  });
});
