import { describe, expect, it } from "vitest";
import { hasUsableRouteEndpoints, type RouteCoordinate } from "../lib/route-service";

const from: RouteCoordinate = { latitude: 25.0478, longitude: 121.5319 };
const to: RouteCoordinate = { latitude: 25.052, longitude: 121.538 };

describe("route endpoint accessibility", () => {
  it("accepts a route that starts and ends near the selected coordinates", () => {
    const route = [
      { latitude: 25.04785, longitude: 121.53186 },
      { latitude: 25.0501, longitude: 121.5342 },
      { latitude: 25.05204, longitude: 121.53796 },
    ];

    expect(hasUsableRouteEndpoints(route, from, to)).toBe(true);
  });

  it("rejects a route whose destination snaps too far from the selected pin", () => {
    const route = [
      from,
      { latitude: 25.056, longitude: 121.545 },
    ];

    expect(hasUsableRouteEndpoints(route, from, to)).toBe(false);
  });

  it("rejects an invalid route with fewer than two coordinates", () => {
    expect(hasUsableRouteEndpoints([from], from, to)).toBe(false);
  });
});
