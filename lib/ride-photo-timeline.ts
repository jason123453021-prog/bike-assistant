export interface SelectedRidePhoto {
  uri: string;
  fileName?: string | null;
  exif?: Record<string, unknown> | null;
}

export interface RidePhotoTimelineEntry {
  id: string;
  rideId: string;
  uri: string;
  selectedAt: number;
  capturedAt?: number;
  filename?: string;
}

function parseExifTimestamp(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim().replace(/^(\d{4}):(\d{2}):(\d{2})\s/, "$1-$2-$3T");
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function inferCapturedAt(exif?: Record<string, unknown> | null): number | undefined {
  if (!exif) return undefined;
  return parseExifTimestamp(exif.DateTimeOriginal)
    ?? parseExifTimestamp(exif.DateTimeDigitized)
    ?? parseExifTimestamp(exif.DateTime);
}

export function photoExtension(photo: SelectedRidePhoto): string {
  const candidate = photo.fileName ?? photo.uri;
  const extension = candidate.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : "jpg";
}

export function createTimelineEntry(rideId: string, photo: SelectedRidePhoto, selectedAt: number, suffix: number): RidePhotoTimelineEntry {
  return {
    id: `${rideId}-${selectedAt}-${suffix}`,
    rideId,
    uri: photo.uri,
    selectedAt,
    capturedAt: inferCapturedAt(photo.exif),
    filename: photo.fileName ?? undefined,
  };
}
