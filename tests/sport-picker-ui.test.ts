import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");

describe("sport picker presentation", () => {
  it("uses the start control's left-side trigger and a searchable bottom picker instead of the dashboard row", () => {
    expect(mapSource).toContain("styles.preRideControls");
    expect(mapSource).toContain("styles.sportInlineTrigger");
    expect(mapSource).toContain("sportPickerVisible");
    expect(mapSource).toContain("選擇運動");
    expect(mapSource).toContain("搜尋運動");
    expect(mapSource).not.toContain("<View style={styles.sportSelector}>");
  });

  it("avoids duplicate bottom safe-area height and keeps a font-scale-aware start control", () => {
    expect(mapSource).toContain("headerHeight + dashGridH + controlHeight");
    expect(mapSource).toContain("const dashboardColumnCount = fontScale >= 1.6 ? 2 : 3;");
    expect(mapSource).toContain("paddingBottom: 0");
    expect(mapSource).toContain("minHeight: 52");
    expect(mapSource).toContain("marginBottom: 8");
  });
});
