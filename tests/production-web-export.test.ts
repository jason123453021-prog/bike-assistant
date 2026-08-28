import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const metroConfig = readFileSync(resolve(process.cwd(), "metro.config.js"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const staticServer = readFileSync(resolve(process.cwd(), "scripts/static-server.cjs"), "utf8");

describe("正式 Web 匯出守門", () => {
  it("只在非 CI 的開發期寫入 NativeWind CSS 快取檔", () => {
    expect(metroConfig).toContain('const shouldWriteNativeWindCache = process.env.NODE_ENV !== "production" && process.env.CI !== "true";');
    expect(metroConfig).toContain("forceWriteFileSystem: shouldWriteNativeWindCache");
    expect(metroConfig).not.toContain("forceWriteFileSystem: true");
  });

  it("以 production 環境執行靜態匯出，並建立部署容器需要的入口", () => {
    expect(packageJson.scripts.build).toBe("cross-env NODE_ENV=production expo export --platform web --output-dir dist && cp scripts/static-server.cjs dist/index.js");
    expect(packageJson.scripts.start).toBe("node dist/index.js");
    expect(staticServer).toContain('const port = Number.parseInt(process.env.PORT ?? "3000", 10);');
    expect(staticServer).toContain('server.listen(port, "0.0.0.0"');
    expect(staticServer).toContain('const fallbackPath = path.join(distDirectory, "index.html");');
  });
});
