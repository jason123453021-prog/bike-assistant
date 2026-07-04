import { DOMParser } from '@xmldom/xmldom';
import { Feature, LineString } from 'geojson';
import * as toGeoJSON from '@mapbox/togeojson';

export class GpxTrackManager {
  static parseGpxToGeoJSON(gpxString: string): Feature<LineString> {
    const parser = new DOMParser();
    const gpxDom = parser.parseFromString(gpxString, 'text/xml');
    // togeojson 期望一個 DOM Document，而不是特定的 XMLDocument 類型，因此這裡直接傳遞
    // 由於 @mapbox/togeojson 沒有官方的 TypeScript 類型定義，我們將其視為 any 處理
    const geoJson = (toGeoJSON as any).gpx(gpxDom);

    // 假設 GPX 只有一條軌跡線
    if (geoJson.features.length > 0 && geoJson.features[0].geometry.type === 'LineString') {
      return geoJson.features[0] as Feature<LineString>;
    }
    throw new Error('Invalid GPX format or no LineString found.');
  }
}
