/**
 * POI 數據源
 * 包括示例數據和 API 集成
 */

import { POI, POIType } from './poi-types';

/**
 * 示例 POI 數據（台灣常見地點）
 */
export const SAMPLE_POIS: POI[] = [
  // 便利商店
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

  // 餐廳
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

  // 咖啡館
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

  // 飲水機
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

  // 廁所
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

  // 拍照點
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

  // 山頂
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
 * 從 OpenStreetMap 或其他 API 獲取 POI
 * 這是一個示例實現，實際應用中應調用真實 API
 */
export async function fetchPOIsFromAPI(
  latitude: number,
  longitude: number,
  radius: number = 5,
  types?: POIType[]
): Promise<POI[]> {
  try {
    // 示例：使用 Overpass API 查詢 OpenStreetMap 數據
    // 實際應用中應實現真實的 API 調用

    // 這裡返回示例數據
    return SAMPLE_POIS.filter((poi) => {
      if (types && types.length > 0) {
        return types.includes(poi.type);
      }
      return true;
    });
  } catch (error) {
    console.error('Failed to fetch POIs from API:', error);
    return [];
  }
}

/**
 * 本地 POI 數據庫（使用 AsyncStorage）
 */
export async function savePOIsLocally(pois: POI[]): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('cached_pois', JSON.stringify(pois));
  } catch (error) {
    console.error('Failed to save POIs locally:', error);
  }
}

export async function loadPOIsLocally(): Promise<POI[]> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const data = await AsyncStorage.getItem('cached_pois');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load POIs locally:', error);
    return [];
  }
}

/**
 * 獲取 POI 列表（優先使用本地緩存，否則從 API 獲取）
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
