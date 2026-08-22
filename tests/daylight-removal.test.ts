import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

describe("日出／日落開關燈提醒移除守門", () => {
  it("不再保留日照提醒的專用事件與通知動作模組", () => {
    expect(existsSync(resolve(projectRoot, "lib/daylight-alert.ts"))).toBe(false);
    expect(existsSync(resolve(projectRoot, "lib/daylight-notification-action-model.ts"))).toBe(false);
    expect(existsSync(resolve(projectRoot, "lib/daylight-notification-actions.ts"))).toBe(false);
  });

  it("設定頁、騎乘頁與通知服務均不再建立日照開關燈提醒", () => {
    const settingsSource = readProjectFile("app/(tabs)/settings.tsx");
    const mapSource = readProjectFile("app/(tabs)/map.tsx");
    const notificationSource = readProjectFile("lib/feedback-service.ts");

    expect(settingsSource).not.toContain("daylightAlert");
    expect(settingsSource).not.toContain("日照警示燈提醒");
    expect(mapSource).not.toContain("scheduleDaylight");
    expect(mapSource).not.toContain("clearAllDaylight");
    expect(notificationSource).not.toContain("daylight_alert");
    expect(notificationSource).not.toContain("configureDaylight");
  });
});
