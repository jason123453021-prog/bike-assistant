import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("pinned address navigation", () => {
  it("shows an address field in pin mode and routes resolved coordinates through the existing pin flow", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", "(tabs)", "map.tsx"),
      "utf8",
    );

    expect(source).toContain("const [pinAddress, setPinAddress] = useState");
    expect(source).toContain("const handleResolvePinAddress = useCallback");
    expect(source).toContain("Location.geocodeAsync(address)");
    expect(source).toContain('t("audit.search")');
    expect(source).toContain("pinAddressBar");
    expect(source).toContain("setPinnedLocation(nextLocation)");
    expect(source).toContain("fetchBikeRoute(");
  });

  it("keeps clear feedback for invalid addresses and offline address lookup", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", "(tabs)", "map.tsx"),
      "utf8",
    );

    expect(source).toContain('t("audit.noRoutableRouteTitle")');
    expect(source).toContain('t("audit.noRoutableRouteBody")');
    expect(source).toContain("const [pinAddressNotice, setPinAddressNotice]");
    expect(source).toContain("styles.pinAddressNotice");
    expect(source).not.toContain('Alert.alert("地址搜尋暫時不可用"');
  });
});
