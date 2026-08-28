import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const appConfigSource = readFileSync(resolve(projectRoot, "app.config.ts"), "utf8");
const packageSource = readFileSync(resolve(projectRoot, "package.json"), "utf8");
const prewarmSource = readFileSync(resolve(projectRoot, "scripts/prewarm-expo-go-bundle.sh"), "utf8");

describe("Expo Go startup stability", () => {
  it("avoids static web SSR while Metro serves the Android preview", () => {
    expect(appConfigSource).toContain('output: "single"');
    expect(appConfigSource).not.toContain('output: "static"');
  });

  it("keeps preview and Expo Go Metro processes memory-bounded", () => {
    expect(packageSource).toContain("--max-workers 1");
    expect(packageSource).toContain("--max-old-space-size=1536");
    expect(packageSource).toContain('"dev": "pnpm dev:preview"');
    expect(packageSource).toContain('"dev:preview"');
    expect(packageSource).toContain('"expo:go"');
    expect(packageSource).toContain("expo start --web");
    expect(packageSource).toContain("expo start --tunnel");
    expect(packageSource).toContain("-u EXPO_PACKAGER_PROXY_URL");
    expect(packageSource).not.toContain("EXPO_NO_INTERACTIVE=1");
    expect(packageSource).not.toContain("expo start --clear");
    expect(packageSource).not.toContain("npx expo start --offline");
    expect(packageSource).not.toContain("--no-dev");
    expect(packageSource).not.toContain("--minify");
  });

  it("prewarms the Android Hermes bundle only for the independent Expo Go tunnel", () => {
    expect(packageSource).toContain("prewarm-expo-go-bundle.sh");
    expect(prewarmSource).toContain("platform=android");
    expect(prewarmSource).toContain("transform.bytecode=1");
    expect(prewarmSource).toContain("curl --fail");
  });
});
