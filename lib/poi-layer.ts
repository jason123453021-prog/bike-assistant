import AsyncStorage from "@react-native-async-storage/async-storage";

export type PoiLayerKind = "water_refill" | "photo_spot";

export type PoiCategory =
  | "drinking_water"
  | "water_point"
  | "free_refill_partner"
  | "police_station"
  | "transit_station"
  | "bicycle_shop"
  | "visitor_center"
  | "bicycle_station"
  | "viewpoint"
  | "peak"
  | "landmark";

export interface PoiMarker {
  id: string;
  kind: PoiLayerKind;
  category: PoiCategory;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  imageUrl?: string;
  source: "openstreetmap";
}

export interface PoiBounds {
  northEast: { lat: number; lon: number };
  southWest: { lat: number; lon: number };
}

export interface PoiCluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  markers: PoiMarker[];
}

type OverpassElement = {
  id?: number | string;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
};

const POI_CACHE_PREFIX = "@bike_poi_layer_v1:";
const POI_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_POI_PER_VIEWPORT = 240;

function asFiniteCoordinate(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeBoundValue(value: number): string {
  return value.toFixed(3);
}

export function getPoiBoundsKey(bounds: PoiBounds): string {
  return [
    normalizeBoundValue(bounds.southWest.lat),
    normalizeBoundValue(bounds.southWest.lon),
    normalizeBoundValue(bounds.northEast.lat),
    normalizeBoundValue(bounds.northEast.lon),
  ].join(":");
}

export function buildPoiOverpassQuery(bounds: PoiBounds): string {
  const south = Math.min(bounds.southWest.lat, bounds.northEast.lat);
  const west = Math.min(bounds.southWest.lon, bounds.northEast.lon);
  const north = Math.max(bounds.southWest.lat, bounds.northEast.lat);
  const east = Math.max(bounds.southWest.lon, bounds.northEast.lon);
  const box = `${south},${west},${north},${east}`;

  return `[out:json][timeout:18];
(
  nwr["amenity"="drinking_water"](${box});
  nwr["amenity"="water_point"](${box});
  nwr["drinking_water"="yes"](${box});
  nwr["drinking_water:refill"="yes"](${box});
  nwr["tourism"="viewpoint"](${box});
  nwr["natural"="peak"](${box});
  nwr["historic"="memorial"](${box});
  nwr["tourism"="attraction"](${box});
);
out center tags ${MAX_POI_PER_VIEWPORT};`;
}

function getPoiCategory(tags: Record<string, string | undefined>): {
  kind: PoiLayerKind;
  category: PoiCategory;
} | null {
  if (tags.amenity === "drinking_water") {
    return { kind: "water_refill", category: "drinking_water" };
  }
  if (tags.amenity === "water_point") {
    return { kind: "water_refill", category: "water_point" };
  }
  if (tags["drinking_water:refill"] === "yes") {
    return { kind: "water_refill", category: "free_refill_partner" };
  }
  if (tags.drinking_water === "yes") {
    if (tags.amenity === "police") {
      return { kind: "water_refill", category: "police_station" };
    }
    if (tags.railway === "station" || tags.public_transport === "station") {
      return { kind: "water_refill", category: "transit_station" };
    }
    if (tags.shop === "bicycle") {
      return { kind: "water_refill", category: "bicycle_shop" };
    }
    if (tags.tourism === "information" && tags.information === "visitor_centre") {
      return { kind: "water_refill", category: "visitor_center" };
    }
    if (tags.amenity === "bicycle_repair_station") {
      return { kind: "water_refill", category: "bicycle_station" };
    }
    return { kind: "water_refill", category: "drinking_water" };
  }
  if (tags.tourism === "viewpoint") {
    return { kind: "photo_spot", category: "viewpoint" };
  }
  if (tags.natural === "peak") {
    return { kind: "photo_spot", category: "peak" };
  }
  if (tags.historic === "memorial" || tags.tourism === "attraction") {
    return { kind: "photo_spot", category: "landmark" };
  }
  return null;
}

function fallbackName(category: PoiCategory): string {
  switch (category) {
    case "drinking_water":
      return "Drinking water";
    case "water_point":
      return "Water point";
    case "free_refill_partner":
      return "Free refill";
    case "police_station":
      return "Police station water";
    case "transit_station":
      return "Station water";
    case "bicycle_shop":
      return "Bicycle shop water";
    case "visitor_center":
      return "Visitor center water";
    case "bicycle_station":
      return "Bicycle station water";
    case "viewpoint":
      return "Viewpoint";
    case "peak":
      return "Peak";
    case "landmark":
      return "Landmark";
  }
}

function getImageUrl(tags: Record<string, string | undefined>): string | undefined {
  const candidate = tags.image?.trim();
  return candidate && /^https?:\/\//i.test(candidate) ? candidate : undefined;
}

function getDescription(tags: Record<string, string | undefined>): string | undefined {
  return tags.description?.trim() || tags.operator?.trim() || tags.opening_hours?.trim();
}

export function parseOverpassPoiElements(elements: OverpassElement[]): PoiMarker[] {
  const markers = new Map<string, PoiMarker>();
  for (const element of elements) {
    const tags = element.tags ?? {};
    const mapped = getPoiCategory(tags);
    if (!mapped) continue;
    const latitude = asFiniteCoordinate(element.lat ?? element.center?.lat);
    const longitude = asFiniteCoordinate(element.lon ?? element.center?.lon);
    if (latitude === null || longitude === null) continue;
    const type = element.type?.trim() || "node";
    const rawId = String(element.id ?? `${latitude.toFixed(6)}-${longitude.toFixed(6)}`);
    const id = `osm-${type}-${rawId}`;
    markers.set(id, {
      id,
      kind: mapped.kind,
      category: mapped.category,
      name: tags.name?.trim() || tags.brand?.trim() || fallbackName(mapped.category),
      latitude,
      longitude,
      description: getDescription(tags),
      imageUrl: getImageUrl(tags),
      source: "openstreetmap",
    });
  }

  return [...markers.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, MAX_POI_PER_VIEWPORT);
}

type CachedPoiLayer = { savedAt: number; markers: PoiMarker[] };

async function readCachedPoiLayer(cacheKey: string): Promise<PoiMarker[] | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPoiLayer;
    if (
      !Array.isArray(parsed.markers) ||
      !Number.isFinite(parsed.savedAt) ||
      Date.now() - parsed.savedAt > POI_CACHE_TTL_MS
    ) {
      return null;
    }
    return parsed.markers;
  } catch {
    return null;
  }
}

