import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(");

describe("地址導航離線回退", () => {
  it("將網路或地理編碼失敗留在同頁提示，不以 Alert 阻斷騎乘畫面", () => {
    expect(mapSource).toContain('setPinAddressNotice("地址搜尋暫時不可用。');
    expect(mapSource).toContain("styles.pinAddressNotice");
    expect(mapSource).toContain('accessibilityLiveRegion="polite"');
    expect(mapSource).not.toContain('Alert.alert("地址搜尋暫時不可用"');
  });

  it("在無候選或重新輸入時清除舊候選與提示，避免顯示過期結果", () => {
    expect(mapSource).toContain("setPinAddressCandidates([]);");
    expect(mapSource).toContain('setPinAddressNotice("找不到地址。');
    expect(mapSource).toContain("setPinAddressNotice(null);");
  });
});
