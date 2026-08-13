import * as FileSystem from "expo-file-system/legacy";
import type { GpxRoute } from "./gpx-parser";
import { MAX_GPX_BYTES, validateGpxText } from "./external-gpx-validation";

export { isExternalGpxUri, validateGpxText } from "./external-gpx-validation";

/** 從系統開啟方式或 DocumentPicker 的 URI 讀取並驗證 GPX，不上傳或同步任何內容。 */
export async function importExternalGpxUri(uri: string, declaredSize?: number): Promise<GpxRoute> {
  if (!uri.toLowerCase().startsWith("content://") && !uri.toLowerCase().startsWith("file://") && !/\.gpx(?:[?#]|$)/.test(uri.toLowerCase())) throw new Error("僅支援 .gpx 路線檔案。");
  if (typeof declaredSize === "number" && declaredSize > MAX_GPX_BYTES) {
    throw new Error("GPX 檔案超過 10 MB，為確保離線載入穩定性無法匯入。");
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) throw new Error("找不到 GPX 檔案，請重新選取或再次從來源 App 開啟。");
    return validateGpxText(await FileSystem.readAsStringAsync(uri));
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("無法讀取 GPX 檔案，請確認來源 App 已授權檔案存取。");
  }
}
