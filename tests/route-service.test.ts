import { describe, expect, it } from "vitest";
import {
  hasUsableRouteEndpoints,
  selectBikeRouteCandidate,
  type RouteCoordinate,
  type RouteResult,
} from "../lib/route-service";

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

const routeResult = (distanceM: number, durationSec: number): RouteResult => ({
  coordinates: [from, to],
  distanceM,
  durationSec,
  steps: [],
});

describe("cycleway-first route selection", () => {
  it("keeps the cycleway-first candidate when its detour remains reasonable", () => {
    const cycleway = routeResult(11_000, 2_100);
    const road = routeResult(10_000, 1_900);

    expect(selectBikeRouteCandidate(cycleway, road)).toBe(cycleway);
  });

  it("uses the general bicycle route when the cycleway option is over 30% longer", () => {
    const cycleway = routeResult(13_100, 2_400);
    const road = routeResult(10_000, 2_000);

    expect(selectBikeRouteCandidate(cycleway, road)).toBe(road);
  });

  it("uses the general bicycle route when the cycleway route is both longer and materially slower", () => {
    const cycleway = routeResult(11_500, 2_500);
    const road = routeResult(10_000, 2_000);

    expect(selectBikeRouteCandidate(cycleway, road)).toBe(road);
  });

  it("falls back to the available engine when the other candidate cannot be routed", () => {
    const road = routeResult(10_000, 2_000);
    expect(selectBikeRouteCandidate(null, road)).toBe(road);
    expect(selectBikeRouteCandidate(road, null)).toBe(road);
  });
});
