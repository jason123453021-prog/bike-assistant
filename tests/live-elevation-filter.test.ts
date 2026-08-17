import { describe, expect, it } from "vitest";
import {
  acceptLiveElevationChange,
  clampVirtualPowerForRider,
  createLiveElevationFilterState,
} from "../lib/live-elevation-filter";

describe("即時海拔與虛擬功率保護", () => {
  it("不將小幅 GPS 海拔抖動重複累計為爬升", () => {
    const state = createLiveElevationFilterState();
    expect(acceptLiveElevationChange(state, 100, 20)).toBe(0);
    expect(acceptLiveElevationChange(state, 106, 20)).toBe(0);
    expect(acceptLiveElevationChange(state, 109, 20)).toBe(0);
    expect(acceptLiveElevationChange(state, 111, 20)).toBe(11);
  });

  it("保留跨過死區的真實上坡，並限制虛擬最大功率尖峰", () => {
    const state = createLiveElevationFilterState();
    acceptLiveElevationChange(state, 100, 20);
    expect(acceptLiveElevationChange(state, 116, 25)).toBe(16);
    expect(clampVirtualPowerForRider(900, 200)).toBe(500);
  });
});
