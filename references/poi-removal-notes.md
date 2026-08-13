# POI 功能移除盤點

## 導航頁

`app/(tabs)/map.tsx` 包含 POI 資料載入效果、地圖標記狀態、POI 點擊卡片與導向 POI 的 OSRM 路徑流程。這些區段可完整移除，不影響長按地圖釘選、GPX 與既有釘選導航。

## Leaflet 地圖

`components/leaflet-map.tsx` 的 POI 功能獨立於導航路徑圖層：包括 POI 圖示常數、`POIMarker` 屬性、marker-cluster 圖層、`setPOIMarkers` WebView 訊息、props 同步效果與 `poiTapped` 回呼。清除這些區段後，GPX、路徑疊加、目前位置與里程標記不受影響。

React 層目前仍在 props 解構 `poiMarkers` 與 `onPOITap`；必須與 WebView 的 `setPOIMarkers`、`poiTapped` 分支一起清除，否則會留下無效的序列化訊息或型別引用。

目前導航頁已移除 POI 載入效果、地圖 props 與詳細卡片；Leaflet WebView 的 `setPOIMarkers` 分支也已清除。剩餘工作為清理 React props 解構、同步 effect、`poiTapped` 回呼，以及刪除資料與測試檔案。
