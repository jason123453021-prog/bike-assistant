import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldRestoreBackgroundSupplyReminder } from "../lib/background-supply-recovery";

describe("background supply reminder recovery", () => {
  it("restores a newly persisted background reminder when no foreground modal is pending", () => {
    expect(
      shouldRestoreBackgroundSupplyReminder({
        persistedPending: true,
        countdownDue: false,
        pendingInForeground: false,
      }),
    ).toBe(true);
  });

  it("restores a smart countdown that elapsed while the app was in the background", () => {
    expect(
      shouldRestoreBackgroundSupplyReminder({
        persistedPending: false,
        countdownDue: true,
        pendingInForeground: false,
      }),
    ).toBe(true);
  });

  it("does not reopen a reminder already pending or confirmed in the foreground", () => {
    expect(
      shouldRestoreBackgroundSupplyReminder({
        persistedPending: true,
        countdownDue: true,
        pendingInForeground: true,
      }),
    ).toBe(false);
  });

  it("routes modal and notification confirmation through bulk supply notification cleanup", () => {
    const mapSource = readFileSync(
      resolve(process.cwd(), "app/(tabs)/map.tsx"),
      "utf8",
    );
    expect(
      mapSource.match(/void clearAllSupplyNotifications\(\);/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("將使用者點擊通知導回導航頁，並只恢復待確認彈窗而不把它當成已補給", () => {
    const rootSource = readFileSync(
      resolve(process.cwd(), "app/_layout.tsx"),
      "utf8",
    );
    const mapSource = readFileSync(
      resolve(process.cwd(), "app/(tabs)/map.tsx"),
      "utf8",
    );
    const actionSource = readFileSync(
      resolve(process.cwd(), "lib/supply-notification-actions.ts"),
      "utf8",
    );
    expect(rootSource).toContain('onOpen: () => router.replace("/map")');
    expect(actionSource).toContain('action.action === "open"');
    expect(mapSource).toContain('if (action.action === "open")');
    expect(mapSource).toContain("setCalorieAlert(true);");
    expect(mapSource).toContain("setWaterAlert(true);");
    expect(mapSource).toContain("不得視為已補給");
    expect(mapSource).not.toMatch(
      /action\.kind === "calorie"[\s\S]{0,220}setBackgroundSupplyReminderPending\("calorie", true\)/,
    );
    expect(mapSource).not.toMatch(
      /action\.kind === "water"[\s\S]{0,220}setBackgroundSupplyReminderPending\("water", true\)/,
    );
  });

  it("以前景確認版號保護背景舊快照，避免已補給後再次彈出相同提醒", () => {
    const backgroundSource = readFileSync(
      resolve(process.cwd(), "lib/background-location.ts"),
      "utf8",
    );
    expect(backgroundSource).toContain("mutateBackgroundSupplyState");
    expect(backgroundSource).toContain(
      "persistBackgroundStatePreservingSupplyMutations",
    );
    expect(backgroundSource).toContain("supplyReminderMutationVersion");
  });

  it("維持 Android 高優先級補給頻道、通知原生設定與定位前景服務", () => {
    const feedbackSource = readFileSync(
      resolve(process.cwd(), "lib/feedback-service.ts"),
      "utf8",
    );
    const backgroundSource = readFileSync(
      resolve(process.cwd(), "lib/background-location.ts"),
      "utf8",
    );
    const configSource = readFileSync(
      resolve(process.cwd(), "app.config.ts"),
      "utf8",
    );
    expect(feedbackSource).toContain('setNotificationChannelAsync("supply"');
    expect(feedbackSource).toContain(
      "importance: Notifications.AndroidImportance.MAX",
    );
    expect(
      feedbackSource.match(/channelId: "supply"/g)?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(backgroundSource).toContain("foregroundService:");
    expect(backgroundSource).toContain("killServiceOnDestroy: false");
    expect(configSource).toContain('"expo-notifications"');
    expect(configSource).toContain("isAndroidForegroundServiceEnabled: true");
  });
});
