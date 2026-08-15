import { describe, expect, it } from "vitest";
import {
  SUPPLY_CONFIRM_ACTION,
  SUPPLY_SNOOZE_ACTION,
  parseSupplyNotificationAction,
} from "../lib/supply-notification-action-model";
// 此測試只驗證資料解析，不需載入 React Native 的本機通知層。

const responseFor = (actionIdentifier: string, supplyKind: string) => ({
  actionIdentifier,
  notification: { request: { content: { data: { type: "supply_reminder", supplyKind } } } },
});

describe("parseSupplyNotificationAction", () => {
  it("辨識使用者按下已補給的卡路里提醒", () => {
    expect(parseSupplyNotificationAction(responseFor(SUPPLY_CONFIRM_ACTION, "calorie"))).toEqual({
      action: "confirm",
      kind: "calorie",
    });
  });

  it("辨識使用者按下稍後提醒的補水距離間隔提醒", () => {
    expect(parseSupplyNotificationAction(responseFor(SUPPLY_SNOOZE_ACTION, "interval-water-distance"))).toEqual({
      action: "snooze",
      kind: "interval-water-distance",
    });
  });

  it("辨識使用者按下已補給的能量時間間隔提醒", () => {
    expect(parseSupplyNotificationAction(responseFor(SUPPLY_CONFIRM_ACTION, "interval-energy-time"))).toEqual({
      action: "confirm",
      kind: "interval-energy-time",
    });
  });

  it("忽略非補給或資料不完整的通知回應", () => {
    expect(parseSupplyNotificationAction(responseFor(SUPPLY_CONFIRM_ACTION, "unknown"))).toBeNull();
    expect(parseSupplyNotificationAction({ actionIdentifier: SUPPLY_CONFIRM_ACTION })).toBeNull();
  });
});
