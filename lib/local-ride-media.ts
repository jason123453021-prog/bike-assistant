import * as FileSystem from "expo-file-system/legacy";
import type * as ImagePicker from "expo-image-picker";

function extensionForAsset(asset: ImagePicker.ImagePickerAsset): string {
  const explicit = asset.fileName?.split(".").pop()?.toLowerCase();
  if (explicit && /^[a-z0-9]{2,5}$/.test(explicit)) return explicit;
  if (asset.mimeType?.startsWith("video/")) return "mp4";
  if (asset.mimeType?.includes("png")) return "png";
  if (asset.mimeType?.includes("heic")) return "heic";
  return "jpg";
}

/**
 * Copies only user-selected media into the app's private documents folder.
 * The returned file URIs remain available after the system picker grants expire.
 */
export async function persistRideMedia(
  rideId: string,
  assets: ImagePicker.ImagePickerAsset[],
): Promise<string[]> {
  if (!rideId || assets.length === 0 || !FileSystem.documentDirectory) return [];
  const directory = `${FileSystem.documentDirectory}ride-activity-media/${rideId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const selectedAt = Date.now();
  const saved: string[] = [];

  for (const [index, asset] of assets.entries()) {
    if (!asset.uri) continue;
    const target = `${directory}media-${selectedAt}-${index}.${extensionForAsset(asset)}`;
    try {
      await FileSystem.copyAsync({ from: asset.uri, to: target });
      saved.push(target);
    } catch {
      // Keep the explicitly selected URI as a fallback on systems that expose an immutable URI.
      saved.push(asset.uri);
    }
  }
  return saved;
}
