import { describe, expect, it } from "vitest";
import {
  shouldTrackRideHeading,
  shouldTrackRideLocation,
} from "../lib/ride-tracking-lifecycle";

describe("ride tracking lifecycle", () => {
  it("allows foreground GPS when waiting to start a ride, but suppresses background GPS until ride starts", () => {
    expect(shouldTrackRideLocation(false, true)).toBe(true);
    expect(shouldTrackRideLocation(false, false)).toBe(false);
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
