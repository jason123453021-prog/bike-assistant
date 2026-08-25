import { describe, expect, it } from "vitest";

import {
  nextLocationCameraMode,
  resolveLocationCameraInstruction,
  shouldApplyCogRotation,
} from "../lib/map-location-mode";

describe("三階段定位鏡頭模式", () => {
  it("依 COG 朝前、自由角度、正北置中的順序循環", () => {
    expect(nextLocationCameraMode("heading-up")).toBe("free-heading");
    expect(nextLocationCameraMode("free-heading")).toBe("north-up");
    expect(nextLocationCameraMode("north-up")).toBe("heading-up");
  });

  it("只讓朝前模式根據實際 COG 平滑旋轉地圖", () => {
    expect(shouldApplyCogRotation("heading-up")).toBe(true);
    expect(shouldApplyCogRotation("free-heading")).toBe(false);
    expect(shouldApplyCogRotation("north-up")).toBe(false);
    expect(resolveLocationCameraInstruction("heading-up", 90)).toEqual({
      recenter: true,
      bearing: 270,
      headingUp: true,
    });
    expect(resolveLocationCameraInstruction("heading-up", null)).toEqual({
      recenter: true,
      bearing: null,
      headingUp: true,
    });
  });

  it("自由角度保留手動旋轉，正北置中強制回到 0°", () => {
    expect(resolveLocationCameraInstruction("free-heading", 90)).toEqual({
      recenter: true,
      bearing: null,
      headingUp: false,
    });
    expect(resolveLocationCameraInstruction("north-up", 90)).toEqual({
      recenter: true,
      bearing: 0,
      headingUp: false,
    });
  });
});
