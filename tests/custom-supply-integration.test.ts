import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(__dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(project, relativePath), "utf8");

describe("自訂補給與共用提醒整合", () => {
  it("自訂補給資料只保留類別、時間或距離規則，載入舊資料時會清除個別提醒欄位", () => {
    const source = read("lib/settings-context.tsx");
    expect(source).toContain('target: "energy" | "water"');
    expect(source).toContain("function normalizeSupplyItems");
    expect(source).not.toMatch(/repeatMode:\s*"once" \| "every" \| "off"/);
    expect(source).not.toContain("pauseOnDownhill?: boolean");
  });

  it("自訂補給編輯器只保留類別與時間或距離，說明其餘行為沿用共用設定", () => {
    const source = read("components/custom-supply-item-modal.tsx");
    expect(source).toContain("整合提醒類別");
    expect(source).toContain("沿用所選能量或補水的共用設定");
    expect(source).not.toContain("setRepeatMode");
    expect(source).not.toContain("setPauseOnDownhill");
  });

  it("自訂提醒依所屬能量或補水類別共用語音、通知、重複提醒與確認流程", () => {
    const source = read("app/(tabs)/map.tsx");
    expect(source).toContain('const target = supplyItem.target === "water" ? "water" : "calorie"');
    expect(source).toContain("settings.supplyReminderRepeatSec");
    expect(source).toContain('"custom-energy" : "custom-water"');
    expect(source).toContain("handleConfirmCustomSupply(item.id, item.triggerType)");
  });
});
