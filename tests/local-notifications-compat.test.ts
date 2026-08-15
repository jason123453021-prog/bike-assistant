import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("Expo Go notification compatibility", () => {
  it("keeps expo-notifications behind the StoreClient guard", () => {
    const source = readProjectFile("lib/local-notifications.ts");

    expect(source).toContain("ExecutionEnvironment.StoreClient");
    expect(source).toContain('return Platform.OS !== "web" && !isExpoGoRuntime()');
    expect(source).toContain('import("expo-notifications")');
  });

  it("does not statically load expo-notifications from startup-facing modules", () => {
    const startupFiles = [
      "lib/feedback-service.ts",
      "lib/background-location.ts",
      "lib/permissions-manager.ts",
    ];

    for (const file of startupFiles) {
      const source = readProjectFile(file);
      expect(source).not.toMatch(/import\s+\*\s+as\s+Notifications\s+from\s+["']expo-notifications["']/);
      expect(source).toContain("getLocalNotifications");
    }
    expect(existsSync(resolve(projectRoot, "lib/foreground-service/foreground-service-manager.ts"))).toBe(false);
  });
});
