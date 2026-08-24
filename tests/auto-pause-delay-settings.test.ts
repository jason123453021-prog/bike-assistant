import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAutoPauseDelaySec } from "../lib/settings-context";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("自動暫停延遲時間設定", () => {
  it("以 8 秒為預設，並將無效或超出範圍的輸入收斂為 3–120 秒", () => {
    expect(normalizeAutoPauseDelaySec(undefined)).toBe(8);
    expect(normalizeAutoPauseDelaySec("not-a-number")).toBe(8);
    expect(normalizeAutoPauseDelaySec(1)).toBe(3);
    expect(normalizeAutoPauseDelaySec(8.4)).toBe(8);
    expect(normalizeAutoPauseDelaySec(999)).toBe(120);
  });

  it("讓設定頁、前景低速判定、無 GPS 看門狗與背景定位共用使用者延遲時間", () => {
    const settingsSource = source("app/(tabs)/settings.tsx");
    const mapSource = source("app/(tabs)/map.tsx");
    const backgroundSource = source("lib/background-location.ts");

    expect(settingsSource).toContain('label="自動暫停延遲時間"');
    expect(settingsSource).toContain("settings.autoPauseDelaySec");
    expect(mapSource).toContain("stillForSeconds: settings.autoPauseDelaySec");
    expect(mapSource).toContain("settings.autoPauseDelaySec * 1_000");
    expect(mapSource).toContain("autoPauseStillForSeconds: settings.autoPauseDelaySec");
    expect(backgroundSource).toContain("pauseAfterSec: state.autoPauseStillForSeconds ?? 8");
  });
});
