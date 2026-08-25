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

  it("保留每公里分段與智慧補給核心資訊，同時移除重複的環境樣本、比較、Lap 與功率面板", () => {
    const source = readFileSync(resolve(projectRoot, "app/ride-detail.tsx"), "utf8");
    expect(source).toContain('t("detail.speedCurveUnavailable")');
    expect(source).toContain('t("detail.perKilometerSplits")');
    expect(source).toContain('split.averagePowerW === undefined ? "--"');
    expect(source).toContain('averageTemperatureC === undefined ? "--"');
    expect(source).toContain('t("detail.environmentSmartSupply")');
    expect(source).not.toContain('label="環境樣本"');
    expect(source).not.toContain("本機 1 km 個人最佳比較");
    expect(source).not.toContain("Lap 紀錄");
    expect(source).not.toContain("本機分段功率表現");
    expect(source).not.toContain("formatLapMetricsInline");
    expect(source).not.toContain("compareLocalSplitPersonalBests");
    expect(source).not.toContain('label="GPS 點數"');
  });
});
