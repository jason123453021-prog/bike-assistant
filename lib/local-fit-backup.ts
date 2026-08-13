import * as FileSystem from "expo-file-system/legacy";
import { fromByteArray } from "base64-js";
import type { RideRecord } from "./ride-context";
import { createFitBytes, fitFilename } from "./fit-export";

export interface LocalFitBackup {
  uri: string;
  filename: string;
}

/** 產生並寫入完全本機的 FIT 活動檔；沒有足夠軌跡時安全回傳 null。 */
export async function writeLocalFitBackup(record: RideRecord): Promise<LocalFitBackup | null> {
  const bytes = createFitBytes(record);
  if (!bytes || !FileSystem.cacheDirectory) return null;
  const directory = `${FileSystem.cacheDirectory}fit-exports/`;
  const filename = fitFilename(record);
  const uri = `${directory}${filename}`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.writeAsStringAsync(uri, fromByteArray(bytes), { encoding: FileSystem.EncodingType.Base64 });
  return { uri, filename };
}
