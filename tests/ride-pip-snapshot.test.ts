import { describe, expect, it } from "vitest";

import { buildRidePipSnapshot } from "../lib/ride-pip-snapshot";

describe("Android ride PiP snapshot", () => {
  it("only enables system PiP for an active or paused ride", () => {
    expect(buildRidePipSnapshot({
      status: "active",
      instruction: "前方右轉",
      turnDistanceM: 120,
      speedKmh: 24.6,
      distanceM: 12345,
    })).toMatchObject({ active: true, paused: false, distanceKm: 12.345 });

    expect(buildRidePipSnapshot({
      status: "paused",
      instruction: "",
      turnDistanceM: 0,
      speedKmh: 0,
      distanceM: 12345,
    })).toMatchObject({ active: true, paused: true, instruction: "騎乘已暫停" });

    expect(buildRidePipSnapshot({
      status: "finished",
      instruction: "前方右轉",
      turnDistanceM: 100,
      speedKmh: 20,
      distanceM: 1000,
    }).active).toBe(false);
  });

  it("sanitizes invalid readings without changing the ride source of truth", () => {
    expect(buildRidePipSnapshot({
      status: "active",
      instruction: "",
      turnDistanceM: Number.NaN,
      speedKmh: -10,
      distanceM: Number.POSITIVE_INFINITY,
    })).toEqual({
      active: true,
      paused: false,
      instruction: "騎乘中",
      turnDistanceM: 0,
      speedKmh: 0,
      distanceKm: 0,
    });
  });
});
