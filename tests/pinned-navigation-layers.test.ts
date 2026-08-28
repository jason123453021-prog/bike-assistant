import { describe, expect, it } from "vitest";
import {
  applyPinnedNavigationDecision,
  hasExistingNavigationLayers,
} from "../lib/pinned-navigation-layers";

describe("pinned navigation layer decisions", () => {
  it("asks for confirmation when either a GPX route or a prior pin route exists", () => {
    expect(hasExistingNavigationLayers(true, 0)).toBe(true);
    expect(hasExistingNavigationLayers(false, 1)).toBe(true);
    expect(hasExistingNavigationLayers(false, 0)).toBe(false);
  });

  it("replaces all old pin routes when the user chooses to clear", () => {
    const result = applyPinnedNavigationDecision(
      [{ id: "old", route: "old route" }],
      { id: "new", route: "new route" },
      true,
    );
    expect(result).toEqual([{ id: "new", route: "new route" }]);
  });

  it("keeps old and new pin routes when the user chooses to preserve", () => {
    const result = applyPinnedNavigationDecision(
      [{ id: "old", route: "old route" }],
      { id: "new", route: "new route" },
      false,
    );
    expect(result.map((layer) => layer.id)).toEqual(["old", "new"]);
  });
});
