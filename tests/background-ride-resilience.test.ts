import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isTrustworthyVirtualPowerPeak } from "../lib/live-elevation-filter";

const projectRoot = resolve(__dirname, "..");

describe("背景騎乘提醒、峰值功率與亮度生命週期", () => {
  it("為背景補給與補水指定最高優先權補給頻道，並在回前景時保留 pending 恢復資料", () => {
    const source = readFileSync(resolve(projectRoot, "lib/background-location.ts"), "utf8");
    expect(source).toContain('channelId: "supply"');
    expect(source).toContain("AndroidNotificationPriority.HIGH");
    expect(source).toContain("setBackgroundSupplyReminderPending");
  });

  it("不讓碰到個人化虛擬功率上限的 GPS／坡度尖峰污染活動最大功率", () => {
    // FTP 200 W 的個人化上限為 500 W；正好飽和的值必須排除。
    expect(isTrustworthyVirtualPowerPeak(500, 200, 10, 3)).toBe(false);
    expect(isTrustworthyVirtualPowerPeak(480, 200, 10, 3)).toBe(true);
    expect(isTrustworthyVirtualPowerPeak(480, 200, 0.2, 3)).toBe(false);
    expect(isTrustworthyVirtualPowerPeak(480, 200, 10, 0)).toBe(false);
  });

  it("僅在已開始的騎乘中啟動亮度管理，並在背景任務回呼位於前景時跳過重複統計", () => {
    const brightnessSource = readFileSync(resolve(projectRoot, "lib/power-saving/smart-power-saving-system.ts"), "utf8");
    const backgroundSource = readFileSync(resolve(projectRoot, "lib/background-location.ts"), "utf8");

    expect(brightnessSource).toContain("private rideSessionActive = false");
    expect(brightnessSource).toContain("if (!this.rideSessionActive) return;");
    expect(backgroundSource).toContain('if (executionInfo?.appState === "active") return;');
    expect(backgroundSource).toContain("syncBackgroundRideCheckpoint");
  });
});
