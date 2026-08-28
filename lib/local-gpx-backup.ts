import * as FileSystem from "expo-file-system/legacy";

import { createGpxContent, createGpxFilename } from "@/lib/gpx-export";
import type { RideRecord } from "@/lib/ride-context";

export async function writeLocalGpxBackup(record: RideRecord): Promise<{ uri: string; filename: string }> {
  const content = createGpxContent(record);
  if (!content) throw new Error("NO_EXPORTABLE_ROUTE");
  if (!FileSystem.documentDirectory) throw new Error("NO_DOCUMENT_DIRECTORY");

  const filename = createGpxFilename(record);
  const uri = `${FileSystem.documentDirectory}gpx-backups/${filename}`;
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}gpx-backups`, { intermediates: true });
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  return { uri, filename };
}
