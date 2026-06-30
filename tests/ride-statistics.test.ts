import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getRideStatisticsManager } from '@/lib/ride-statistics-manager';
import { getSocialShareManager } from '@/lib/social-share-manager';

describe('RideStatisticsManager', () => {
  let manager = getRideStatisticsManager();

  beforeEach(() => {
    manager = getRideStatisticsManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should start a new ride', () => {
    manager.startRide('測試路線');
    const stats = manager.getCurrentRideStats();

    expect(stats).not.toBeNull();
    expect(stats?.routeName).toBe('測試路線');
    expect(stats?.totalDistance).toBe(0);
  });

  it('should add track points and calculate distance', () => {
    manager.startRide();

    // 添加第一個點
    manager.addTrackPoint(25.0, 121.5, 100);

    // 添加第二個點（約111米遠）
    manager.addTrackPoint(25.001, 121.5, 100);

    const stats = manager.getCurrentRideStats();

    expect(stats?.totalDistance).toBeGreaterThan(0);
    expect(stats?.maxSpeed).toBeGreaterThan(0);
  });

  it('should calculate elevation gain and loss', () => {
    manager.startRide();

    manager.addTrackPoint(25.0, 121.5, 100);
    manager.addTrackPoint(25.001, 121.5, 150); // 上升 50m
    manager.addTrackPoint(25.002, 121.5, 100); // 下降 50m

    const stats = manager.getCurrentRideStats();

    expect(stats?.totalElevationGain).toBeGreaterThan(0);
    expect(stats?.totalElevationLoss).toBeGreaterThan(0);
  });

  it('should end a ride and save statistics', async () => {
    manager.startRide('測試騎乘');

    manager.addTrackPoint(25.0, 121.5, 100);
    manager.addTrackPoint(25.001, 121.5, 100);

    const statistics = await manager.endRide();

    expect(statistics).not.toBeNull();
    expect(statistics?.routeName).toBe('測試騎乘');
    expect(statistics?.totalDistance).toBeGreaterThan(0);
    expect(statistics?.totalTime).toBeGreaterThan(0);
    expect(statistics?.averageSpeed).toBeGreaterThan(0);
  });

  it('should retrieve ride history', async () => {
    manager.startRide('騎乘 1');
    manager.addTrackPoint(25.0, 121.5, 100);
    manager.addTrackPoint(25.001, 121.5, 100);
    await manager.endRide();

    const history = await manager.getRideHistory();

    expect(history.rides.length).toBeGreaterThan(0);
    expect(history.totalRides).toBeGreaterThan(0);
    expect(history.totalDistance).toBeGreaterThan(0);
  });

  it('should delete ride statistics', async () => {
    manager.startRide('要刪除的騎乘');
    manager.addTrackPoint(25.0, 121.5, 100);
    manager.addTrackPoint(25.001, 121.5, 100);
    const stats = await manager.endRide();

    expect(stats).not.toBeNull();

    const historyBefore = await manager.getRideHistory();
    const countBefore = historyBefore.rides.length;

    await manager.deleteRideStatistics(stats!.id);

    const historyAfter = await manager.getRideHistory();
    const countAfter = historyAfter.rides.length;

    expect(countAfter).toBe(countBefore - 1);
  });
});

describe('SocialShareManager', () => {
  let manager = getSocialShareManager();

  beforeEach(() => {
    manager = getSocialShareManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should generate share text', () => {
    const statistics = {
      id: 'test-ride',
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      totalDistance: 10000, // 10 km
      totalTime: 3600, // 1 hour
      averageSpeed: 10,
      maxSpeed: 20,
      totalElevationGain: 100,
      totalElevationLoss: 100,
      routeName: '測試路線',
      trackPoints: [],
      timestamp: Date.now(),
    };

    const shareText = manager.generateShareText(statistics);

    expect(shareText).toContain('10.00');
    expect(shareText).toContain('10.0');
    expect(shareText).toContain('20.0');
    expect(shareText).toContain('100');
    expect(shareText).toContain('測試路線');
  });

  it('should generate custom share text', () => {
    const statistics = {
      id: 'test-ride',
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      totalDistance: 10000,
      totalTime: 3600,
      averageSpeed: 10,
      maxSpeed: 20,
      totalElevationGain: 100,
      totalElevationLoss: 100,
      routeName: '測試路線',
      trackPoints: [],
      timestamp: Date.now(),
    };

    const customMessage = '我剛完成了一次精彩的騎乘！';
    const shareText = manager.generateShareText(statistics, customMessage);

    expect(shareText).toBe(customMessage);
  });

  it('should format time correctly', () => {
    const statistics = {
      id: 'test-ride',
      startTime: Date.now() - 7200000,
      endTime: Date.now(),
      totalDistance: 20000,
      totalTime: 7200, // 2 hours
      averageSpeed: 10,
      maxSpeed: 20,
      totalElevationGain: 200,
      totalElevationLoss: 200,
      routeName: '長距離騎乘',
      trackPoints: [],
      timestamp: Date.now(),
    };

    const shareText = manager.generateShareText(statistics);

    expect(shareText).toContain('2h');
  });
});
