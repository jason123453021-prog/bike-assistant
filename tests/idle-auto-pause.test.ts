import { describe, expect, it } from "vitest";
import { shouldEnterIdleMonitor, shouldResumeFromIdleMonitor } from "../lib/idle-auto-pause";

describe("idle auto-pause power saving", () => {
  const config = { enabled: true, idleTimeoutSeconds: 120 };

  it("only changes to low-power monitoring after the configured paused duration", () => {
    expect(shouldEnterIdleMonitor(config, true, 1_000, 120_999)).toBe(false);
    expect(shouldEnterIdleMonitor(config, true, 1_000, 121_000)).toBe(true);
    expect(shouldEnterIdleMonitor(config, false, 1_000, 200_000)).toBe(false);
  });

  it("does not enter low-power monitoring while the feature is disabled", () => {
    expect(shouldEnterIdleMonitor({ enabled: false, idleTimeoutSeconds: 60 }, true, 0, 100_000)).toBe(false);
  });

  it("automatically resumes full tracking from speed or confirmed movement", () => {
    expect(shouldResumeFromIdleMonitor(3, 0)).toBe(true);
    expect(shouldResumeFromIdleMonitor(0, 18)).toBe(true);
    expect(shouldResumeFromIdleMonitor(1.5, 8)).toBe(false);
  });
});
