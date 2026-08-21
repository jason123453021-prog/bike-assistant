import { describe, expect, it } from "vitest";

import { daylightAlertCopy, getDaylightEvents, getDueDaylightAlert, getNextDaylightAlert } from "../lib/daylight-alert";
import { DAYLIGHT_CONFIRM_ACTION, parseDaylightNotificationAction } from "../lib/daylight-notification-action-model";

describe("daylight alert", () => {
  it("以本機日期與台北座標建立可排序的日出與日落事件", () => {
    const events = getDaylightEvents(new Date("2026-08-21T12:00:00.000Z"), 25.033, 121.5654);
    expect(events.map((event) => event.kind)).toEqual(["sunrise", "sunset"]);
    expect(events[0].triggerAtMs).toBeLessThan(events[1].triggerAtMs);
    expect(events[0].key).toContain("sunrise");
    expect(events[1].key).toContain("sunset");
  });

  it("只回傳尚未確認且已跨越的日照事件，並可取得下一個本機排程", () => {
    const events = getDaylightEvents(new Date("2026-08-21T12:00:00.000Z"), 25.033, 121.5654);
    const sunrise = events[0];
    const sunset = events[1];
    const input = {
      nowMs: sunset.triggerAtMs,
      rideStartedAtMs: sunrise.triggerAtMs - 60_000,
      latitude: 25.033,
      longitude: 121.5654,
      acknowledgedKeys: new Set<string>(),
    };
    expect(getDueDaylightAlert(input)?.key).toBe(sunset.key);
    expect(getDueDaylightAlert({ ...input, acknowledgedKeys: new Set([sunrise.key, sunset.key]) })).toBeUndefined();
    expect(getNextDaylightAlert({ ...input, nowMs: sunrise.triggerAtMs - 60_000 })?.key).toBe(sunrise.key);
  });

  it("只接受明確的日照確認通知動作", () => {
    expect(parseDaylightNotificationAction({
      actionIdentifier: DAYLIGHT_CONFIRM_ACTION,
      notification: { request: { content: { data: { daylightKind: "sunset", daylightEventKey: "2026-08-21-sunset" } } } },
    })).toEqual({ kind: "sunset", eventKey: "2026-08-21-sunset" });
    expect(parseDaylightNotificationAction({ actionIdentifier: "dismiss" })).toBeUndefined();
    expect(daylightAlertCopy("sunrise").confirmation).toContain("關閉");
    expect(daylightAlertCopy("sunset").confirmation).toContain("開啟");
  });
});
