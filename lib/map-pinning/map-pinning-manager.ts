import { useState, useCallback } from 'react';

export interface PinnedLocation {
  id: string;
  latitude: number;
  longitude: number;
  name?: string;
  timestamp: number;
}

export interface RouteSegment {
  id: string;
  type: 'gpx' | 'osrm' | 'manual';
  points: Array<{ latitude: number; longitude: number; elevation?: number }>;
  distance?: number;
  duration?: number;
  color: string;
}

export interface MultiTrackState {
  gpxRoute?: RouteSegment;
  osrmRoute?: RouteSegment;
  manualRoutes: RouteSegment[];
  pinnedLocations: PinnedLocation[];
}

const OSRM_API_BASE = 'https://router.project-osrm.org/route/v1/bike';

export class MapPinningManager {
  private static instance: MapPinningManager;
  private state: MultiTrackState = {
    manualRoutes: [],
    pinnedLocations: [],
  };
  private listeners: Set<(state: MultiTrackState) => void> = new Set();

  private constructor() {}

  static getInstance(): MapPinningManager {
    if (!MapPinningManager.instance) {
      MapPinningManager.instance = new MapPinningManager();
    }
    return MapPinningManager.instance;
  }

  async addPinnedLocation(location: Omit<PinnedLocation, 'id' | 'timestamp'>) {
    const pinnedLocation: PinnedLocation = {
      ...location,
      id: `pin_${Date.now()}`,
      timestamp: Date.now(),
    };
    this.state.pinnedLocations.push(pinnedLocation);
    this.notifyListeners();
    return pinnedLocation;
  }

  async planRouteWithOSRM(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    name?: string
  ): Promise<RouteSegment | null> {
    try {
      const url = `${OSRM_API_BASE}/${startLng},${startLat};${endLng},${endLat}?steps=true&geometries=geojson&overview=full`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        console.error('[MapPinning] OSRM routing failed:', data);
        return null;
      }

      const route = data.routes[0];
      const coordinates = route.geometry.coordinates;
      const points = coordinates.map((coord: number[]) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));

      const osrmRoute: RouteSegment = {
        id: `osrm_${Date.now()}`,
        type: 'osrm',
        points,
        distance: route.distance,
        duration: route.duration,
        color: '#FF6B6B', // 紅色用於 OSRM 路線
      };

      // 保留現有的 GPX 路線，添加新的 OSRM 路線
      this.state.osrmRoute = osrmRoute;
      this.notifyListeners();
      return osrmRoute;
    } catch (error) {
      console.error('[MapPinning] OSRM request failed:', error);
      return null;
    }
  }

  setGPXRoute(route: RouteSegment) {
    this.state.gpxRoute = { ...route, color: '#4ECDC4' }; // 青色用於 GPX 路線
    this.notifyListeners();
  }

  addManualRoute(route: RouteSegment) {
    this.state.manualRoutes.push({ ...route, color: '#95E1D3' });
    this.notifyListeners();
  }

  removePinnedLocation(id: string) {
    this.state.pinnedLocations = this.state.pinnedLocations.filter(p => p.id !== id);
    this.notifyListeners();
  }

  removeOSRMRoute() {
    this.state.osrmRoute = undefined;
    this.notifyListeners();
  }

  removeManualRoute(id: string) {
    this.state.manualRoutes = this.state.manualRoutes.filter(r => r.id !== id);
    this.notifyListeners();
  }

  clearAllRoutes() {
    this.state.gpxRoute = undefined;
    this.state.osrmRoute = undefined;
    this.state.manualRoutes = [];
    this.notifyListeners();
  }

  getState(): MultiTrackState {
    return { ...this.state };
  }

  subscribe(listener: (state: MultiTrackState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getState()));
  }
}

export function useMapPinning() {
  const manager = MapPinningManager.getInstance();
  const [state, setState] = useState<MultiTrackState>(manager.getState());

  return {
    manager,
    state,
    addPinnedLocation: useCallback(
      (location: Omit<PinnedLocation, 'id' | 'timestamp'>) =>
        manager.addPinnedLocation(location),
      []
    ),
    planRouteWithOSRM: useCallback(
      (startLat: number, startLng: number, endLat: number, endLng: number, name?: string) =>
        manager.planRouteWithOSRM(startLat, startLng, endLat, endLng, name),
      []
    ),
    setGPXRoute: useCallback((route: RouteSegment) => manager.setGPXRoute(route), []),
    addManualRoute: useCallback((route: RouteSegment) => manager.addManualRoute(route), []),
    removePinnedLocation: useCallback((id: string) => manager.removePinnedLocation(id), []),
    removeOSRMRoute: useCallback(() => manager.removeOSRMRoute(), []),
    removeManualRoute: useCallback((id: string) => manager.removeManualRoute(id), []),
    clearAllRoutes: useCallback(() => manager.clearAllRoutes(), []),
  };
}
