import { describe, expect, it } from "vitest";
import { buildNavigationDashboardSummaryKeys } from "../lib/navigation-dashboard-summary";

describe("導航儀表板摘要列去重", () => {
  it("預設主面板保留單一總爬升，摘要列只補上獨立指標", () => {
    expect(buildNavigationDashboardSummaryKeys([
      "showElapsed",
      "showSpeed",
      "showDistance",
      "showGrade",
      "showPower",
      "showTotalAscent",
    ])).toEqual(["avgSpeed", "currentAltitude", "maxPower"]);
  });

  it("主面板已顯示的坡度、均速與海拔不會再於摘要列重複", () => {
    expect(buildNavigationDashboardSummaryKeys([
      "showGrade",
      "showAvgSpeed",
      "showCurrentAltitude",
      "showTotalAscent",
    ])).toEqual(["maxPower"]);
  });

  it("摘要列不會加入第二個總爬升欄位", () => {
    expect(buildNavigationDashboardSummaryKeys([])).not.toContain("totalAscent");
  });
});
