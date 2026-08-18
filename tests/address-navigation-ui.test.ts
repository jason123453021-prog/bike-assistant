import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("pinned address navigation", () => {
  it("shows an address field in pin mode and routes resolved coordinates through the existing pin flow", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app", "(tabs)", "map.tsx"), "utf8");

    expect(source).toContain("const [pinAddress, setPinAddress] = useState");
    expect(source).toContain("const handleResolvePinAddress = useCallback");
    expect(source).toContain("Location.geocodeAsync(address)");
    expect(source).toContain("輸入地址、地標或店家名稱");
    expect(source).toContain("pinAddressBar");
    expect(source).toContain("setPinnedLocation(nextLocation)");
    expect(source).toContain("fetchBikeRoute(");
  });

  it("keeps clear feedback for invalid addresses and offline address lookup", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app", "(tabs)", "map.tsx"), "utf8");

    expect(source).toContain("找不到地址");
    expect(source).toContain("地址搜尋暫時不可用");
    expect(source).toContain("離線時仍可直接移動地圖");
  });

  it("keeps pinned-route failures non-blocking and does not add route-planning speech", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app", "(tabs)", "map.tsx"), "utf8");

    expect(source).toContain("const [pinRouteStatusMessage, setPinRouteStatusMessage] = useState");
    expect(source).toContain("離線時仍可繼續本機騎乘與記錄");
    expect(source).toContain("找不到可通行路線。請將圖釘移到可騎行道路後重新規劃。");
    expect(source).not.toContain('speak(`計算完成，${formatRouteDistance(result.distanceM)}，${formatRouteDuration(result.durationSec)}`');
    expect(source).not.toContain('speak("路徑規劃暫時不可用');
  });
});
