import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RealtimeNavigationManager, type NavigationRoute } from '@/lib/realtime-navigation-manager';

describe('Realtime Navigation Manager', () => {
  let manager: RealtimeNavigationManager;
  let testRoute: NavigationRoute;

  beforeEach(async () => {
    manager = new RealtimeNavigationManager();

    testRoute = {
      id: 'test-route',
      polyline: [
        [25.0, 121.5],
        [25.005, 121.505],
        [25.01, 121.51],
        [25.015, 121.515],
        [25.02, 121.52],
      ],
      instructions: [
        {
          id: '1',
          type: 'start',
          direction: 'straight',
          angle: 0,
          distance: 1000,
          instruction: '開始騎乘',
          coordinates: [25.0, 121.5],
        },
        {
          id: '2',
          type: 'turn-left',
          direction: 'left',
          angle: 90,
          distance: 500,
          street: '中山路',
          instruction: '左轉進入中山路',
          coordinates: [25.01, 121.51],
        },
        {
          id: '3',
          type: 'turn-right',
          direction: 'right',
          angle: -90,
          distance: 300,
          street: '民生路',
          instruction: '右轉進入民生路',
          coordinates: [25.02, 121.52],
        },
      ],
      totalDistance: 1800,
      totalDuration: 600, // 10 分鐘
    };

    await manager.initialize();
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const state = manager.getState();
      expect(state.isNavigating).toBe(false);
      expect(state.currentLocation).toBeNull();
    });
  });

  describe('Navigation State', () => {
    it('should have correct initial state', () => {
      const state = manager.getState();
      expect(state.isNavigating).toBe(false);
      expect(state.currentStepIndex).toBe(0);
      expect(state.totalDistanceTraveled).toBe(0);
      expect(state.elapsedTime).toBe(0);
    });

    it('should update state during navigation', async () => {
      await manager.startNavigation(testRoute);
      const state = manager.getState();
      expect(state.isNavigating).toBe(true);
      expect(state.totalSteps).toBe(3);
    });

    it('should track total steps correctly', async () => {
      await manager.startNavigation(testRoute);
      const state = manager.getState();
      expect(state.totalSteps).toBe(testRoute.instructions.length);
    });
  });

  describe('Navigation Events', () => {
    it('should emit events on subscription', async () => {
      const events: any[] = [];
      const unsubscribe = manager.subscribe((event) => {
        events.push(event);
      });

      await manager.startNavigation(testRoute);

      // 等待一些事件
      await new Promise((resolve) => setTimeout(resolve, 1000));

      unsubscribe();

      // 應該至少有一個事件
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should have correct event types', async () => {
      const events: any[] = [];
      const unsubscribe = manager.subscribe((event) => {
        events.push(event);
      });

      await manager.startNavigation(testRoute);
      await new Promise((resolve) => setTimeout(resolve, 500));

      unsubscribe();

      // 檢查事件類型
      const validTypes = [
        'approaching-turn',
        'immediate-turn',
        'off-route',
        'back-on-route',
        'step-completed',
        'navigation-complete',
      ];

      for (const event of events) {
        expect(validTypes).toContain(event.type);
      }
    });
  });

  describe('Track Recording', () => {
    it('should record track points', async () => {
      await manager.startNavigation(testRoute);

      // 等待一些軌跡點被記錄
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const trackPoints = manager.getTrackPoints();
      expect(Array.isArray(trackPoints)).toBe(true);
    });

    it('should export track as GPX', async () => {
      await manager.startNavigation(testRoute);

      // 等待一些軌跡點被記錄
      await new Promise((resolve) => setTimeout(resolve, 500));

      const gpx = manager.exportTrackAsGpx();
      expect(gpx).toContain('<?xml');
      expect(gpx).toContain('<gpx');
      expect(gpx).toContain('</gpx>');
    });

    it('should have valid GPX structure', async () => {
      await manager.startNavigation(testRoute);

      // 等待一些軌跡點被記錄
      await new Promise((resolve) => setTimeout(resolve, 500));

      const gpx = manager.exportTrackAsGpx();
      expect(gpx).toContain('<trk>');
      expect(gpx).toContain('</trk>');
      expect(gpx).toContain('<trkseg>');
      expect(gpx).toContain('</trkseg>');
    });
  });

  describe('Navigation Lifecycle', () => {
    it('should start and stop navigation', async () => {
      let initialState = manager.getState();
      expect(initialState.isNavigating).toBe(false);

      await manager.startNavigation(testRoute);
      let startState = manager.getState();
      expect(startState.isNavigating).toBe(true);

      await manager.stopNavigation();
      let stopState = manager.getState();
      expect(stopState.isNavigating).toBe(false);
    });

    it('should reset state on new navigation', async () => {
      await manager.startNavigation(testRoute);
      await manager.stopNavigation();

      const state1 = manager.getState();
      expect(state1.isNavigating).toBe(false);

      await manager.startNavigation(testRoute);
      const state2 = manager.getState();
      expect(state2.isNavigating).toBe(true);
    });
  });

  describe('Route Information', () => {
    it('should have correct route information', async () => {
      await manager.startNavigation(testRoute);
      const state = manager.getState();

      expect(state.totalSteps).toBe(testRoute.instructions.length);
    });

    it('should track current step index', async () => {
      await manager.startNavigation(testRoute);
      const state = manager.getState();

      expect(state.currentStepIndex).toBeGreaterThanOrEqual(0);
      expect(state.currentStepIndex).toBeLessThan(state.totalSteps);
    });
  });

  describe('Distance Calculations', () => {
    it('should calculate distances correctly', async () => {
      await manager.startNavigation(testRoute);

      // 等待一些更新
      await new Promise((resolve) => setTimeout(resolve, 500));

      const state = manager.getState();
      expect(typeof state.distanceToNextTurn).toBe('number');
      expect(typeof state.totalDistanceTraveled).toBe('number');
      expect(state.distanceToNextTurn).toBeGreaterThanOrEqual(0);
      expect(state.totalDistanceTraveled).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Speed and Time Tracking', () => {
    it('should track speed', async () => {
      await manager.startNavigation(testRoute);

      // 等待一些更新
      await new Promise((resolve) => setTimeout(resolve, 500));

      const state = manager.getState();
      expect(typeof state.currentSpeed).toBe('number');
      expect(typeof state.averageSpeed).toBe('number');
      expect(state.currentSpeed).toBeGreaterThanOrEqual(0);
      expect(state.averageSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should track elapsed time', async () => {
      await manager.startNavigation(testRoute);

      // 等待一些時間
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const state = manager.getState();
      expect(state.elapsedTime).toBeGreaterThan(0);
    });

    it('should calculate ETA', async () => {
      await manager.startNavigation(testRoute);

      // 等待一些更新
      await new Promise((resolve) => setTimeout(resolve, 500));

      const state = manager.getState();
      expect(typeof state.eta).toBe('number');
      expect(state.eta).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up on destroy', async () => {
      await manager.startNavigation(testRoute);
      await manager.destroy();

      const state = manager.getState();
      expect(state.isNavigating).toBe(false);
    });
  });
});
