import { describe, expect, it } from "vitest";
import {
  MAX_RECENT_ADDRESS_SEARCHES,
  formatNavigationDataFreshness,
  mergeRecentAddressSearches,
  type RecentAddressSearch,
} from "../lib/address-search-history";

const entry = (label: string, latitude: number, longitude: number, usedAt = 1): RecentAddressSearch => ({
  label, latitude, longitude, usedAt,
});

describe("address search history", () => {
  it("moves duplicate destinations to the top and keeps a bounded local history", () => {
    const initial = Array.from({ length: MAX_RECENT_ADDRESS_SEARCHES }, (_, index) => entry(`目的地 ${index}`, index, index));
    const merged = mergeRecentAddressSearches(initial, entry("目的地 2", 2, 2, 9));

    expect(merged).toHaveLength(MAX_RECENT_ADDRESS_SEARCHES);
    expect(merged[0]).toEqual(entry("目的地 2", 2, 2, 9));
    expect(merged.filter((item) => item.label === "目的地 2")).toHaveLength(1);
  });

  it("describes routing data freshness without promising real-time road closures", () => {
    expect(formatNavigationDataFreshness(null)).toContain("重新請求道路資料");
    expect(formatNavigationDataFreshness(Date.now())).toContain("剛向線上服務");
  });
});
