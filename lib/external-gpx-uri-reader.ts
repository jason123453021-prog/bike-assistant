import { MAX_GPX_BYTES } from "./external-gpx-validation";

export interface ExternalGpxFileInfo {
  exists: boolean;
  size?: number;
}

export interface ExternalGpxUriAdapter {
  stageContentUri: (uri: string) => Promise<string>;
  getInfo: (uri: string) => Promise<ExternalGpxFileInfo>;
  readText: (uri: string) => Promise<string>;
  removeStagedFile: (uri: string) => Promise<void>;
}

export function requiresContentUriStaging(uri: string): boolean {
  return uri.trim().toLowerCase().startsWith("content://");
}

/**
 * 以 App 可讀取的快取副本載入外部 GPX；避免 Android 的來源 App content URI
 * 被 legacy readAsStringAsync 直接拒絕。讀取後立即刪除暫存副本，維持 Local-First。
 */
export async function readExternalGpxText(
  uri: string,
  declaredSize: number | undefined,
  adapter: ExternalGpxUriAdapter,
): Promise<string> {
  const lower = uri.trim().toLowerCase();
  if (!lower.startsWith("content://") && !lower.startsWith("file://") && !/\.gpx(?:[?#]|$)/.test(lower)) {
    throw new Error("僅支援 .gpx 路線檔案。");
  }
  if (typeof declaredSize === "number" && declaredSize > MAX_GPX_BYTES) {
    throw new Error("GPX 檔案超過 10 MB，為確保離線載入穩定性無法匯入。");
  }

  let stagedUri: string | null = null;
  try {
    const readableUri = requiresContentUriStaging(uri)
      ? (stagedUri = await adapter.stageContentUri(uri))
      : uri;
    const info = await adapter.getInfo(readableUri);
    if (!info.exists) throw new Error("找不到 GPX 檔案，請重新選取或再次從來源 App 開啟。");
    if (typeof info.size === "number" && info.size > MAX_GPX_BYTES) {
      throw new Error("GPX 檔案超過 10 MB，為確保離線載入穩定性無法匯入。");
    }
    const text = await adapter.readText(readableUri);
    if (text.length > MAX_GPX_BYTES) {
      throw new Error("GPX 檔案超過 10 MB，為確保離線載入穩定性無法匯入。");
    }
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("僅支援") || message.startsWith("GPX 檔案超過") || message.startsWith("找不到 GPX 檔案")) {
      throw error;
    }
    throw new Error("無法讀取外部分享的 GPX 檔案。請確認 LINE 或來源 App 已允許單車助手讀取此檔案後再試一次。");
  } finally {
    if (stagedUri) await adapter.removeStagedFile(stagedUri).catch(() => {});
  }
}
