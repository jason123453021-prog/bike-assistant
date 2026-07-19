/**
 * POI (Point of Interest) 類型定義
 * 用於地圖上的興趣點標記
 */

export enum POIType {
  // 補給點
  CONVENIENCE_STORE = 'convenience_store', // 便利商店
  RESTAURANT = 'restaurant', // 餐廳
  CAFE = 'cafe', // 咖啡館
  
  // 飲水點
  WATER_FOUNTAIN = 'water_fountain', // 飲水機
  
  // 廁所
  RESTROOM = 'restroom', // 廁所
  MOBILE_RESTROOM = 'mobile_restroom', // 流動廁所
  
  // 拍照點
  PHOTO_SPOT = 'photo_spot', // 拍照點
  VIEWPOINT = 'viewpoint', // 觀景點
  
  // 山頭制高點
  SUMMIT = 'summit', // 山頂
  PEAK = 'peak', // 高峰
}

export interface POI {
  id: string;
  type: POIType;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  elevation?: number; // 海拔高度（公尺）
  distance?: number; // 距離路線起點的距離（公里）
  rating?: number; // 評分（0-5）
  imageUrl?: string; // 圖片 URL
  website?: string; // 網站
  phone?: string; // 電話
  hours?: string; // 營業時間
  tags?: string[]; // 標籤
  createdAt?: Date;
  updatedAt?: Date;
}

export interface POIFilter {
  types?: POIType[];
  maxDistance?: number; // 最大距離（公里）
  minRating?: number; // 最小評分
  searchRadius?: number; // 搜尋半徑（公里）
}

export const POI_ICONS = {
  [POIType.CONVENIENCE_STORE]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/convenience_store_icon-2wYvCJUamFGHKJiYvxNzMm.webp',
  [POIType.RESTAURANT]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/restaurant_icon-FZyhTjQbh8qvYxadcZ3UiM.webp',
  [POIType.CAFE]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/cafe_icon-CPgJ93T4qFU5KgPJhQ4d4z.webp',
  [POIType.WATER_FOUNTAIN]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/water_dispenser_icon-N4GxEuGprDUAF22dGpikNt.webp',
  [POIType.RESTROOM]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/toilet_icon-QcZpib2V6zZMPNDRDZgyGL.webp',
  [POIType.MOBILE_RESTROOM]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/toilet_icon-QcZpib2V6zZMPNDRDZgyGL.webp', // 使用相同的廁所圖示
  [POIType.PHOTO_SPOT]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/viewpoint_icon-hHPUuKz6dyxh9xF33ivrv7.webp', // 使用相機圖示
  [POIType.VIEWPOINT]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/viewpoint_icon-hHPUuKz6dyxh9xF33ivrv7.webp',
  [POIType.SUMMIT]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/mountain_peak_icon-iF7W8bqr85jet66YfT3vXM.webp',
  [POIType.PEAK]: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/mountain_peak_icon-iF7W8bqr85jet66YfT3vXM.webp', // 使用相同的山峰圖示
};

export const POI_COLORS = {
  [POIType.CONVENIENCE_STORE]: '#FF6B6B', // 紅色
  [POIType.RESTAURANT]: '#FFA500', // 橙色
  [POIType.CAFE]: '#8B4513', // 棕色
  [POIType.WATER_FOUNTAIN]: '#4A90E2', // 藍色
  [POIType.RESTROOM]: '#9B59B6', // 紫色
  [POIType.MOBILE_RESTROOM]: '#9B59B6', // 紫色
  [POIType.PHOTO_SPOT]: '#E74C3C', // 紅色
  [POIType.VIEWPOINT]: '#27AE60', // 綠色
  [POIType.SUMMIT]: '#34495E', // 深灰色
  [POIType.PEAK]: '#34495E', // 深灰色
};

export const POI_LABELS = {
  [POIType.CONVENIENCE_STORE]: '便利商店',
  [POIType.RESTAURANT]: '餐廳',
  [POIType.CAFE]: '咖啡館',
  [POIType.WATER_FOUNTAIN]: '飲水機',
  [POIType.RESTROOM]: '廁所',
  [POIType.MOBILE_RESTROOM]: '流動廁所',
  [POIType.PHOTO_SPOT]: '拍照點',
  [POIType.VIEWPOINT]: '觀景點',
  [POIType.SUMMIT]: '山頂',
  [POIType.PEAK]: '高峰',
};
