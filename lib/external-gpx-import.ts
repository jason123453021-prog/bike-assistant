import * as FileSystem from "expo-file-system/legacy";
import { Directory, File, Paths } from "expo-file-system";
import type { GpxRoute } from "./gpx-parser";
import { validateGpxText } from "./external-gpx-validation";
import { readExternalGpxText } from "./external-gpx-uri-reader";

export { isExternalGpxUri, validateGpxText } from "./external-gpx-validation";

/** 從系統開啟方式或 DocumentPicker 的 URI 讀取並驗證 GPX，不上傳或同步任何內容。 */
export async function importExternalGpxUri(uri: string, declaredSize?: number): Promise<GpxRoute> {
  const cacheDirectory = FileSystem.cacheDirectory;
  const text = await readExternalGpxText(uri, declaredSize, {
    stageContentUri: async (sourceUri) => {
      if (!cacheDirectory) throw new Error("App 快取目錄暫時不可用。");
      const directory = new Directory(Paths.cache, "external-gpx-import");
      directory.create({ idempotent: true, intermediates: true });
      const stagedFile = new File(directory, `shared-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.gpx`);
      new File(sourceUri).copy(stagedFile);
      return stagedFile.uri;
    },
    getInfo: async (fileUri) => FileSystem.getInfoAsync(fileUri),
    readText: async (fileUri) => FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 }),
    removeStagedFile: async (fileUri) => FileSystem.deleteAsync(fileUri, { idempotent: true }),
  });
  return validateGpxText(text);
}
