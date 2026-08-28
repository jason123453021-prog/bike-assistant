jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

import {
  fetchPoiPayloadWithFallback,
  POI_OVERPASS_ENDPOINTS,
} from "../../lib/poi-layer";

describe("POI 公開資料服務容錯", () => {
  it("主要端點暫時失敗時會改用後備端點，而非讓騎乘地圖永久沒有標記", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: [{ id: 1, lat: 25.04, lon: 121.53 }] }),
      });

    const payload = await fetchPoiPayloadWithFallback(
      "[out:json];node(0,0,1,1);out;",
      fetchMock as unknown as typeof fetch,
      POI_OVERPASS_ENDPOINTS,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(POI_OVERPASS_ENDPOINTS[0]);
    expect(fetchMock.mock.calls[1][0]).toBe(POI_OVERPASS_ENDPOINTS[1]);
    expect(payload.elements).toHaveLength(1);
  });

  it("每次查詢會提供識別用戶端標頭，並要求 JSON 回應", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [] }),
    });

    await fetchPoiPayloadWithFallback(
      "[out:json];node(0,0,1,1);out;",
      fetchMock as unknown as typeof fetch,
      ["https://example.test/interpreter"],
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/interpreter",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-Bike-Assistant-Client": "mobile-poi-layer/1",
        }),
      }),
    );
  });
});
