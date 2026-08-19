import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "components/share-card-modal.tsx"), "utf8");

describe("分享卡複製文字", () => {
  it("以官方 Clipboard 實際寫入分享文字並顯示成功或失敗回饋", () => {
    expect(source).toContain('import * as Clipboard from "expo-clipboard"');
    expect(source).toContain("const handleCopyShareText = async () =>");
    expect(source).toContain("await Clipboard.setStringAsync(shareText)");
    expect(source).toContain('Alert.alert("已複製", "分享文字已複製到剪貼板")');
    expect(source).toContain('Alert.alert("複製失敗", "無法寫入系統剪貼板，請稍後再試。")');
    expect(source).not.toContain("TODO: 實現複製功能");
  });
});
