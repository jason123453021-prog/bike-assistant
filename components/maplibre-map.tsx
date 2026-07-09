import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Feature, LineString, Point } from 'geojson';

interface MapLibreMapProps {
  currentLocation?: Feature<Point> | null;
  gpxRoute?: Feature<LineString> | null;
  rideTrack?: Feature<LineString> | null;
  onMapReady?: (map: maplibregl.Map) => void;
}

export function MapLibreMap({
  currentLocation,
  gpxRoute,
  rideTrack,
  onMapReady,
}: MapLibreMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current) return;

    // 初始化地圖
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [121.5654, 25.0330], // 台灣預設位置
      zoom: 13,
    });

    map.current.on('load', () => {
      setIsLoading(false);
      onMapReady?.(map.current!);

      // 添加 GPX 路線圖層
      if (gpxRoute) {
        addGpxLayer(map.current!, gpxRoute);
      }

      // 添加騎乘軌跡圖層
      if (rideTrack) {
        addRideTrackLayer(map.current!, rideTrack);
      }

      // 添加當前位置標記
      if (currentLocation) {
        addCurrentLocationMarker(map.current!, currentLocation);
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // 更新 GPX 路線
  useEffect(() => {
    if (!map.current || !gpxRoute) return;

    const source = map.current.getSource('gpx-route') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(gpxRoute);
    } else {
      addGpxLayer(map.current, gpxRoute);
    }
  }, [gpxRoute]);

  // 更新騎乘軌跡
  useEffect(() => {
    if (!map.current || !rideTrack) return;

    const source = map.current.getSource('ride-track') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(rideTrack);
    } else {
      addRideTrackLayer(map.current, rideTrack);
    }
  }, [rideTrack]);

  // 更新當前位置
  useEffect(() => {
    if (!map.current || !currentLocation) return;

    const source = map.current.getSource('current-location') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(currentLocation);
      // 地圖中心跟隨當前位置
      const coords = currentLocation.geometry.coordinates;
      map.current.flyTo({
        center: [coords[0], coords[1]],
        zoom: 15,
        duration: 1000,
      });
    } else {
      addCurrentLocationMarker(map.current, currentLocation);
    }
  }, [currentLocation]);

  return (
    <View style={styles.container}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      />
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      )}
    </View>
  );
}

function addGpxLayer(map: maplibregl.Map, gpxRoute: Feature<LineString>) {
  if (!map.getSource('gpx-route')) {
    map.addSource('gpx-route', {
      type: 'geojson',
      data: gpxRoute,
    });
  }

  if (!map.getLayer('gpx-route-line')) {
    map.addLayer({
      id: 'gpx-route-line',
      type: 'line',
      source: 'gpx-route',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 3,
        'line-opacity': 0.8,
      },
    });
  }
}

function addRideTrackLayer(map: maplibregl.Map, rideTrack: Feature<LineString>) {
  if (!map.getSource('ride-track')) {
    map.addSource('ride-track', {
      type: 'geojson',
      data: rideTrack,
    });
  }

  if (!map.getLayer('ride-track-line')) {
    map.addLayer({
      id: 'ride-track-line',
      type: 'line',
      source: 'ride-track',
      paint: {
        'line-color': '#22c55e',
        'line-width': 2,
        'line-opacity': 0.9,
      },
    });
  }
}

function addCurrentLocationMarker(map: maplibregl.Map, currentLocation: Feature<Point>) {
  if (!map.getSource('current-location')) {
    map.addSource('current-location', {
      type: 'geojson',
      data: currentLocation,
    });
  }

  if (!map.getLayer('current-location-circle')) {
    map.addLayer({
      id: 'current-location-circle',
      type: 'circle',
      source: 'current-location',
      paint: {
        'circle-radius': 8,
        'circle-color': '#0a7ea4',
        'circle-opacity': 0.8,
      },
    });
  }

  if (!map.getLayer('current-location-border')) {
    map.addLayer({
      id: 'current-location-border',
      type: 'circle',
      source: 'current-location',
      paint: {
        'circle-radius': 12,
        'circle-color': 'transparent',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#0a7ea4',
        'circle-stroke-opacity': 0.5,
      },
    });
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});
