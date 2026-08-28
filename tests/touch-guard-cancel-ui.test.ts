import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("觸控鎖長按取消", () => {
  it("在按壓離開、系統終止或 App 轉背景時都清除長按百分比與計時器", () => {
    const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
    expect(mapSource).toContain("onPressOut={resetTouchGuardHoldProgress}");
    expect(mapSource).toContain("onResponderTerminate={resetTouchGuardHoldProgress}");
    expect(mapSource).toContain("if (!isAppForeground) resetTouchGuardHoldProgress();");
    expect(mapSource).toContain("setTouchGuardHoldProgress(0);");
  });
});
