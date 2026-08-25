import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
);

describe("sport selection start control layout", () => {
  it("places the inactive sport selector directly to the left of the start control", () => {
    expect(mapSource).toContain("<View style={styles.preRideControls}>");
    expect(mapSource).toContain("styles.sportInlineTrigger");
    expect(mapSource).toContain(
      'accessibilityLabel={t("dashboard.selectSport")}',
    );
    expect(mapSource).toContain("styles.startBtn");
  });

  it("does not keep a floating sport button positioned above the collapsed panel", () => {
    expect(mapSource).not.toContain("sportTrigger: {");
    expect(mapSource).not.toContain("sportTriggerIcon:");
    expect(mapSource).not.toContain("sportTriggerLabel:");
  });
});
