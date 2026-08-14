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
  latitude?: number;
  longitude?: number;
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

function numericExifValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (Array.isArray(value) && value.length >= 3) {
    const [degrees, minutes, seconds] = value.map((part) => Number(part));
    if ([degrees, minutes, seconds].every(Number.isFinite)) return degrees + minutes / 60 + seconds / 3_600;
  }
  return undefined;
}

/** 解析 Android/iOS 相簿常見的 EXIF GPS 欄位；沒有完整座標即不建立地理標記。 */
export function inferCapturedCoordinates(exif?: Record<string, unknown> | null): { latitude: number; longitude: number } | undefined {
  if (!exif) return undefined;
  let latitude = numericExifValue(exif.GPSLatitude ?? exif.latitude);
  let longitude = numericExifValue(exif.GPSLongitude ?? exif.longitude);
  const latitudeRef = String(exif.GPSLatitudeRef ?? "").toUpperCase();
  const longitudeRef = String(exif.GPSLongitudeRef ?? "").toUpperCase();
  if (latitudeRef === "S" && latitude !== undefined) latitude = -Math.abs(latitude);
  if (longitudeRef === "W" && longitude !== undefined) longitude = -Math.abs(longitude);
  if (latitude === undefined || longitude === undefined || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

export function photoExtension(photo: SelectedRidePhoto): string {
  const candidate = photo.fileName ?? photo.uri;
  const extension = candidate.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : "jpg";
}

export function createTimelineEntry(rideId: string, photo: SelectedRidePhoto, selectedAt: number, suffix: number): RidePhotoTimelineEntry {
  const coordinates = inferCapturedCoordinates(photo.exif);
  return {
    id: `${rideId}-${selectedAt}-${suffix}`,
    rideId,
    uri: photo.uri,
    selectedAt,
    capturedAt: inferCapturedAt(photo.exif),
    ...coordinates,
    filename: photo.fileName ?? undefined,
  };
}
