import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const nativeIcons = readFileSync(resolve(process.cwd(), "components/ui/icon-symbol.tsx"), "utf8");
const webIcons = readFileSync(resolve(process.cwd(), "components/ui/icon-symbol.web.tsx"), "utf8");
const activityDetail = readFileSync(resolve(process.cwd(), "app/ride-detail.tsx"), "utf8");
const supplyPlan = readFileSync(resolve(process.cwd(), "lib/smart-supply-plan.ts"), "utf8");
const mapScreen = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");

describe("圖示與繁體中文守門", () => {
  it("未知圖示使用明確的更多選項或圓點，不顯示問號圖示", () => {
    expect(nativeIcons).toContain('MAPPING[name as string] ?? "more-horiz"');
    expect(nativeIcons).not.toMatch(/questionmark|help-outline/);
    expect(webIcons).toContain('{WEB_GLYPHS[name] ?? "•"}');
    expect(webIcons).not.toContain('?? "?"');
  });

  it("對使用者清楚標示本機環境基準，且不保留可見的未知英文回退", () => {
    expect(activityDetail).toContain("本機環境基準");
    expect(activityDetail).not.toContain("離線回退");
    expect(supplyPlan).toContain("本機環境基準");
    expect(mapScreen).toContain('"未命名補給品"');
    expect(mapScreen).not.toContain("'Unknown'");
  });

  it("核心使用者文案不包含常見簡體中文字元", () => {
    const userFacingSource = [activityDetail, supplyPlan, mapScreen, nativeIcons, webIcons].join("\n");
    expect(userFacingSource).not.toMatch(/[这为后发听见应际实关设选输记录线图资网点时会开关体进阶]/);
  });
});
