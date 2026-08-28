import { describe, expect, it } from "vitest";
import { createTimelineEntry, inferCapturedAt } from "../lib/ride-photo-timeline";

describe("local ride photo timeline", () => {
  it("只從使用者選取照片的 EXIF 取得拍攝時間", () => {
    expect(inferCapturedAt({ DateTimeOriginal: "2026:08:13 10:30:00" })).toBe(Date.parse("2026-08-13T10:30:00"));
    expect(inferCapturedAt({})).toBeUndefined();
  });

  it("建立與騎乘綁定的本機時間軸條目", () => {
    const entry = createTimelineEntry("ride-1", { uri: "file:///photo.jpg", fileName: "photo.jpg" }, 1_000, 0);
    expect(entry).toMatchObject({ id: "ride-1-1000-0", rideId: "ride-1", uri: "file:///photo.jpg", selectedAt: 1000, filename: "photo.jpg" });
  });
});
