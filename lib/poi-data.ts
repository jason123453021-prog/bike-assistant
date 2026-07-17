/**
 * POI 數據源
 * 接入 Overpass API (OpenStreetMap) 獲取真實 POI 數據
 */

import { POI, POIType } from './poi-types';

/**
 * 示例 POI 數據（作為離線備用）
 */
export const SAMPLE_POIS: POI[] = [
  {
    id: 'poi_1',
    type: POIType.CONVENIENCE_STORE,
    name: '7-Eleven 中山店',
    description: '24 小時便利商店',
    latitude: 25.0478,
    longitude: 121.5319,
    rating: 4.5,
    tags: ['便利商店', '補給'],
  },
  {
    id: 'poi_2',
    type: POIType.CONVENIENCE_STORE,
    name: 'FamilyMart 民生店',
    description: '24 小時便利商店',
    latitude: 25.0520,
    longitude: 121.5380,
    rating: 4.3,
    tags: ['便利商店', '補給'],
  },
  {
    id: 'poi_3',
    type: POIType.RESTAURANT,
    name: '自行車友善餐廳',
    description: '提供自行車停放和補給',
    latitude: 25.0450,
    longitude: 121.5350,
    rating: 4.8,
    tags: ['餐廳', '自行車友善'],
  },
  {
    id: 'poi_4',
    type: POIType.CAFE,
    name: '騎士咖啡館',
    description: '自行車友善咖啡館',
    latitude: 25.0500,
    longitude: 121.5400,
    rating: 4.6,
    tags: ['咖啡館', '休息點'],
  },
  {
    id: 'poi_5',
    type: POIType.WATER_FOUNTAIN,
    name: '公園飲水機',
    description: '免費飲水機',
    latitude: 25.0480,
    longitude: 121.5330,
    rating: 4.0,
    tags: ['飲水', '免費'],
  },
  {
    id: 'poi_6',
    type: POIType.RESTROOM,
    name: '公園廁所',
    description: '公共廁所',
    latitude: 25.0490,
    longitude: 121.5340,
    rating: 3.8,
    tags: ['廁所', '公共設施'],
  },
  {
    id: 'poi_7',
    type: POIType.PHOTO_SPOT,
    name: '河濱公園觀景台',
    description: '絕佳拍照點',
    latitude: 25.0460,
    longitude: 121.5310,
    rating: 4.9,
    tags: ['拍照', '觀景'],
  },
  {
    id: 'poi_8',
    type: POIType.SUMMIT,
    name: '象山山頂',
    description: '台北市區制高點',
    latitude: 25.0350,
    longitude: 121.5450,
    elevation: 183,
    rating: 4.7,
    tags: ['山頂', '觀景'],
  },
];

/**
 * Overpass API 查詢模板
 * 根據 POI 類型生成對應的 Overpass QL 查詢
 */
function buildOverpassQuery(lat: number, lon: number, radiusMeters: number): string {
  // 查詢便利商店、餐廳、咖啡館、飲水機、廁所、觀景點、山頂
  return `
[out:json][timeout:10];
(
  node["shop"="convenience"](around:${radiusMeters},${lat},${lon});
  node["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});
  node["amenity"="cafe"](around:${radiusMeters},${lat},${lon});
  node["amenity"="drinking_water"](around:${radiusMeters},${lat},${lon});
  node["amenity"="toilets"](around:${radiusMeters},${lat},${lon});
  node["tourism"="viewpoint"](around:${radiusMeters},${lat},${lon});
  node["natural"="peak"](around:${radiusMeters},${lat},${lon});
);
out body 50;
`;
}

/**
 * 將 OSM 標籤映射為 POIType
 */
function mapOSMToPOIType(tags: Record<string, string>): POIType | null {
  if (tags.shop === 'convenience') return POIType.CONVENIENCE_STORE;
  if (tags.amenity === 'restaurant') return POIType.RESTAURANT;
  if (tags.amenity === 'cafe') return POIType.CAFE;
  if (tags.amenity === 'drinking_water') return POIType.WATER_FOUNTAIN;
  if (tags.amenity === 'toilets') return POIType.RESTROOM;
  if (tags.tourism === 'viewpoint') return POIType.VIEWPOINT;
  if (tags.natural === 'peak') return POIType.PEAK;
  return null;
}

/**
 * 從 OSM 標籤生成描述
 */
