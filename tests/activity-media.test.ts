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
    expect(source).toContain("maxHorizontalTranslation");
    expect(source).toContain("放大後可單指拖曳平移");
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
    expect(source).toContain("fillContainer");
  });

  it("keeps a fixed summary available for routes and every photo", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("onPanResponderMove");
    expect(source).toContain("clampActivityViewerDrawerHeight");
    expect(source).toContain("activityViewerDrawerMetricsSecondary");
    expect(source).toContain("activityViewerDrawerHeight.interpolate");
  });

  it("keeps the summary identical across route thumbnails and photos", () => {
    const filePath = path.join(process.cwd(), "app", "ride-detail.tsx");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("活動摘要");
    expect(source).not.toContain("styles.activityViewerDrawerHandle");
    expect(source).not.toContain("styles.activityViewerDrawerHint");
  });
});
