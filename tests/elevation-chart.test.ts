import { describe, it, expect } from 'vitest';

type RideStatistics = {
  id: string;
  startTime: number;
  endTime: number;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  maxSpeed: number;
  totalElevationGain: number;
  totalElevationLoss: number;
  routeName: string;
  trackPoints: Array<{ lat: number; lon: number; altitude?: number; timestamp: number }>;
  timestamp: number;
};

describe('ElevationChart', () => {
  const mockStatistics: RideStatistics = {
    id: 'test-ride',
    startTime: Date.now() - 3600000,
    endTime: Date.now(),
    totalDistance: 10000,
    totalTime: 3600,
    averageSpeed: 10,
    maxSpeed: 20,
    totalElevationGain: 200,
    totalElevationLoss: 200,
    routeName: '測試路線',
    trackPoints: [
      { lat: 25.0, lon: 121.5, altitude: 100, timestamp: Date.now() - 3600000 },
      { lat: 25.001, lon: 121.5, altitude: 150, timestamp: Date.now() - 3000000 },
      { lat: 25.002, lon: 121.5, altitude: 200, timestamp: Date.now() - 2400000 },
      { lat: 25.003, lon: 121.5, altitude: 150, timestamp: Date.now() - 1800000 },
      { lat: 25.004, lon: 121.5, altitude: 100, timestamp: Date.now() - 1200000 },
      { lat: 25.005, lon: 121.5, altitude: 50, timestamp: Date.now() - 600000 },
      { lat: 25.006, lon: 121.5, altitude: 100, timestamp: Date.now() },
    ],
    timestamp: Date.now(),
  };

  it('should calculate elevation range correctly', () => {
    const elevations = mockStatistics.trackPoints
      .map((p) => p.altitude || 0)
      .filter((a) => a !== undefined);

    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const elevationRange = maxElevation - minElevation;

    expect(minElevation).toBe(50);
    expect(maxElevation).toBe(200);
    expect(elevationRange).toBe(150);
  });

  it('should determine terrain difficulty correctly', () => {
    const getTerrainDifficulty = (avgGradient: number): string => {
      if (avgGradient > 5) return '非常陡峭';
      if (avgGradient > 3) return '陡峭';
      if (avgGradient > 1) return '中等';
      if (avgGradient > 0.5) return '平緩';
      return '平坦';
    };

    const avgGradient = (mockStatistics.totalElevationGain / mockStatistics.totalDistance) * 100;
    const difficulty = getTerrainDifficulty(avgGradient);

    expect(difficulty).toBe('中等');
  });

  it('should sample data points correctly', () => {
    const pointsWithElevation = mockStatistics.trackPoints.filter(
      (p) => p.altitude !== undefined
    );

    const sampleRate = Math.ceil(pointsWithElevation.length / 30);
    const sampledIndices: number[] = [];

    for (let i = 0; i < pointsWithElevation.length; i += sampleRate) {
      sampledIndices.push(i);
    }

    if (sampledIndices[sampledIndices.length - 1] !== pointsWithElevation.length - 1) {
      sampledIndices.push(pointsWithElevation.length - 1);
    }

    expect(sampledIndices.length).toBeGreaterThan(0);
    expect(sampledIndices[sampledIndices.length - 1]).toBe(pointsWithElevation.length - 1);
  });

  it('should calculate distance correctly', () => {
    const calculateDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ): number => {
      const R = 6371000;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distance = calculateDistance(25.0, 121.5, 25.001, 121.5);

    // 約 111 米（1 度經度差）
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });

  it('should generate Y axis labels correctly', () => {
    const elevations = mockStatistics.trackPoints
      .map((p) => p.altitude || 0)
      .filter((a) => a !== undefined);

    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const elevationRange = maxElevation - minElevation;

    const labels = [];
    const step = Math.ceil(elevationRange / 4 / 10) * 10;

    for (let i = 0; i <= 4; i++) {
      labels.push(Math.round(minElevation + i * step));
    }

    expect(labels.length).toBe(5);
    expect(labels[0]).toBeLessThanOrEqual(minElevation);
    expect(labels[labels.length - 1]).toBeGreaterThanOrEqual(maxElevation);
  });

  it('should generate X axis labels correctly', () => {
    const distances = [0, 1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.0];
    const totalDistance = distances[distances.length - 1];

    const labels = [];
    const step = Math.ceil(totalDistance / 4);

    for (let i = 0; i <= 4; i++) {
      labels.push((i * step).toFixed(1));
    }

    expect(labels.length).toBe(5);
    expect(parseFloat(labels[0])).toBe(0);
    expect(parseFloat(labels[labels.length - 1])).toBeGreaterThanOrEqual(totalDistance);
  });

  it('should calculate average gradient correctly', () => {
    const avgGradient = (mockStatistics.totalElevationGain / mockStatistics.totalDistance) * 100;

    expect(avgGradient).toBeCloseTo(2, 1);
  });

  it('should handle empty track points', () => {
    const emptyStatistics: RideStatistics = {
      ...mockStatistics,
      trackPoints: [],
    };

    const pointsWithElevation = emptyStatistics.trackPoints.filter(
      (p) => p.altitude !== undefined
    );

    expect(pointsWithElevation.length).toBe(0);
  });

  it('should handle track points without elevation', () => {
    const noElevationStatistics: RideStatistics = {
      ...mockStatistics,
      trackPoints: [
        { lat: 25.0, lon: 121.5, timestamp: Date.now() - 3600000 },
        { lat: 25.001, lon: 121.5, timestamp: Date.now() },
      ],
    };

    const pointsWithElevation = noElevationStatistics.trackPoints.filter(
      (p) => p.altitude !== undefined
    );

    expect(pointsWithElevation.length).toBe(0);
  });
});
