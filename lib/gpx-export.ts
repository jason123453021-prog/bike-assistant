import type { RideRecord } from "@/lib/ride-context";
import { SPORT_META, type SportType } from "./sport-metrics";

const GPX_EPOCH_THRESHOLD = 946_684_800_000;

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[character] ?? character);
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function pointTime(record: RideRecord, timestamp: number, index: number, pointCount: number): string {
  const fallback = record.date + Math.round((record.duration * 1000 * index) / Math.max(1, pointCount - 1));
  return new Date(timestamp >= GPX_EPOCH_THRESHOLD ? timestamp : fallback).toISOString();
}

export function createGpxFilename(record: RideRecord): string {
  const safeName = (record.name || "騎乘紀錄")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "騎乘紀錄";
  return `${safeName}-${new Date(record.date).toISOString().slice(0, 10)}.gpx`;
}

/** 建立標準 GPX 1.1，並用命名空間保存可用的心率、踏頻、功率與速度資訊。 */
export function createGpxContent(record: RideRecord): string | null {
  const points = record.route.filter((point) => validCoordinate(point.latitude, point.longitude));
  if (points.length < 2) return null;

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const routeName = escapeXml(record.name?.trim() || "騎乘紀錄");
  const sportType: SportType = record.sportType ?? "cycling";
  const sport = SPORT_META[sportType];
  const description = escapeXml(`${sport.label}記錄：${(record.distance / 1000).toFixed(2)} km，${Math.round(record.totalAscent)} m 爬升`);

  const trackPoints = points.map((point, index) => {
    const extensions = [
      point.heartRate || point.cadence
        ? `<gpxtpx:TrackPointExtension>${point.heartRate ? `<gpxtpx:hr>${Math.round(point.heartRate)}</gpxtpx:hr>` : ""}${point.cadence ? `<gpxtpx:cad>${Math.round(point.cadence)}</gpxtpx:cad>` : ""}</gpxtpx:TrackPointExtension>`
        : "",
      point.power ? `<bikeassistant:power>${Math.round(point.power)}</bikeassistant:power>` : "",
      point.speed != null && Number.isFinite(point.speed) ? `<bikeassistant:speed>${point.speed.toFixed(3)}</bikeassistant:speed>` : "",
    ].filter(Boolean).join("");
    return [
      `      <trkpt lat="${point.latitude.toFixed(7)}" lon="${point.longitude.toFixed(7)}">`,
      point.altitude != null && Number.isFinite(point.altitude) ? `        <ele>${point.altitude.toFixed(1)}</ele>` : "",
      `        <time>${pointTime(record, point.timestamp, index, points.length)}</time>`,
      extensions ? `        <extensions>${extensions}</extensions>` : "",
      "      </trkpt>",
    ].filter(Boolean).join("\n");
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Bike Assistant" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" xmlns:bikeassistant="https://bike-assistant.local/gpx/extensions/1">
  <metadata>
    <name>${routeName}</name>
    <desc>${description}</desc>
    <type>${sport.gpxType}</type>
    <time>${new Date(record.date).toISOString()}</time>
    <bounds minlat="${Math.min(...latitudes).toFixed(7)}" minlon="${Math.min(...longitudes).toFixed(7)}" maxlat="${Math.max(...latitudes).toFixed(7)}" maxlon="${Math.max(...longitudes).toFixed(7)}"/>
  </metadata>
  <trk>
    <name>${routeName}</name>
    <type>${sport.gpxType}</type>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}
