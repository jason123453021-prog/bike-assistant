import { parseGpx, type GpxRoute } from "./gpx-parser";

export const MAX_GPX_BYTES = 10 * 1024 * 1024;

export function isExternalGpxUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  const lower = uri.toLowerCase();
  return lower.startsWith("content://") || lower.startsWith("file://") || /\.gpx(?:[?#]|$)/.test(lower);
}

export function validateGpxText(content: string): GpxRoute {
  if (!content.trim()) throw new Error("GPX 檔案是空的。");
  if (content.length > MAX_GPX_BYTES) throw new Error("GPX 檔案超過 10 MB，為確保離線載入穩定性無法匯入。");
  if (!/<(?:\w+:)?gpx\b/i.test(content) && !/<(?:\w+:)?(?:trkpt|rtept)\b/i.test(content)) {
    throw new Error("選取的檔案不是有效的 GPX XML。");
  }
  const route = parseGpx(content);
  if (!route) throw new Error("GPX 內至少需要兩個有效路線點。");
  return route;
}
