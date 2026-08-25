import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveActivityCoverPhotoUri } from "../lib/activity-media";

describe("activity media presentation", () => {
  it("uses the selected local cover only while its source photo remains available", () => {
    const photos = ["file:///ride/photo-a.jpg", "file:///ride/photo-b.jpg"];

    expect(resolveActivityCoverPhotoUri(" file:///ride/photo-b.jpg ", photos)).toBe("file:///ride/photo-b.jpg");
    expect(resolveActivityCoverPhotoUri("file:///ride/removed.jpg", photos)).toBeUndefined();
    expect(resolveActivityCoverPhotoUri(undefined, photos)).toBeUndefined();
  });

  it("keeps zoom interaction limited to existing gesture-handler primitives", () => {
    const filePath = path.join(process.cwd(), "components", "zoomable-activity-photo.tsx");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("Gesture.Pinch()");
    expect(source).toContain("numberOfTaps(2)");
    expect(source).toContain("MAX_SCALE = 4");
    expect(source).toContain("GestureDetector");
    expect(source).toContain("Gesture.Pan()");
    expect(source).toContain("manualActivation(true)");
    expect(source).toContain("maxVerticalTranslation");
    expect(source).toContain("放大後可單指拖曳平移");
    expect(source).toContain('resizeMode={usingCoverCrop ? "cover" : "contain"}');
    expect(source).toContain("Image.getSize(");
    expect(source).toContain("resolvePhotoOrientation");
    expect(source).toContain("const defaultFocusY = 0.5");
    expect(source).toContain("Gesture.LongPress()");
    expect(source).toContain("commitManualFocus");
    expect(source).toContain("完整照片");
    expect(source).toContain("裁切滿版");
    expect(source).toContain("const [isFullPhotoMode, setIsFullPhotoMode] = useState(false)");
    expect(source).toContain("setIsFullPhotoMode(false)");
    expect(source).toContain("const usingCoverCrop = fillContainer && !isFullPhotoMode");
  });

  it("keeps full-screen route map gestures separate from photo gestures", () => {
    const filePath = path.join(process.cwd(), "components", "leaflet-map.tsx");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("dragging: true");
    expect(source).toContain("touchZoom: true");
    expect(source).toContain("rotate: true");
    expect(source).toContain("touchRotate: true");
  });

  it("uses a thumbnail photo entry and a separate route viewer instead of paging the map with photos", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("routeMapPhotoThumbButton");
    expect(source).toContain("activityViewerMode === \"route\"");
    expect(source).toContain("activityViewerDrawerHeight.interpolate");
    expect(source).toContain("activityInitialSummary");
    expect(source).not.toContain("騎乘瞬間");
    expect(source).toContain("activityViewerPhotoPagerContent");
    expect(source).toContain('activityViewerPhotoPagerContent: { height: "100%" }');
    expect(source).toContain('mediaViewerPage: { width: SCREEN_W, height: SCREEN_H, justifyContent: "flex-start"');
    expect(source).toContain("fillContainer");
  });

  it("uses one identical title, date, type, and six-metric summary for the initial main and media views", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");
    const initialSummaryIndex = source.indexOf('<View style={styles.activityInitialSummary}>');
    const initialHeaderIndex = source.indexOf("<ActivitySummaryHeader", initialSummaryIndex);
    const initialGridIndex = source.indexOf("<CoreActivitySummaryGrid", initialHeaderIndex);
    const mediaDrawerIndex = source.indexOf('<Animated.View style={[styles.activityViewerDrawer');
    const mediaHeaderIndex = source.indexOf("<ActivitySummaryHeader", mediaDrawerIndex);
    const mediaGridIndex = source.indexOf("<CoreActivitySummaryGrid", mediaHeaderIndex);

    expect(initialSummaryIndex).toBeGreaterThanOrEqual(0);
    expect(initialHeaderIndex).toBeGreaterThan(initialSummaryIndex);
    expect(initialGridIndex).toBeGreaterThan(initialHeaderIndex);
    expect(mediaHeaderIndex).toBeGreaterThan(mediaDrawerIndex);
    expect(mediaGridIndex).toBeGreaterThan(mediaHeaderIndex);
    expect(source).toContain("function ActivitySummaryHeader");
    expect(source).toContain("activityInitialSummary: { paddingTop: ACTIVITY_SUMMARY_CONTENT_TOP, paddingBottom: ACTIVITY_SUMMARY_CONTENT_BOTTOM }");
    expect(source).not.toContain("ACTIVITY_INITIAL_SUMMARY_MIN_HEIGHT");
    expect(source).not.toContain("activityInitialSummary: { minHeight:");
    expect(source).toContain('t("detail.title")');
    expect(source).toContain("useTranslation");
  });

  it("keeps a fixed summary available for routes and every photo", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("onPanResponderMove");
    expect(source).toContain("clampActivityViewerDrawerHeight");
    expect(source).toContain("CoreActivitySummaryGrid");
    expect(source).toContain("ACTIVITY_VIEWER_STAGE_COLLAPSED_HEIGHT");
    expect(source).toContain("ACTIVITY_DETAIL_MAIN_HERO_HEIGHT = ACTIVITY_VIEWER_STAGE_COLLAPSED_HEIGHT + 20");
    expect(source).toContain("mapHero: { height: ACTIVITY_DETAIL_MAIN_HERO_HEIGHT");
    expect(source).toContain("map: { width: SCREEN_W, height: ACTIVITY_DETAIL_MAIN_HERO_HEIGHT }");
    expect(source).toContain("activityViewerDrawerHeight.interpolate");
    expect(source).toContain('mediaViewer: { flex: 1, backgroundColor: "#050505", justifyContent: "flex-start" }');
  });

  it("keeps the summary identical across route thumbnails and photos", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain('t("detail.summary")');
    expect(source).toContain("爬升海拔");
    expect(source).toContain("平均功率");
    expect(source).toContain("平均速度");
    expect(source).toContain("卡路里");
    expect(source).not.toContain("styles.activityViewerDrawerHandle");
    expect(source).not.toContain("styles.activityViewerDrawerHint");
  });
});
