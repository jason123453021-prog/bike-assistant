import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const safeLogSource = readFileSync(resolve(process.cwd(), "lib/release-safe-log.ts"), "utf8");
const appStateSource = readFileSync(resolve(process.cwd(), "hooks/use-app-state-listener.ts"), "utf8");
const rootLayoutSource = readFileSync(resolve(process.cwd(), "app/_layout.tsx"), "utf8");
const backgroundSource = readFileSync(resolve(process.cwd(), "lib/background-location.ts"), "utf8");

describe("release-safe diagnostic guardrail", () => {
  it("limits recoverable diagnostics to development builds", () => {
    expect(safeLogSource).toContain("if (__DEV__)");
    expect(safeLogSource).toContain("console.error(context, error)");
  });

  it("does not retain AppState transition console logs on a riding hot path", () => {
    expect(appStateSource).not.toMatch(/console\.(log|debug|info|warn|error)\(/);
  });

  it("routes non-blocking root and background exceptions through the release-safe helper", () => {
    expect(rootLayoutSource).toContain("reportRecoverableIssue");
    expect(backgroundSource).toContain("reportRecoverableIssue");
    expect(backgroundSource).not.toMatch(/console\.(log|debug|info|warn|error)\(/);
  });
});
