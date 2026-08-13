import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { createTimelineEntry, photoExtension, type RidePhotoTimelineEntry, type SelectedRidePhoto } from "./ride-photo-timeline";

const PHOTO_TIMELINE_KEY = "@bike_ride_photo_timelines";

export type { RidePhotoTimelineEntry, SelectedRidePhoto } from "./ride-photo-timeline";

type PhotoTimelineStore = Record<string, RidePhotoTimelineEntry[]>;


async function loadStore(): Promise<PhotoTimelineStore> {
  const raw = await AsyncStorage.getItem(PHOTO_TIMELINE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PhotoTimelineStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveStore(store: PhotoTimelineStore): Promise<void> {
  await AsyncStorage.setItem(PHOTO_TIMELINE_KEY, JSON.stringify(store));
}

export async function loadRidePhotoTimeline(rideId: string): Promise<RidePhotoTimelineEntry[]> {
  const store = await loadStore();
  return (store[rideId] ?? []).slice().sort((a, b) => (a.capturedAt ?? a.selectedAt) - (b.capturedAt ?? b.selectedAt));
}

/** 把使用者明確選取的照片複製進 App 私有資料夾，避免日後讀取相簿或要求廣泛權限。 */
export async function attachRidePhotos(rideId: string, photos: SelectedRidePhoto[]): Promise<RidePhotoTimelineEntry[]> {
  if (!FileSystem.documentDirectory || photos.length === 0) return loadRidePhotoTimeline(rideId);
  const selectedAt = Date.now();
  const directory = `${FileSystem.documentDirectory}ride-photo-timeline/${rideId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const store = await loadStore();
  const existing = store[rideId] ?? [];
  const entries: RidePhotoTimelineEntry[] = [];

  for (const [index, photo] of photos.entries()) {
    if (!photo.uri) continue;
    const filename = `photo-${selectedAt}-${index}.${photoExtension(photo)}`;
    const destination = `${directory}${filename}`;
    try {
      await FileSystem.copyAsync({ from: photo.uri, to: destination });
      entries.push({ ...createTimelineEntry(rideId, photo, selectedAt, index), uri: destination, filename });
    } catch {
      // 某些系統選取器會提供暫時 URI；仍僅保存使用者選擇的該檔案，不要求整庫權限。
      entries.push(createTimelineEntry(rideId, photo, selectedAt, index));
    }
  }

  store[rideId] = [...existing, ...entries].slice(-30);
  await saveStore(store);
  return loadRidePhotoTimeline(rideId);
}

export async function removeRidePhoto(rideId: string, photoId: string): Promise<RidePhotoTimelineEntry[]> {
  const store = await loadStore();
  const target = (store[rideId] ?? []).find((entry) => entry.id === photoId);
  store[rideId] = (store[rideId] ?? []).filter((entry) => entry.id !== photoId);
  await saveStore(store);
  if (target?.uri.startsWith(FileSystem.documentDirectory ?? "") && target.uri) {
    await FileSystem.deleteAsync(target.uri, { idempotent: true }).catch(() => undefined);
  }
  return loadRidePhotoTimeline(rideId);
}
