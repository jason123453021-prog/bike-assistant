import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

describe("彈窗與系統通知同步清理守門", () => {
  it("清除補給與日照通知時，同時處理已呈現及未到期排程的通知", () => {
    const source = readFileSync(resolve(projectRoot, "lib/feedback-service.ts"), "utf8");
    expect(source).toContain("getPresentedNotificationsAsync()");
    expect(source).toContain("getAllScheduledNotificationsAsync()");
    expect(source).toContain('notification.request.content.data?.type === "supply_reminder"');
    expect(source).toContain('notification.content.data?.type === "supply_reminder"');
    expect(source).toContain('notification.request.content.data?.type === "daylight_alert"');
    expect(source).toContain('notification.content.data?.type === "daylight_alert"');
  });

  it("日照確認、補給確認、自訂補給確認與稍後關閉均會清除對應通知", () => {
    const source = readFileSync(resolve(projectRoot, "app/(tabs)/map.tsx"), "utf8");
    expect(source).toContain("void clearAllDaylightAlertNotifications()");
    expect(source).toContain("void clearAllSupplyNotifications()");
    expect(source).toContain("void clearAllSupplyNotifications().finally(() => { void scheduleSupplySnooze(kind); })");
    expect(source).toContain("sortedActiveAlerts.forEach((id) =>");
    expect(source).toContain("intervalSupplyAlerts) as [SupplyIntervalKind, boolean][]");
  });
});
