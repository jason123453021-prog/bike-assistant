import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const iconSource = readFileSync(resolve(process.cwd(), "components/ui/icon-symbol.tsx"), "utf8");

describe("icon symbol fallbacks", () => {
  it("maps the ride summary add action and never falls back to a question icon", () => {
    expect(iconSource).toMatch(/"plus":\s*"add"/);
    expect(iconSource).toContain('?? "more-horiz"');
    expect(iconSource).not.toContain('?? "help-outline"');
  });

  it("does not contain explicit question-mark symbol mappings", () => {
    expect(iconSource).not.toMatch(/questionmark|question\.circle|help\.circle/);
  });
});
