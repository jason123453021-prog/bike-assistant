import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("share card clipboard action", () => {
  it("uses Expo's official clipboard module instead of acknowledging a copy without writing data", () => {
    const source = readFileSync(resolve(process.cwd(), "components/share-card-modal.tsx"), "utf8");
    expect(source).toContain('import * as Clipboard from "expo-clipboard"');
    expect(source).toContain("await Clipboard.setStringAsync(shareText)");
    expect(source).toContain("onPress={handleCopyShareText}");
    expect(source).not.toContain("TODO: 實現複製功能");
  });

  it("handles empty content and clipboard failures with user-facing feedback", () => {
    const source = readFileSync(resolve(process.cwd(), "components/share-card-modal.tsx"), "utf8");
    expect(source).toContain("無可複製內容");
    expect(source).toContain("複製失敗");
  });
});
