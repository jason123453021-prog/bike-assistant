import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PermissionsManager } from '@/lib/permissions-manager';
import { getPermissionMonitor } from '@/lib/permission-monitor';
import { getBatteryOptimizationMonitor } from '@/lib/battery-optimization-monitor';
import { TurnByTurnNavigationManager } from '@/lib/turn-by-turn-navigation';
import { GpxOptimizer, type GpxPoint } from '@/lib/gpx-optimizer';
import { getNavigationRecoveryManager } from '@/lib/navigation-recovery-manager';

describe('Smart Bike Assistant - Integration Tests', () => {
  describe('Permission Management', () => {
    it('should initialize permissions manager', async () => {
      const hasOnboarded = await PermissionsManager.hasCompletedOnboarding();
      expect(typeof hasOnboarded).toBe('boolean');
    });

    it('should monitor permission changes', async () => {
      const monitor = getPermissionMonitor();
      const state = await monitor.getSnapshot();
      expect(state instanceof Map).toBe(true);
    });

    it('should track battery optimization status', async () => {
      const monitor = getBatteryOptimizationMonitor();
      const status = monitor.getStatus();
      expect(status).toHaveProperty('isIgnoringOptimizations');
      expect(status).toHaveProperty('lastChecked');
    });
  });

  describe('Turn-by-Turn Navigation', () => {
    let navigator: TurnByTurnNavigationManager;

    beforeEach(() => {
      navigator = new TurnByTurnNavigationManager();
    });

    it('should initialize navigation instructions', () => {
      const instructions = [
        {
          id: '1',
          type: 'start' as const,
          direction: 'straight' as const,
          angle: 0,
          distance: 100,
          instruction: '開始騎乘',
          coordinates: [25.0, 121.5] as [number, number],
        },
        {
          id: '2',
          type: 'turn-left' as const,
          direction: 'left' as const,
          angle: 90,
          distance: 200,
          street: '中山路',
          instruction: '左轉進入中山路',
          coordinates: [25.01, 121.51] as [number, number],
        },
      ];

      const polyline: [number, number][] = [
        [25.0, 121.5],
        [25.005, 121.505],
        [25.01, 121.51],
      ];

      navigator.setInstructions(instructions, polyline);
      const state = navigator.getCurrentState([25.0, 121.5]);

      expect(state.currentStep).toBe(1);
      expect(state.totalSteps).toBe(2);
      expect(state.isOffRoute).toBe(false);
    });

    it('should generate voice text for turn instructions', () => {
      const instruction = {
        id: '1',
        type: 'turn-left' as const,
        direction: 'left' as const,
        angle: 90,
        distance: 500,
        street: '中山路',
        instruction: '左轉',
        coordinates: [25.0, 121.5] as [number, number],
      };

      const voiceText = navigator.getTurnVoiceText(instruction);
      expect(voiceText).toContain('左轉');
      expect(voiceText).toContain('中山路');
    });

    it('should detect off-route condition', () => {
      const instructions = [
        {
          id: '1',
          type: 'start' as const,
          direction: 'straight' as const,
          angle: 0,
          distance: 100,
          instruction: '開始騎乘',
          coordinates: [25.0, 121.5] as [number, number],
        },
      ];

      const polyline: [number, number][] = [
        [25.0, 121.5],
        [25.01, 121.51],
      ];

      navigator.setInstructions(instructions, polyline);

      // 距離路線太遠的位置
      const state = navigator.getCurrentState([25.1, 121.6]);
      expect(state.isOffRoute).toBe(true);
      expect(state.offRouteDistance).toBeGreaterThan(0);
    });
  });

  describe('GPX Optimization', () => {
    const createTestPoints = (): GpxPoint[] => [
      {
        latitude: 25.0,
        longitude: 121.5,
        elevation: 100,
        timestamp: 0,
        speed: 10,
      },
      {
        latitude: 25.001,
        longitude: 121.501,
        elevation: 102,
        timestamp: 10,
        speed: 12,
      },
      {
        latitude: 25.002,
        longitude: 121.502,
        elevation: 105,
        timestamp: 20,
        speed: 15,
      },
      {
        latitude: 25.003,
        longitude: 121.503,
        elevation: 108,
        timestamp: 30,
        speed: 14,
      },
      {
        latitude: 25.004,
        longitude: 121.504,
        elevation: 110,
        timestamp: 40,
        speed: 11,
      },
    ];

    it('should remove redundant points', () => {
      const points = createTestPoints();
      const compressed = GpxOptimizer.removeRedundantPoints(points, 1);
      expect(compressed.length).toBeLessThanOrEqual(points.length);
    });

    it('should simplify track', () => {
      const points = createTestPoints();
      const simplified = GpxOptimizer.simplifyTrack(points, 10);
      expect(simplified.length).toBeGreaterThanOrEqual(2);
    });

    it('should smooth track', () => {
      const points = createTestPoints();
      const smoothed = GpxOptimizer.smoothTrack(points, 3);
      expect(smoothed.length).toBe(points.length);
      // 平滑後的點應該更接近
      expect(smoothed[2].latitude).toBeLessThan(points[2].latitude + 0.001);
    });

    it('should calculate track statistics', () => {
      const points = createTestPoints();
      const stats = GpxOptimizer.calculateStats(points);

      expect(stats.totalDistance).toBeGreaterThan(0);
      expect(stats.totalDuration).toBe(40); // 最後一個時間戳 - 第一個時間戳
      expect(stats.totalElevation).toBeGreaterThan(0);
      expect(stats.maxSpeed).toBeGreaterThan(0);
    });

    it('should segment track by distance', () => {
      const points = createTestPoints();
      const segments = GpxOptimizer.segmentByDistance(points, 100);
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].points.length).toBeGreaterThan(0);
    });

    it('should compress track', () => {
      const points = createTestPoints();
      const compressed = GpxOptimizer.compressTrack(points, {
        simplifyEpsilon: 5,
        minDistance: 1,
        smoothWindow: 3,
        maxPoints: 500,
      });

      expect(compressed.length).toBeGreaterThan(0);
      expect(compressed.length).toBeLessThanOrEqual(points.length);
    });
  });

  describe('Navigation Recovery', () => {
    let manager: ReturnType<typeof getNavigationRecoveryManager>;

    beforeEach(async () => {
      manager = getNavigationRecoveryManager();
      await manager.initialize();
    });

    afterEach(async () => {
      await manager.clearCheckpoint();
    });

    it('should save and restore checkpoint', async () => {
      const instructions: any[] = [
        {
          id: '1',
          type: 'start',
          direction: 'straight',
          angle: 0,
          distance: 100,
          instruction: '開始騎乘',
          coordinates: [25.0, 121.5],
        },
      ];

      const polyline: [number, number][] = [
        [25.0, 121.5],
        [25.01, 121.51],
      ];

      await manager.saveCheckpoint(25.0, 121.5, 0, 500, 60, polyline, instructions);

      const state = manager.getState();
      expect(state.hasCheckpoint).toBe(true);
      expect(state.checkpoint?.distance).toBe(500);
    });

    it('should calculate recovery progress', async () => {
      const instructions: any[] = [
        {
          id: '1',
          type: 'start',
          direction: 'straight',
          angle: 0,
          distance: 100,
          instruction: '開始騎乘',
          coordinates: [25.0, 121.5],
        },
        {
          id: '2',
          type: 'turn-left',
          direction: 'left',
          angle: 90,
          distance: 200,
          instruction: '左轉',
          coordinates: [25.01, 121.51],
        },
      ];

      const polyline: [number, number][] = [
        [25.0, 121.5],
        [25.01, 121.51],
      ];

      await manager.saveCheckpoint(25.0, 121.5, 1, 1000, 120, polyline, instructions);

      const progress = manager.getRecoveryProgress();
      expect(progress.completedSteps).toBe(1);
      expect(progress.totalSteps).toBe(2);
      expect(progress.progressPercentage).toBe(50);
    });

    it('should validate checkpoint freshness', async () => {
      const instructions: any[] = [];
      const polyline: [number, number][] = [];

      await manager.saveCheckpoint(25.0, 121.5, 0, 0, 0, polyline, instructions);

      const isValid = manager.isCheckpointValid(3600);
      expect(isValid).toBe(true);

      const isStale = manager.isCheckpointValid(0);
      expect(isStale).toBe(false);
    });
  });

  describe('End-to-End Navigation Flow', () => {
    it('should complete full navigation cycle', async () => {
      // 1. 初始化權限
      const hasOnboarded = await PermissionsManager.hasCompletedOnboarding();
      expect(typeof hasOnboarded).toBe('boolean');

      // 2. 設置導航
      const navigator = new TurnByTurnNavigationManager();
      const instructions: any[] = [
        {
          id: '1',
          type: 'start' as const,
          direction: 'straight' as const,
          angle: 0,
          distance: 1000,
          instruction: '開始騎乘',
          coordinates: [25.0, 121.5] as [number, number],
        },
      ];

      const polyline: [number, number][] = [
        [25.0, 121.5],
        [25.01, 121.51],
      ];

      navigator.setInstructions(instructions, polyline);

      // 3. 保存檢查點
      const manager = getNavigationRecoveryManager();
      await manager.initialize();
      await manager.saveCheckpoint(25.0, 121.5, 0, 500, 60, polyline, instructions);

      // 4. 驗證恢復狀態
      const state = manager.getState();
      expect(state.hasCheckpoint).toBe(true);

      // 5. 清理
      await manager.clearCheckpoint();
    });
  });
});
