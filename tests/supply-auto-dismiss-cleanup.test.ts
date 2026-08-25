import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\{\s+/g, "{")
  .replace(/<\s+/g, "<")
  .replace(/,\s*\)/g, ")");

describe("一般補給自動關閉 timer 的資源清理", () => {
  it("以類型化 ref 集中追蹤能量與補水的自動關閉 timer", () => {
    expect(mapSource).toContain("const supplyAutoDismissTimersRef = useRef<");
    expect(mapSource).toContain('Partial<Record<"calorie" | "water"');
    expect(mapSource).toContain("const clearSupplyAutoDismissTimer = useCallback(");
    expect(mapSource).toContain('(type?: "calorie" | "water") => {');
  });

  it("在確認、稍後、清除所有提醒與卸載時釋放 timer", () => {
    expect(mapSource).toContain('clearSupplyAutoDismissTimer("calorie")');
    expect(mapSource).toContain('clearSupplyAutoDismissTimer("water")');
    expect(mapSource).toContain("clearSupplyAutoDismissTimer(kind)");
    expect(mapSource).toContain("supplySnoozedUntilRef.current[kind] = until");
    expect(mapSource).toContain("() => () => clearSupplyAutoDismissTimer()");
    expect(mapSource).toContain("Object.values(supplyItemsTrackerRef.current)");
  });

  it("重排自動關閉前先取消同類型舊 timer，避免過期回呼關閉新提醒", () => {
    expect(mapSource).toContain("clearSupplyAutoDismissTimer(type)");
    expect(mapSource).toContain("const autoDismissTimer = setTimeout(() => {");
    expect(mapSource).toContain(
      "supplyAutoDismissTimersRef.current[type] = autoDismissTimer;",
    );
  });
});
