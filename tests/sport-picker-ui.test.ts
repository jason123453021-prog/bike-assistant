import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
);

describe("sport picker presentation", () => {
  it("uses the start control's left-side trigger and a searchable bottom picker instead of the dashboard row", () => {
    expect(mapSource).toContain("styles.preRideControls");
    expect(mapSource).toContain("styles.sportInlineTrigger");
    expect(mapSource).toContain("sportPickerVisible");
    expect(mapSource).toContain('t("audit.chooseSport")');
    expect(mapSource).toContain('t("audit.searchSports")');
    expect(mapSource).not.toContain("<View style={styles.sportSelector}>");
  });

  it("avoids duplicate bottom safe-area height and keeps a font-scale-aware start control", () => {
    expect(mapSource).toContain("headerHeight + dashGridH + controlHeight");
    expect(mapSource).toContain(
      "const dashboardColumnCount = fontScale >= 1.6 ? 2 : 3;",
    );
    expect(mapSource).toContain("paddingBottom: 0");
    expect(mapSource).toContain("minHeight: 52");
    expect(mapSource).toContain("marginBottom: 8");
  });

  it("選擇運動後立即更新狀態、儲存為預設並關閉 Bottom Sheet", () => {
    expect(mapSource).toContain("const handleSelectSportType = useCallback");
    expect(mapSource).toContain("setSportType(sportType);");
    expect(mapSource).toContain(
      "void updateSettings({ defaultSportType: sportType });",
    );
    expect(mapSource).toContain("setSportPickerVisible(false);");
    expect(mapSource).toContain(
      "onPress={() => handleSelectSportType(sportType)}",
    );
    expect(mapSource).toContain("SPORT_META[state.sportType]");
  });

  it("完成活動後允許預選下一項運動，但活動中與暫停時維持鎖定", () => {
    const rideContextSource = readFileSync(
      resolve(process.cwd(), "lib/ride-context.tsx"),
      "utf8",
    );
    expect(rideContextSource).toContain(
      'return state.status === "active" || state.status === "paused"',
    );
    expect(rideContextSource).toContain(
      ": { ...state, sportType: action.sportType };",
    );
  });
});
