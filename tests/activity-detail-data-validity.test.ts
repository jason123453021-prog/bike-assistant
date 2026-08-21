import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

describe("活動詳情資料有效性守門", () => {
  it("在功率資料不足時將最大功率明確標示為資料不足，而不是顯示 0 W", () => {
    const source = readFileSync(resolve(projectRoot, "app/ride-detail.tsx"), "utf8");
    expect(source).toContain('label="最大功率" value={displayedPower === undefined ? "--"');
    expect(source).toContain('unit={powerUnit}');
    expect(source).toContain('displayedPower?.source === "estimated"');
  });

  it("活動分析、分段與環境區塊均在缺少樣本時使用空狀態或資料不足標記", () => {
    const source = readFileSync(resolve(projectRoot, "app/ride-detail.tsx"), "utf8");
    expect(source).toContain("此活動沒有足夠的 GPS 取樣資料");
    expect(source).toContain('split.averagePowerW === undefined ? "--"');
    expect(source).toContain('averageTemperatureC === undefined ? "--"');
    expect(source).toContain("record.calculationProfile?.environment?.sampleCount ?? 0");
    expect(source).toContain("手動 Lap 紀錄");
    expect(source).not.toContain('label="GPS 點數"');
  });
});
