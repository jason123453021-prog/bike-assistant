import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sourceFiles = [
  "app/(tabs)/_layout.tsx",
  "app/(tabs)/map.tsx",
  "app/(tabs)/settings.tsx",
  "app/ride-detail.tsx",
  "components/supply-modal.tsx",
  "components/zoomable-activity-photo.tsx",
].map((path) => readFileSync(resolve(process.cwd(), path), "utf8"));
const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
);
const sourceWithoutFreeHeadingElevation = sourceFiles
  .map((source) =>
    source.replace(/freeHeadingToolBtn:\s*\{[\s\S]*?\n\s*\},/, ""),
  )
  .join("\n");

describe("deprecated React Native UI style migration", () => {
  it("does not use JSX pointerEvents props or legacy shadow styles outside the documented free-heading map affordance", () => {
    const source = sourceFiles.join("\n");
    expect(source).not.toMatch(/pointerEvents=/);
    expect(sourceWithoutFreeHeadingElevation).not.toMatch(
      /shadow(Color|Offset|Opacity|Radius)\s*:/,
    );
    expect(sourceWithoutFreeHeadingElevation).not.toMatch(/\belevation\s*:/);
    expect(mapSource).toContain("freeHeadingToolBtn");
    expect(mapSource).toContain("elevation: 5");
  });

  it("uses current style-based interaction control and box shadows where needed", () => {
    const source = sourceFiles.join("\n");
    expect(source).toContain('pointerEvents: "none"');
    expect(source).toContain('pointerEvents: "box-none"');
    expect(source).toContain("boxShadow:");
  });
});
