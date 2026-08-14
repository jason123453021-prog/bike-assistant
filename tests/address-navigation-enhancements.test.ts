import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("address navigation enhancements", () => {
  it("offers recent searches and candidate destinations before planning a route", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app", "(tabs)", "map.tsx"), "utf8");

    expect(source).toContain("loadRecentAddressSearches");
    expect(source).toContain("saveRecentAddressSearches");
    expect(source).toContain("const [pinAddressCandidates, setPinAddressCandidates]");
    expect(source).toContain("選擇目的地");
    expect(source).toContain("最近搜尋");
    expect(source).toContain("selectPinAddressDestination(candidate)");
  });

  it("refreshes visible map tiles and explains that construction closures need route recomputation", () => {
    const mapSource = fs.readFileSync(path.join(process.cwd(), "app", "(tabs)", "map.tsx"), "utf8");
    const leafletSource = fs.readFileSync(path.join(process.cwd(), "components", "leaflet-map.tsx"), "utf8");

    expect(mapSource).toContain("handleRefreshPinMapData");
    expect(mapSource).toContain("道路施工與臨時封路未必即時反映");
    expect(mapSource).toContain("formatNavigationDataFreshness");
    expect(leafletSource).toContain("refreshBaseTiles");
    expect(leafletSource).toContain("baseTileLayer.setUrl(baseTileUrl + '?refresh=' + Date.now())");
  });
});
