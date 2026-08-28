import { describe, expect, it } from "vitest";
import {
  SUPPLY_CONFIRM_ACTION,
  SUPPLY_SNOOZE_ACTION,
  parseSupplyNotificationAction,
} from "../lib/supply-notification-action-model";
// 此測試只驗證資料解析，不需載入 React Native 的本機通知層。

const responseFor = (actionIdentifier: string, supplyKind: string, customItemId?: string) => ({
  actionIdentifier,
  notification: { request: { content: { data: { type: "supply_reminder", supplyKind, customItemId } } } },
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

  it("將使用者點擊通知本體安全轉為開啟待確認彈窗，而非直接確認補給", () => {
    expect(parseSupplyNotificationAction(responseFor("expo.modules.notifications.actions.DEFAULT", "water"))).toEqual({
      action: "open",
      kind: "water",
    });
  });

  it("辨識使用者按下已補給的能量時間間隔提醒", () => {
    expect(parseSupplyNotificationAction(responseFor(SUPPLY_CONFIRM_ACTION, "interval-energy-time"))).toEqual({
      action: "confirm",
      kind: "interval-energy-time",
    });
  });

  it("保留自訂補水品項識別，讓確認操作回到同一共用提醒流程", () => {
    expect(parseSupplyNotificationAction(responseFor(SUPPLY_CONFIRM_ACTION, "custom-water", "electrolyte-water"))).toEqual({
      action: "confirm",
      kind: "custom-water",
      customItemId: "electrolyte-water",
    });
  });

  it("忽略非補給或資料不完整的通知回應", () => {
    expect(parseSupplyNotificationAction(responseFor(SUPPLY_CONFIRM_ACTION, "unknown"))).toBeNull();
    expect(parseSupplyNotificationAction({ actionIdentifier: SUPPLY_CONFIRM_ACTION })).toBeNull();
  });
});
