import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boundarySource = readFileSync(
  resolve(process.cwd(), "components/app-error-boundary.tsx"),
  "utf8",
);
const rootLayoutSource = readFileSync(
  resolve(process.cwd(), "app/_layout.tsx"),
  "utf8",
);

describe("global error boundary release guardrail", () => {
  it("wraps the root provider tree in an app-level error boundary", () => {
    expect(rootLayoutSource).toContain(
      'import { AppErrorBoundary } from "@/components/app-error-boundary";',
    );
    expect(rootLayoutSource).toContain("<AppErrorBoundary>");
    expect(rootLayoutSource).toContain("</AppErrorBoundary>");
  });

  it("provides a safe localized fallback with an accessible retry action", () => {
    expect(boundarySource).toContain("static getDerivedStateFromError");
    expect(boundarySource).toContain('i18n.t("audit.errorTitle")');
    expect(boundarySource).toContain('i18n.t("audit.errorDescription")');
    expect(boundarySource).toContain(
      'accessibilityLabel={i18n.t("audit.retry")}',
    );
    expect(boundarySource).toContain(
      'edges={["top", "bottom", "left", "right"]}',
    );
  });

  it("does not emit uncaught exception details through console logging", () => {
    expect(boundarySource).not.toMatch(
      /console\.(log|debug|info|warn|error)\(/,
    );
  });
});
