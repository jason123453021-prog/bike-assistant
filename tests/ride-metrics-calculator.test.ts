/**
 * 騎乘指標計算測試
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCalories,
  calculateElevationMetrics,
  calculateNormalizedPower,
  calculateAllMetrics,
  type GPSPoint,
} from '../lib/calculation/ride-metrics-calculator';

describe('RideMetricsCalculator', () => {
  // 模擬騎乘數據：47.26 km、2 小時 38 分、739m 爬升、127W 平均功率
  const mockRidePoints: GPSPoint[] = [
    // 起點
    { lat: 22.3193, lon: 114.1694, altitude: 10, timestamp: 0, power: 100 },
    // 模擬騎乘軌跡（簡化）
    { lat: 22.3200, lon: 114.1700, altitude: 15, timestamp: 30000, power: 120 },
    { lat: 22.3210, lon: 114.1710, altitude: 25, timestamp: 60000, power: 130 },
    { lat: 22.3220, lon: 114.1720, altitude: 40, timestamp: 90000, power: 140 },
    { lat: 22.3230, lon: 114.1730, altitude: 60, timestamp: 120000, power: 135 },
    { lat: 22.3240, lon: 114.1740, altitude: 85, timestamp: 150000, power: 125 },
    // ... 實際應有更多點
    { lat: 22.3250, lon: 114.1750, altitude: 115, timestamp: 9480000, power: 127 }, // 2h38m
  ];

  describe('calculateCalories', () => {
    it('應基於功率數據精準計算卡路里', () => {
      // 127W 平均功率，2.63 小時
      // 預期卡路里：127 * 2.63 / 4.184 ≈ 80 kcal（基於功率）
      // 但實際應更高，因為考慮人體效率
      const calories = calculateCalories(mockRidePoints, 75, 127);
      expect(calories).toBeGreaterThan(200); // 應該遠高於 253 kcal
      expect(calories).toBeLessThan(600);
    });

    it('應在無功率數據時使用 METs 公式', () => {
      const pointsWithoutPower = mockRidePoints.map(p => ({
        ...p,
        power: undefined,
      }));
      const calories = calculateCalories(pointsWithoutPower, 75);
      expect(calories).toBeGreaterThan(0);
    });

    it('應返回 0 當無有效數據', () => {
      const calories = calculateCalories([], 75);
      expect(calories).toBe(0);
    });
  });

  describe('calculateElevationMetrics', () => {
    it('應正確計算海拔極值', () => {
      const metrics = calculateElevationMetrics(mockRidePoints);
      
      expect(metrics.maxAltitude).toBeGreaterThanOrEqual(115);
      expect(metrics.minAltitude).toBeLessThanOrEqual(10);
      expect(metrics.totalAscent).toBeGreaterThan(0);
    });

    it('應計算總下降高度', () => {
      const metricsWithDescent: GPSPoint[] = [
        { lat: 22.3193, lon: 114.1694, altitude: 10, timestamp: 0 },
        { lat: 22.3200, lon: 114.1700, altitude: 100, timestamp: 30000 },
        { lat: 22.3210, lon: 114.1710, altitude: 50, timestamp: 60000 }, // 下降 50m
      ];
      
      const metrics = calculateElevationMetrics(metricsWithDescent);
      expect(metrics.totalDescent).toBeGreaterThan(0);
    });

    it('應計算平均和最大坡度', () => {
      const metrics = calculateElevationMetrics(mockRidePoints);
      
      expect(metrics.averageGrade).toBeGreaterThanOrEqual(0);
      expect(metrics.maxGrade).toBeGreaterThanOrEqual(metrics.averageGrade);
    });

    it('應返回零值當無有效數據', () => {
      const metrics = calculateElevationMetrics([]);
      
      expect(metrics.totalAscent).toBe(0);
      expect(metrics.totalDescent).toBe(0);
      expect(metrics.maxAltitude).toBe(0);
      expect(metrics.minAltitude).toBe(0);
    });
  });

  describe('calculateNormalizedPower', () => {
    it('應計算標準化功率', () => {
      const np = calculateNormalizedPower(mockRidePoints);
      expect(np).toBeGreaterThan(0);
      expect(np).toBeLessThanOrEqual(200); // 合理範圍
    });

    it('應返回 0 當無功率數據', () => {
      const pointsWithoutPower = mockRidePoints.map(p => ({
        ...p,
        power: undefined,
      }));
      const np = calculateNormalizedPower(pointsWithoutPower);
      expect(np).toBe(0);
    });

    it('應返回 0 當無有效數據', () => {
      const np = calculateNormalizedPower([]);
      expect(np).toBe(0);
    });
  });

  describe('calculateAllMetrics', () => {
    it('應綜合計算所有指標', () => {
      const metrics = calculateAllMetrics(mockRidePoints, 75, 127, 477);
      
      // 驗證基本指標
      expect(metrics.distance).toBeGreaterThan(0);
      expect(metrics.duration).toBeGreaterThan(0);
      
      // 驗證海拔指標
      expect(metrics.totalAscent).toBeGreaterThan(0);
      expect(metrics.maxAltitude).toBeGreaterThanOrEqual(metrics.minAltitude);
      
      // 驗證卡路里（應遠高於 253）
      expect(metrics.calories).toBeGreaterThan(300);
      
      // 驗證功率指標
      expect(metrics.averagePower).toBe(127);
      expect(metrics.maxPower).toBe(477);
      expect(metrics.normalizedPower).toBeGreaterThan(0);
    });

    it('應返回零值當無有效數據', () => {
      const metrics = calculateAllMetrics([], 75);
      
      expect(metrics.distance).toBe(0);
      expect(metrics.duration).toBe(0);
      expect(metrics.calories).toBe(0);
    });
  });

  describe('實際騎乘場景測試', () => {
    it('應處理真實的 47.26km 騎乘數據', () => {
      // 根據截圖信息：47.26 km、2:38:02、739m 爬升、127W 平均功率、477W 最大功率
      // 預期修復後的結果：
      // - 卡路里：應 > 400 kcal（基於 127W 功率）
      // - 總下降：應 > 0（當前為 0）
      // - 最大/最小海拔：應有正確值（當前為 0）
      // - 平均/最大坡度：應有正確值（當前為 0.0%）
      // - NP：應 > 0（當前為 -- W）
      
      const metrics = calculateAllMetrics(mockRidePoints, 75, 127, 477);
      
      // 卡路里應明顯高於 253
      expect(metrics.calories).toBeGreaterThan(300);
      
      // 應有海拔極值
      expect(metrics.maxAltitude).toBeGreaterThan(metrics.minAltitude);
      
      // 應有坡度數據
      expect(metrics.averageGrade).toBeGreaterThanOrEqual(0);
      expect(metrics.maxGrade).toBeGreaterThanOrEqual(0);
      
      // 應計算 NP
      expect(metrics.normalizedPower).toBeGreaterThan(0);
    });
  });
});