async function writeCachedPoiLayer(cacheKey: string, markers: PoiMarker[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ savedAt: Date.now(), markers } satisfies CachedPoiLayer),
    );
  } catch {
    // POI 圖層的快取失敗不應中斷地圖或騎乘。
  }
}

export async function loadPoiMarkers(
  bounds: PoiBounds,
  fetchImpl: typeof fetch = fetch,
): Promise<PoiMarker[]> {
  const cacheKey = `${POI_CACHE_PREFIX}${getPoiBoundsKey(bounds)}`;
  const cached = await readCachedPoiLayer(cacheKey);
  if (cached) return cached;

  const response = await fetchImpl("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: `data=${encodeURIComponent(buildPoiOverpassQuery(bounds))}`,
  });
  if (!response.ok) throw new Error(`POI request failed: ${response.status}`);
  const payload = (await response.json()) as { elements?: OverpassElement[] };
  const markers = parseOverpassPoiElements(payload.elements ?? []);
  await writeCachedPoiLayer(cacheKey, markers);
  return markers;
}

export function filterPoiMarkers(
  markers: PoiMarker[],
  options: { showWaterRefillSpots: boolean; showPhotoScenicSpots: boolean },
): PoiMarker[] {
  return markers.filter((marker) =>
    marker.kind === "water_refill"
      ? options.showWaterRefillSpots
      : options.showPhotoScenicSpots,
  );
}

export function shouldClusterPoiMarkers(zoom: number): boolean {
  return Number.isFinite(zoom) && zoom < 13;
}

/** 純資料聚合，供測試與未來原生地圖實作共用；Leaflet WebView 以相同 zoom 閾值重新繪製。 */
export function buildPoiClusters(markers: PoiMarker[], zoom: number): PoiCluster[] {
  if (!shouldClusterPoiMarkers(zoom)) {
    return markers.map((marker) => ({
      id: marker.id,
      latitude: marker.latitude,
      longitude: marker.longitude,
      count: 1,
      markers: [marker],
    }));
  }

  const cellDegrees = Math.max(0.006, 0.12 / 2 ** Math.max(0, zoom - 8));
  const groups = new Map<string, PoiMarker[]>();
  for (const marker of markers) {
    const key = [
      Math.floor(marker.latitude / cellDegrees),
      Math.floor(marker.longitude / cellDegrees),
    ].join(":");
    groups.set(key, [...(groups.get(key) ?? []), marker]);
  }

  return [...groups.entries()].map(([key, grouped]) => ({
    id: `cluster-${key}`,
    latitude: grouped.reduce((sum, marker) => sum + marker.latitude, 0) / grouped.length,
    longitude: grouped.reduce((sum, marker) => sum + marker.longitude, 0) / grouped.length,
    count: grouped.length,
    markers: grouped,
  }));
}
