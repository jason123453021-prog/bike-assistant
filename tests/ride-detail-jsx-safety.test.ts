import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function collectNonWhitespaceJsxText(node: ts.Node, found: string[], withinText = false) {
  if (ts.isJsxText(node) && !withinText && node.getText().trim()) {
    found.push(node.getText().trim());
    return;
  }
  if (ts.isJsxElement(node)) {
    const tagName = node.openingElement.tagName.getText();
    const childWithinText = withinText || tagName === "Text" || tagName === "SvgText";
    node.children.forEach((child) => collectNonWhitespaceJsxText(child, found, childWithinText));
    return;
  }
  node.forEachChild((child) => collectNonWhitespaceJsxText(child, found, withinText));
}

describe("ride detail JSX safety", () => {
  it("does not leave raw text nodes inside React Native views", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");
    const ast = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rawTextNodes: string[] = [];
    collectNonWhitespaceJsxText(ast, rawTextNodes);

    expect(rawTextNodes).toEqual([]);
    expect(source).not.toContain("90m/*");
  });

  it("uses a compact route hero with a unified route-and-photo horizontal viewer", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("isActivityViewerVisible");
    expect(source).toContain("activityViewerRoutePage");
    expect(source).toContain("pagingEnabled");
    expect(source).toContain("activityViewerPhotoMeta");
    expect(source).toContain("photoRouteMarkers");
    expect(source).toContain("photoMarkers={photoRouteMarkers}");
    expect(source).toContain("ZoomableActivityPhoto");
    expect(source).toContain("CoreActivitySummaryGrid");
    expect((source.match(/<CoreActivitySummaryGrid/g) ?? []).length).toBe(2);
    expect(source).toContain("activityInitialSummary");
    expect(source).toContain("activityDetailsAfterInitial");
    expect(source).toMatch(/activityInitialSummary[\s\S]*activityDetailsAfterInitial[\s\S]*CoreActivitySummaryGrid/);
    expect(source).toContain("爬升海拔");
    expect(source).toContain("平均功率");
    expect(source).toContain("平均速度");
    expect(source).toContain("卡路里");
    expect(source).toContain("coreActivitySummaryMetricPrimary");
    expect(source).toContain("coreActivitySummaryValueRow");
    expect(source).toContain("ACTIVITY_DETAIL_MAIN_HERO_HEIGHT = Math.min(320");
    expect(source).not.toContain("全螢幕路線");
    expect(source).not.toContain("styles.activityViewerDrawerHandle");
    expect(source).not.toContain("styles.activityViewerDrawerHint");
    expect(source).toContain("activityViewerRoutePhotoMeta");
    expect(source).toContain("活動封面照片");
    expect(source).toContain("coverPhotoUri");
    expect(source).toContain("routeMapPhotoThumbButton");
    expect(source).toContain("activityViewerMode === \"route\"");
    expect(source).toContain("activityViewerDrawer");
    expect(source).toContain("record.tss !== undefined && record.tss > 0");
    expect(source).not.toContain("{record.tss && (");
    expect(source).not.toContain("activityMediaHero");
    expect(source).not.toContain("isMapDetailVisible");
  });

  it("keeps map gestures outside the black detail scroll region", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");
    const mapHeroIndex = source.indexOf('<View style={styles.mapHero}>');
    const detailScrollIndex = source.indexOf('style={styles.activityDetailScroll}');

    expect(mapHeroIndex).toBeGreaterThan(-1);
    expect(detailScrollIndex).toBeGreaterThan(mapHeroIndex);
    expect(source).not.toContain("isEmbeddedMapInteracting");
    expect(source).not.toContain("activityRouteTapTarget");
    expect(source).not.toContain("activityRouteExpandButton");
    expect(source).toContain("activityMapPolyline");
  });
});
