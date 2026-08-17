import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const appConfigSource = readFileSync(resolve(projectRoot, "app.config.ts"), "utf8");
const packageSource = readFileSync(resolve(projectRoot, "package.json"), "utf8");

describe("Expo Go startup stability", () => {
  it("avoids static web SSR while Metro serves the Android preview", () => {
    expect(appConfigSource).toContain('output: "single"');
    expect(appConfigSource).not.toContain('output: "static"');
  });

  it("keeps Metro memory-bounded while serving a current Expo Go development manifest", () => {
    expect(packageSource).toContain("EXPO_NO_INTERACTIVE=1");
    expect(packageSource).toContain("--max-workers 1");
    expect(packageSource).toContain("--max-old-space-size=1536");
    expect(packageSource).not.toContain("npx expo start --offline");
    expect(packageSource).not.toContain("--no-dev");
    expect(packageSource).not.toContain("--minify");
  });
});
