import { describe, expect, it } from "vitest";
import {
  acceptLiveElevationChange,
  acceptLiveElevationDelta,
  clampVirtualPowerForRider,
  createLiveElevationFilterState,
} from "../lib/live-elevation-filter";

describe("即時海拔與虛擬功率保護", () => {
  it("不將小幅 GPS 海拔抖動重複累計為爬升", () => {
    const state = createLiveElevationFilterState();
    expect(acceptLiveElevationChange(state, 100, 20)).toBe(0);
    expect(acceptLiveElevationChange(state, 106, 20)).toBe(3);
    expect(acceptLiveElevationChange(state, 109, 20)).toBe(0);
    expect(acceptLiveElevationChange(state, 111, 20)).toBe(3.5);
  });

  it("保留跨過死區的真實上坡，並限制虛擬最大功率尖峰", () => {
    const state = createLiveElevationFilterState();
    acceptLiveElevationChange(state, 100, 20);
    expect(acceptLiveElevationChange(state, 116, 25)).toBe(8);
    expect(clampVirtualPowerForRider(900, 200)).toBe(500);
  });

  it("以相同死區與距離守門同步累計下降與可信海拔", () => {
    const state = createLiveElevationFilterState();
    expect(acceptLiveElevationDelta(state, 250, 20)).toMatchObject({ ascentM: 0, descentM: 0, acceptedAltitudeM: 250 });
    expect(acceptLiveElevationDelta(state, 241, 20)).toMatchObject({ ascentM: 0, descentM: 4.5, acceptedAltitudeM: 245.5 });
    expect(acceptLiveElevationDelta(state, 234, 20)).toMatchObject({ ascentM: 0, descentM: 3.833333333333343, acceptedAltitudeM: 241.66666666666666 });
  });
});
