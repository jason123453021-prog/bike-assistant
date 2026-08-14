import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const containerSource = readFileSync(resolve(process.cwd(), "components/screen-container.tsx"), "utf8");

describe("app health guardrails", () => {
  it("keeps understandable Chinese fallbacks for location, offline address search, and local storage failures", () => {
    expect(mapSource).toContain("需要定位權限");
    expect(mapSource).toContain("地址搜尋暫時不可用");
    expect(mapSource).toContain("本機儲存失敗");
    expect(mapSource).toContain("請確認可用空間後重新開啟 App");
  });

  it("uses safe-area aware screen containment for device cutouts and navigation bars", () => {
    expect(containerSource).toContain("SafeAreaView");
    expect(containerSource).toContain('edges = ["top", "left", "right"]');
  });
});
