import { useEffect, useRef, useCallback, useState } from 'react';

export interface MapViewState {
  center: { latitude: number; longitude: number };
  zoom: number;
  rotation: number;
}

export interface MapInteractionConfig {
  autoRecenterDelayMs: number; // 自動恢復置中的延遲時間（毫秒）
  minZoom: number;
  maxZoom: number;
}

const DEFAULT_CONFIG: MapInteractionConfig = {
  autoRecenterDelayMs: 3000, // 3 秒
  minZoom: 10,
  maxZoom: 18,
};

export class MapInteractionManager {
  private static instance: MapInteractionManager;
  private config: MapInteractionConfig = DEFAULT_CONFIG;
  private isUserInteracting: boolean = false;
  private autoRecenterTimer: ReturnType<typeof setTimeout> | null = null;
  private currentViewState: MapViewState = {
    center: { latitude: 0, longitude: 0 },
    zoom: 15,
    rotation: 0,
  };
  private userModifiedZoom: number = 15;
  private userModifiedRotation: number = 0;
  private listeners: Set<(state: MapViewState) => void> = new Set();

  private constructor() {}

  static getInstance(): MapInteractionManager {
    if (!MapInteractionManager.instance) {
      MapInteractionManager.instance = new MapInteractionManager();
    }
    return MapInteractionManager.instance;
  }

  setConfig(config: Partial<MapInteractionConfig>) {
    this.config = { ...this.config, ...config };
  }

  onUserInteractionStart() {
    this.isUserInteracting = true;
    this.userModifiedZoom = this.currentViewState.zoom;
    this.userModifiedRotation = this.currentViewState.rotation;
    this.clearAutoRecenterTimer();
  }

  onUserInteractionEnd() {
    this.isUserInteracting = false;
    this.startAutoRecenterTimer();
  }

  onMapDrag(newCenter: { latitude: number; longitude: number }) {
    this.currentViewState.center = newCenter;
    this.notifyListeners();
  }

  onMapZoom(newZoom: number) {
    const clampedZoom = Math.max(
      this.config.minZoom,
      Math.min(newZoom, this.config.maxZoom)
    );
    this.currentViewState.zoom = clampedZoom;
    this.userModifiedZoom = clampedZoom;
    this.notifyListeners();
  }

  onMapRotate(newRotation: number) {
    // 將旋轉角度正規化到 0-360 範圍
    this.currentViewState.rotation = ((newRotation % 360) + 360) % 360;
    this.userModifiedRotation = this.currentViewState.rotation;
    this.notifyListeners();
  }

  updateCurrentLocation(newCenter: { latitude: number; longitude: number }) {
    if (!this.isUserInteracting) {
      this.currentViewState.center = newCenter;
      this.notifyListeners();
    }
  }

  updateHeading(newHeading: number) {
    if (!this.isUserInteracting) {
      this.currentViewState.rotation = newHeading;
      this.notifyListeners();
    }
  }

  private startAutoRecenterTimer() {
    this.clearAutoRecenterTimer();
    this.autoRecenterTimer = setTimeout(() => {
      this.autoRecenterToCurrentLocation();
    }, this.config.autoRecenterDelayMs);
  }

  private clearAutoRecenterTimer() {
    if (this.autoRecenterTimer) {
      clearTimeout(this.autoRecenterTimer);
      this.autoRecenterTimer = null;
    }
  }

  private autoRecenterToCurrentLocation() {
    // 只改變中心點，保留用戶調整的縮放和旋轉
    this.currentViewState.zoom = this.userModifiedZoom;
    this.currentViewState.rotation = this.userModifiedRotation;
    this.notifyListeners();
  }

  resetToDefaults(defaultZoom: number = 15, defaultRotation: number = 0) {
    this.currentViewState.zoom = defaultZoom;
    this.currentViewState.rotation = defaultRotation;
    this.userModifiedZoom = defaultZoom;
    this.userModifiedRotation = defaultRotation;
    this.notifyListeners();
  }

  getViewState(): MapViewState {
    return { ...this.currentViewState };
  }

  subscribe(listener: (state: MapViewState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getViewState()));
  }
}

export function useMapInteraction(defaultZoom: number = 15, defaultRotation: number = 0) {
  const manager = MapInteractionManager.getInstance();
  const [viewState, setViewState] = useState<MapViewState>(manager.getViewState());
  const isInteractingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = manager.subscribe(setViewState);
    return unsubscribe;
  }, []);

  return {
    manager,
    viewState,
    isInteracting: isInteractingRef.current,
    onInteractionStart: useCallback(() => {
      isInteractingRef.current = true;
      manager.onUserInteractionStart();
    }, []),
    onInteractionEnd: useCallback(() => {
      isInteractingRef.current = false;
      manager.onUserInteractionEnd();
    }, []),
    onDrag: useCallback((center: { latitude: number; longitude: number }) => {
      manager.onMapDrag(center);
    }, []),
    onZoom: useCallback((zoom: number) => {
      manager.onMapZoom(zoom);
    }, []),
    onRotate: useCallback((rotation: number) => {
      manager.onMapRotate(rotation);
    }, []),
    updateLocation: useCallback((center: { latitude: number; longitude: number }) => {
      manager.updateCurrentLocation(center);
    }, []),
    updateHeading: useCallback((heading: number) => {
      manager.updateHeading(heading);
    }, []),
    resetToDefaults: useCallback(() => {
      manager.resetToDefaults(defaultZoom, defaultRotation);
    }, [defaultZoom, defaultRotation]),
  };
}
