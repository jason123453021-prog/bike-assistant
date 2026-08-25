import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const containerSource = readFileSync(
  resolve(process.cwd(), "components/screen-container.tsx"),
  "utf8",
);
const settingsSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/settings.tsx"),
  "utf8",
);
const historySource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/history.tsx"),
  "utf8",
);
const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
).replace(/\s+/g, " ");
const themeSource = readFileSync(
  resolve(process.cwd(), "theme.config.js"),
  "utf8",
);
const themeProviderSource = readFileSync(
  resolve(process.cwd(), "lib/theme-provider.tsx"),
  "utf8",
);
const elevationChartSource = readFileSync(
  resolve(process.cwd(), "components/activity-elevation-chart.tsx"),
  "utf8",
);
const permissionReadinessSource = readFileSync(
  resolve(process.cwd(), "components/ride-permission-readiness.tsx"),
  "utf8",
);
const supplyItemModalSource = readFileSync(
  resolve(process.cwd(), "components/custom-supply-item-modal.tsx"),
  "utf8",
);
const rideSummarySource = readFileSync(
  resolve(process.cwd(), "components/ride-summary-modal.tsx"),
  "utf8",
);
const rideDetailSource = readFileSync(
  resolve(process.cwd(), "app/ride-detail.tsx"),
  "utf8",
);
const speedCurveSource = readFileSync(
  resolve(process.cwd(), "components/speed-curve-chart.tsx"),
  "utf8",
);
const shareCardSource = readFileSync(
  resolve(process.cwd(), "components/share-card-modal.tsx"),
  "utf8",
);

describe("small-screen readability guardrails", () => {
  it("keeps the screen background synchronized with the active runtime color palette", () => {
    expect(containerSource).toContain(
      "style={{ backgroundColor: colors.background }}",
    );
  });

  it("uses readable shared type scales for settings rows and selector controls", () => {
    expect(settingsSource).toMatch(
      /rowHint:\s*{\s*fontSize:\s*13,\s*lineHeight:\s*18/,
    );
    expect(settingsSource).toMatch(/borderWidth:\s*1,\s*borderRadius:\s*16/);
    expect(settingsSource).toMatch(
      /settings\.gpsAccuracy\s*===\s*level\s*\?\s*colors\.onAccent\s*:\s*colors\.foreground/,
    );
  });

  it("keeps history search, filters, and empty states above the former compact type scale", () => {
    expect(historySource).toContain(
      'sportFilterText: { fontSize: 12, fontWeight: "800" }',
    );
    expect(historySource).toContain("emptySubtitle: { fontSize: 15");
    expect(historySource).toContain(
      "recordCard: {\n    padding: 14,\n    borderRadius: 14,\n    borderWidth: 1",
    );
  });

  it("uses high-contrast dark navigation overlays for dashboard labels and progress text", () => {
    expect(mapSource).toContain('backgroundColor: "rgba(7, 17, 11, 0.97)"');
    expect(mapSource).toContain(
      'sportChoiceLabel: { color: "#FFFFFF", fontSize: 12',
    );
    expect(mapSource).toContain(
      'weatherItem: { color: "rgba(255,255,255,0.94)", fontSize: 13',
    );
    expect(mapSource).toContain(
      'navText: { flex: 1, flexShrink: 1, color: "#fff", fontSize: 16',
    );
  });

  it("provides elevated, inset and on-accent tokens for both themes", () => {
    expect(themeSource).toContain("surfaceElevated:");
    expect(themeSource).toContain("surfaceInset:");
    expect(themeSource).toContain("onAccent:");
    expect(themeProviderSource).toContain('"color-surfaceElevated"');
    expect(themeProviderSource).toContain('"color-onAccent"');
  });

  it("keeps charts and permission readiness cards driven by runtime theme colors", () => {
    expect(elevationChartSource).toContain("const colors = useColors();");
    expect(elevationChartSource).toContain("fill={colors.surfaceInset}");
    expect(elevationChartSource).toContain("stroke={colors.accent}");
    expect(permissionReadinessSource).toContain("action: { minHeight: 44");
    expect(permissionReadinessSource).toContain(
      "subtitle: { fontSize: 13, lineHeight: 19",
    );
  });

  it("uses onAccent foregrounds for dynamic primary and accent action surfaces", () => {
    expect(supplyItemModalSource).toContain(
      "triggerType === 'time' ? colors.onAccent : colors.foreground",
    );
    expect(supplyItemModalSource).toContain(
      "triggerType === 'distance' ? colors.onAccent : colors.foreground",
    );
    expect(supplyItemModalSource).toContain("color: colors.onAccent");
    expect(rideSummarySource).toContain("color={colors.onAccent}");
    expect(rideSummarySource).toContain(
      "style={[styles.saveBtnText, { color: colors.onAccent }]}",
    );
    expect(rideSummarySource).toContain(
      'name="plus" size={17} color={colors.onAccent}',
    );
    expect(rideDetailSource).toContain(
      "style={[styles.photoAddButtonText, { color: colors.onAccent }]}",
    );
    expect(rideDetailSource).toContain(
      'color: colors.onAccent, fontWeight: "600"',
    );
    expect(speedCurveSource).toContain(
      "selectedBasis ? colors.onAccent : colors.muted",
    );
    expect(shareCardSource).toContain(
      'color: colors.onAccent, fontSize: 14, fontWeight: "600"',
    );
  });

  it("keeps the ride-summary close control below Android system status chrome", () => {
    expect(rideSummarySource).toContain(
      'import { SafeAreaView } from "react-native-safe-area-context";',
    );
    expect(rideSummarySource).toContain(
      '<SafeAreaView edges={["top", "left", "right"]}',
    );
    expect(rideSummarySource).toContain(
      "headerCloseButton: { minWidth: 44, minHeight: 44",
    );
    expect(rideSummarySource).toContain("hitSlop={12}");
  });

  it("keeps the remaining custom supply trigger selector legible in both themes", () => {
    expect(settingsSource).not.toContain("整合提醒類別");
    expect(settingsSource).toMatch(
      /supplyForm\.triggerType\s*===\s*type\s*\?\s*colors\.onAccent\s*:\s*colors\.foreground/,
    );
  });
});
