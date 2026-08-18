import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { formatPausedSystemClock } from "../lib/paused-system-clock";

describe("paused system clock", () => {
  it("formats the device clock in a stable 24-hour display", () => {
    expect(formatPausedSystemClock(new Date(2026, 7, 18, 9, 4))).toBe("09:04");
    expect(formatPausedSystemClock(new Date(2026, 7, 18, 18, 37))).toBe("18:37");
  });

  it("keeps the clock in a fixed dashboard position and outside ride timing dispatches", () => {
    const map = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
    expect(map).toContain("const [systemClockNow, setSystemClockNow] = useState(() => new Date())");
    expect(map).toContain("setInterval(updateClock, 30_000)");
    expect(map).toContain("<View style={styles.systemTimeRow}");
    expect(map).toContain("系統時間");
    expect(map).toContain("formatPausedSystemClock(systemClockNow)");
    expect(map).not.toContain('dispatch({ type: "SYSTEM_TIME"');
  });
});
