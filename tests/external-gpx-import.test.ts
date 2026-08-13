import { describe, expect, it } from "vitest";
import { isExternalGpxUri, validateGpxText } from "../lib/external-gpx-validation";

describe("external GPX import validation", () => {
  it("accepts Android content URIs and GPX file paths", () => {
    expect(isExternalGpxUri("content://provider/routes/42")).toBe(true);
    expect(isExternalGpxUri("file:///storage/emulated/0/Download/route.gpx")).toBe(true);
    expect(isExternalGpxUri("https://example.com/route.pdf")).toBe(false);
  });

  it("requires GPX XML and at least two route points", () => {
    expect(() => validateGpxText("not a GPX file")).toThrow("不是有效的 GPX XML");
    const route = validateGpxText('<gpx><trk><trkseg><trkpt lat="25.0" lon="121.0"><ele>10</ele></trkpt><trkpt lat="25.1" lon="121.1"><ele>20</ele></trkpt></trkseg></trk></gpx>');
    expect(route.points).toHaveLength(2);
  });
});
