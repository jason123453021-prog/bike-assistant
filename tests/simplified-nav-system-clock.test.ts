import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("simplified navigation system clock", () => {
  it("uses the same formatted device clock as the primary dashboard", () => {
    const map = read("app/(tabs)/map.tsx");
    expect(map).toContain("currentTime={formatPausedSystemClock(systemClockNow)}");
  });

  it("renders the clock in a fixed high-contrast overlay position instead of duplicating it in ride metrics", () => {
    const overlay = read("components/simplified-nav-overlay.tsx");
    expect(overlay).toContain("<View style={styles.systemClock}");
    expect(overlay).toContain("系統時間");
    expect(overlay).toContain("position: \"absolute\"");
    expect(overlay).not.toContain('showCurrentTime: () => f.showCurrentTime');
  });
});
