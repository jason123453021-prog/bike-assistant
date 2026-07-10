/**
 * Nominatim 地理編碼 API 集成
 * 
 * 功能：
 * - 地址搜尋（地址 → 座標）
 * - 反向地理編碼（座標 → 地址）
 * - 自動完成建議
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'BikeAssistant/1.0';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  address: string;
  city?: string;
  country?: string;
  boundingBox?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export interface AutocompleteResult {
  placeId: number;
  displayName: string;
  latitude: number;
  longitude: number;
  type: string;
}

/**
 * 搜尋地址
 */
export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '10',
      'accept-language': 'zh-TW,zh;q=0.9',
    });

    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    return data.map((item: any) => ({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      displayName: item.display_name,
      address: item.address?.road || item.display_name,
      city: item.address?.city || item.address?.town,
      country: item.address?.country,
      boundingBox: item.boundingbox ? {
        minLat: parseFloat(item.boundingbox[0]),
        maxLat: parseFloat(item.boundingbox[1]),
        minLon: parseFloat(item.boundingbox[2]),
        maxLon: parseFloat(item.boundingbox[3]),
      } : undefined,
    }));
  } catch (error) {
    console.error('Address search error:', error);
    throw error;
  }
}

/**
 * 反向地理編碼（座標 → 地址）
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodingResult> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      format: 'json',
      'accept-language': 'zh-TW,zh;q=0.9',
    });

    const response = await fetch(
      `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      latitude,
      longitude,
      displayName: data.display_name,
      address: data.address?.road || data.display_name,
      city: data.address?.city || data.address?.town,
      country: data.address?.country,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
}

/**
 * 自動完成建議
 */
export async function getAutocompleteSuggestions(
  query: string
): Promise<AutocompleteResult[]> {
  try {
    if (query.length < 3) {
      return [];
    }

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      'accept-language': 'zh-TW,zh;q=0.9',
    });

    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    return data.map((item: any) => ({
      placeId: item.place_id,
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: item.type,
    }));
  } catch (error) {
    console.error('Autocomplete error:', error);
    return [];
  }
}

/**
 * 計算兩點之間的距離（Haversine 公式）
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 地球半徑（公里）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 返回公里
}

/**
 * 計算方向角（0-360 度）
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = Math.atan2(y, x);
  return ((bearing * 180) / Math.PI + 360) % 360;
}
