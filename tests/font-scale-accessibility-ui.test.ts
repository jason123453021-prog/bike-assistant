import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
).replace(/\s+/g, " ");
const settingsSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/settings.tsx"),
  "utf8",
);
const historySource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/history.tsx"),
  "utf8",
);
const navigateSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/navigate.tsx"),
  "utf8",
);
const rideDetailSource = readFileSync(
  resolve(process.cwd(), "app/ride-detail.tsx"),
  "utf8",
);
const supplyModalSource = readFileSync(
  resolve(process.cwd(), "components/custom-supply-item-modal.tsx"),
  "utf8",
);

describe("130%／200% 字體縮放可讀性守門", () => {
  it("在 130% 與 200% 縮放時提供較高的地圖面板與兩欄儀表板", () => {
    expect(mapSource).toContain("const { fontScale } = useWindowDimensions();");
    expect(mapSource).toContain(
      "const dashboardColumnCount = fontScale >= 1.6 ? 2 : 3;",
    );
    expect(mapSource).toContain(
      "const dashboardCellMinHeight = fontScale >= 1.6 ? 106 : fontScale >= 1.3 ? 86 : 76;",
    );
    expect(mapSource).toContain("const expandedPanelHeight");
    expect(mapSource).toContain("fontScale >= 1.6 ? 0.82");
  });

  it("讓導航、地址候選與釘選名稱可換行，而不是以單行省略關鍵資訊", () => {
    expect(mapSource).not.toContain(
      "styles.turnBannerTitle} numberOfLines={1}",
    );
    expect(mapSource).not.toContain(
      "styles.pinAddressResultTitle} numberOfLines={1}",
    );
    expect(mapSource).not.toContain("styles.pinCardTitle} numberOfLines={1}");
    expect(mapSource).not.toContain("turnBannerTitle");
  });

  it("使地圖的資訊列、控制列與補給進度列可以換行並保留最小觸控高度", () => {
    expect(mapSource).toContain("weatherRow: {");
    expect(mapSource).toContain('flexWrap: "wrap"');
    expect(mapSource).toContain(
      'preRideControls: { flexDirection: "row", flexWrap: "wrap"',
    );
    expect(mapSource).toContain(
      'activeButtons: { flexDirection: "row", flexWrap: "wrap"',
    );
    expect(mapSource).toContain("startBtn: {");
    expect(mapSource).toContain("minHeight: 52");
  });

  it("讓設定列標籤保有彈性寬度，且長名稱不在歷史、路線與活動詳情頁被單行截斷", () => {
    expect(settingsSource).toMatch(/rowRight:\s*{\s*flexShrink:\s*0/);
    expect(settingsSource).toMatch(/rowValue:\s*{\s*flexShrink:\s*1/);
    expect(settingsSource).toMatch(/color:\s*colors\.foreground,\s*flex:\s*1/);
    expect(historySource).not.toContain(
      "styles.routeName, { color: colors.foreground }]} numberOfLines={1}",
    );
    expect(navigateSource).not.toContain(
      "styles.routeName, { color: colors.foreground }]} numberOfLines={1}",
    );
    expect(rideDetailSource).not.toContain(
      "style={styles.routeName} numberOfLines={1}",
    );
  });

  it("讓自訂補給品的數值輸入欄可隨放大字體增加高度", () => {
    expect(supplyModalSource).toContain("minHeight: 48");
    expect(supplyModalSource).toContain("paddingVertical: 10");
  });
});