function generateDescription(tags: Record<string, string>, type: POIType): string {
  const parts: string[] = [];
  if (tags.opening_hours) parts.push(`營業時間: ${tags.opening_hours}`);
  if (tags.brand) parts.push(tags.brand);
  if (tags.cuisine) parts.push(`料理: ${tags.cuisine}`);
  if (tags.ele) parts.push(`海拔: ${tags.ele}m`);
  if (parts.length > 0) return parts.join(' | ');
  
  // 預設描述
  switch (type) {
    case POIType.CONVENIENCE_STORE: return '便利商店';
    case POIType.RESTAURANT: return '餐廳';
    case POIType.CAFE: return '咖啡館';
    case POIType.WATER_FOUNTAIN: return '飲水機';
    case POIType.RESTROOM: return '公共廁所';
    case POIType.VIEWPOINT: return '觀景點';
    case POIType.PEAK: return '山頂';
    default: return '';
  }
}

/**
 * 從 Overpass API 獲取真實 POI 數據
 */
export async function fetchPOIsFromAPI(
  latitude: number,
  longitude: number,
  radius: number = 5,
  types?: POIType[]
): Promise<POI[]> {
  try {
    const radiusMeters = radius * 1000; // 轉換為公尺
    const query = buildOverpassQuery(latitude, longitude, radiusMeters);
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    
    if (!response.ok) {
      console.warn('Overpass API request failed, falling back to sample data');
      return SAMPLE_POIS;
    }
    
    const data = await response.json();
    const elements = data.elements || [];
    
    const pois: POI[] = [];
    for (const element of elements) {
      if (!element.lat || !element.lon || !element.tags) continue;
      
      const poiType = mapOSMToPOIType(element.tags);
      if (!poiType) continue;
      
      // 如果有類型過濾，跳過不匹配的
      if (types && types.length > 0 && !types.includes(poiType)) continue;
      
      const name = element.tags.name || element.tags.brand || generateDescription(element.tags, poiType);
      
      pois.push({
        id: `osm_${element.id}`,
        type: poiType,
        name: name,
        description: generateDescription(element.tags, poiType),
        latitude: element.lat,
        longitude: element.lon,
        elevation: element.tags.ele ? parseFloat(element.tags.ele) : undefined,
        hours: element.tags.opening_hours,
        website: element.tags.website,
        phone: element.tags.phone,
        tags: Object.entries(element.tags)
          .filter(([k]) => !['name', 'source', 'created_by'].includes(k))
          .map(([k, v]) => `${k}:${v}`)
          .slice(0, 5),
      });
    }
    
    // 如果 API 返回結果太少，合併範例數據
    if (pois.length < 3) {
      return [...pois, ...SAMPLE_POIS];
    }
    
    return pois;
  } catch (error) {
    console.warn('Overpass API error, falling back to sample data:', error);
    return SAMPLE_POIS;
  }
}

/**
 * 本地 POI 數據庫（使用 AsyncStorage）
 */
export async function savePOIsLocally(pois: POI[]): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('cached_pois', JSON.stringify(pois));
    await AsyncStorage.setItem('cached_pois_time', Date.now().toString());
  } catch (error) {
    console.error('Failed to save POIs locally:', error);
  }
}

export async function loadPOIsLocally(): Promise<POI[]> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const data = await AsyncStorage.getItem('cached_pois');
    const timeStr = await AsyncStorage.getItem('cached_pois_time');
    
    if (!data) return [];
    
    // 緩存 30 分鐘有效
    if (timeStr) {
      const cacheAge = Date.now() - parseInt(timeStr, 10);
      if (cacheAge > 30 * 60 * 1000) return []; // 過期
    }
    
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load POIs locally:', error);
    return [];
  }
}

/**
 * 獲取 POI 列表（優先使用本地緩存，否則從 Overpass API 獲取）
 */
export async function getPOIs(
  latitude: number,
  longitude: number,
  radius: number = 5,
  types?: POIType[],
  forceRefresh: boolean = false
): Promise<POI[]> {
  if (!forceRefresh) {
    const cached = await loadPOIsLocally();
    if (cached.length > 0) {
      // 如果有類型過濾
      if (types && types.length > 0) {
        return cached.filter(poi => types.includes(poi.type));
      }
      return cached;
    }
  }

  const pois = await fetchPOIsFromAPI(latitude, longitude, radius, types);
  await savePOIsLocally(pois);
  return pois;
}

/**
 * 添加自定義 POI
 */
export async function addCustomPOI(poi: POI): Promise<void> {
  const pois = await loadPOIsLocally();
  pois.push(poi);
  await savePOIsLocally(pois);
}

/**
 * 刪除 POI
 */
export async function deletePOI(poiId: string): Promise<void> {
  const pois = await loadPOIsLocally();
  const filtered = pois.filter((poi) => poi.id !== poiId);
  await savePOIsLocally(filtered);
}
