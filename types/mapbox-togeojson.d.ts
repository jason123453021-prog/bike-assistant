declare module '@mapbox/togeojson' {
  function gpx(doc: XMLDocument): GeoJSON.FeatureCollection;
  function kml(doc: XMLDocument): GeoJSON.FeatureCollection;
  // 可以根據需要添加更多函數聲明
}
