import { describe, expect, it } from "vitest";
import {
  shouldTrackRideHeading,
  shouldTrackRideLocation,
} from "../lib/ride-tracking-lifecycle";

describe("ride tracking lifecycle", () => {
  it("does not subscribe to GPS while waiting to start a ride", () => {
    expect(shouldTrackRideLocation(false)).toBe(false);
  });

  it("keeps GPS active for an ongoing ride session", () => {
    expect(shouldTrackRideLocation(true)).toBe(true);
  });

  it("only subscribes to the compass during an active heading-up ride", () => {
    expect(shouldTrackRideHeading(false, true)).toBe(false);
    expect(shouldTrackRideHeading(true, false)).toBe(false);
    expect(shouldTrackRideHeading(true, true)).toBe(true);
  });
});
