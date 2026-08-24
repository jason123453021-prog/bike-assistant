import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("背景通知直接確認", () => {
  it("在導航頁掛載前先持久化「已補給」，再導向騎乘頁同步下一輪", () => {
    const actionSource = readFileSync(resolve(process.cwd(), "lib/supply-notification-actions.ts"), "utf8");
    const rootSource = readFileSync(resolve(process.cwd(), "app/_layout.tsx"), "utf8");
    expect(actionSource).toContain("onConfirm?:");
    expect(actionSource).toContain('action.action === "confirm"');
    expect(actionSource).toContain('action.action === "open" || action.action === "confirm"');
    expect(rootSource).toContain("acknowledgeBackgroundSupplyReminder");
    expect(rootSource).toContain("acknowledgeBackgroundSupplyInterval");
    expect(rootSource).toContain("onConfirm: async (action)");
  });

  it("讓前景確認使用既有或離線安全補給計畫，且短暫阻止舊背景快照重開同一彈窗", () => {
    const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
    expect(mapSource).toContain("resolveConfirmedSupplyPlan");
    expect(mapSource).toContain("backgroundNotificationConfirmationUntilRef");
    expect(mapSource).toContain("shouldSkipWaterReminderRestore");
    expect(mapSource).toContain("restartSmartSupplyCountdown");
  });
});
