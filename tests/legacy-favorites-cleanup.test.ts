import { describe, expect, it } from "vitest";
import {
  LEGACY_FAVORITES_STORAGE_KEY,
  clearLegacyFavoritesCache,
} from "../lib/legacy-favorites-cleanup";

describe("clearLegacyFavoritesCache", () => {
  it("只移除舊版最愛路線快取鍵", async () => {
    const removedKeys: string[] = [];
    await clearLegacyFavoritesCache({
      removeItem: async (key) => {
        removedKeys.push(key);
      },
    });

    expect(removedKeys).toEqual([LEGACY_FAVORITES_STORAGE_KEY]);
    expect(LEGACY_FAVORITES_STORAGE_KEY).toBe("@bike_assistant_favorites");
  });
});
