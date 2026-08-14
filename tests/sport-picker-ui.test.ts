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

  it("avoids duplicate bottom safe-area height and keeps a full-height start control", () => {
    expect(mapSource).toContain("HEADER_H + dashGridH + CTRL_H");
    expect(mapSource).toContain("paddingBottom: 0");
    expect(mapSource).toContain("height: 52");
    expect(mapSource).toContain("marginBottom: 8");
  });
});
