import { describe, expect, it } from "vitest";
import {
  selectDirectionSource,
  stabilizeMapHeading,
} from "../lib/compass-gps-optimizer";

describe("車頭方向來源", () => {
  const compass = { heading: 35, accuracy: 12, timestamp: Date.now() };

  it("單車穩定行進時優先使用 GPS 行進向量", () => {
    expect(selectDirectionSource(compass, { bearing: 48, accuracy: 10, speed: 4, timestamp: Date.now() })).toBe("gps");
  });

  it("低速時使用羅盤以避免 GPS 航向噪音", () => {
    expect(selectDirectionSource(compass, { bearing: 48, accuracy: 10, speed: 0.2, timestamp: Date.now() })).toBe("compass");
  });

  it("低速、低精度與小幅角度變化不會帶動車頭朝前地圖", () => {
    expect(stabilizeMapHeading(64, 60, 18, 10)).toBeNull();
    expect(stabilizeMapHeading(100, 60, 5, 10)).toBeNull();
    expect(stabilizeMapHeading(100, 60, 18, 50)).toBeNull();
  });

  it("可信行進方向會以有限角度平滑轉向，避免一次大幅擺動", () => {
    expect(stabilizeMapHeading(170, 60, 18, 10)).toBe(95);
    expect(stabilizeMapHeading(10, 350, 18, 10)).toBe(10);
  });
});
