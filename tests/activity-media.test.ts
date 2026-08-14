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
  });
});
