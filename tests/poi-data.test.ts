import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_POIS, fetchPOIsFromAPI } from "../lib/poi-data";

describe("POI offline fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns local POIs when the Overpass request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    await expect(fetchPOIsFromAPI(25.03, 121.56, 5)).resolves.toEqual(SAMPLE_POIS);
  });

  it("returns local POIs when the remote service responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(fetchPOIsFromAPI(25.03, 121.56, 5)).resolves.toEqual(SAMPLE_POIS);
  });
});
