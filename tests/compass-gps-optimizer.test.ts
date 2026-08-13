import { describe, expect, it } from "vitest";
import { selectDirectionSource } from "../lib/compass-gps-optimizer";

describe("車頭方向來源", () => {
  const compass = { heading: 35, accuracy: 12, timestamp: Date.now() };

  it("單車穩定行進時優先使用 GPS 行進向量", () => {
    expect(selectDirectionSource(compass, { bearing: 48, accuracy: 10, speed: 4, timestamp: Date.now() })).toBe("gps");
  });

  it("低速時使用羅盤以避免 GPS 航向噪音", () => {
    expect(selectDirectionSource(compass, { bearing: 48, accuracy: 10, speed: 0.2, timestamp: Date.now() })).toBe("compass");
  });
});
