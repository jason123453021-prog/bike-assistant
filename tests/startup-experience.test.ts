import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootLayout = readFileSync(resolve(process.cwd(), "app/_layout.tsx"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("啟動體驗與部署建置守門", () => {
  it("在第一個原生根布局後淡出 Splash，避免白屏且不加入人工延遲", () => {
    expect(rootLayout).toContain("SplashScreen.preventAutoHideAsync()");
    expect(rootLayout).toContain("SplashScreen.setOptions({ duration: 220, fade: true })");
    expect(rootLayout).toContain("onLayout={hideNativeSplashAfterFirstLayout}");
    expect(rootLayout).toContain("SplashScreen.hideAsync()");
    expect(rootLayout).not.toContain("new Promise(resolve => setTimeout(resolve, 2000))");
  });

  it("將每週模型檢查與舊快取清理延後至首屏後執行", () => {
    expect(rootLayout).toContain("checkModelUpdateOnAppLaunch();");
    expect(rootLayout).toContain("}, 600);");
    expect(rootLayout).toContain("clearLegacyFavoritesCache(AsyncStorage)");
    expect(rootLayout).toContain("}, 900);");
  });

  it("保留部署容器所需的靜態 Web build 指令", () => {
    expect(packageJson.scripts.build).toBe("expo export --platform web --output-dir dist");
  });
});
