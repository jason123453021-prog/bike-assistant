import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("history action cleanup", () => {
  it("opens the activity detail by tapping the card and does not keep redundant route or navigation actions", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app", "(tabs)", "history.tsx"), "utf8");
    expect(source).toContain("onPress={() => handleViewDetail(item.id)}");
    expect(source).not.toContain("查看軌跡");
    expect(source).not.toContain("再次導航");
    expect(source).not.toContain("handleReuseRoute");
    expect(source).not.toContain("createRouteFromRideRecord");
  });
});
