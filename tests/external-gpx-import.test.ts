import { describe, expect, it } from "vitest";
import { isExternalGpxUri, validateGpxText } from "../lib/external-gpx-validation";
import { readExternalGpxText, requiresContentUriStaging } from "../lib/external-gpx-uri-reader";

const VALID_GPX = '<gpx><trk><trkseg><trkpt lat="25.0" lon="121.0" /><trkpt lat="25.1" lon="121.1" /></trkseg></trk></gpx>';

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

  it("stages Android content URIs before reading, then removes the temporary local copy", async () => {
    const calls: string[] = [];
    const text = await readExternalGpxText("content://jp.naver.line.android.line.MessageContentProvider/route", undefined, {
      stageContentUri: async (uri) => { calls.push(`stage:${uri}`); return "file:///cache/external-gpx-import/shared.gpx"; },
      getInfo: async (uri) => { calls.push(`info:${uri}`); return { exists: true, size: VALID_GPX.length }; },
      readText: async (uri) => { calls.push(`read:${uri}`); return VALID_GPX; },
      removeStagedFile: async (uri) => { calls.push(`remove:${uri}`); },
    });
    expect(text).toBe(VALID_GPX);
    expect(requiresContentUriStaging("content://jp.naver.line.android.line.MessageContentProvider/route")).toBe(true);
    expect(calls).toEqual([
      "stage:content://jp.naver.line.android.line.MessageContentProvider/route",
      "info:file:///cache/external-gpx-import/shared.gpx",
      "read:file:///cache/external-gpx-import/shared.gpx",
      "remove:file:///cache/external-gpx-import/shared.gpx",
    ]);
  });

  it("reads normal file URIs directly and replaces provider-specific failures with a clear Chinese message", async () => {
    const directCalls: string[] = [];
    await readExternalGpxText("file:///storage/emulated/0/Download/route.gpx", undefined, {
      stageContentUri: async () => { throw new Error("should not stage"); },
      getInfo: async (uri) => { directCalls.push(`info:${uri}`); return { exists: true, size: VALID_GPX.length }; },
      readText: async (uri) => { directCalls.push(`read:${uri}`); return VALID_GPX; },
      removeStagedFile: async () => {},
    });
    expect(directCalls).toEqual([
      "info:file:///storage/emulated/0/Download/route.gpx",
      "read:file:///storage/emulated/0/Download/route.gpx",
    ]);
    await expect(readExternalGpxText("content://line/denied", undefined, {
      stageContentUri: async () => { throw new Error("java.io.IOException: Permission denied"); },
      getInfo: async () => ({ exists: false }),
      readText: async () => "",
      removeStagedFile: async () => {},
    })).rejects.toThrow("無法讀取外部分享的 GPX 檔案");
  });
});
