import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Dimensions, ScrollView } from 'react-native';
import { type RideStatistics } from '@/lib/ride-statistics-manager';

export interface CustomElevationChartProps {
  statistics: RideStatistics;
  height?: number;
  className?: string;
}

/**
 * 自定義海拔高度變化圖表
 * 使用 SVG 繪製海拔高度變化曲線
 */
export function CustomElevationChart({
  statistics,
  height = 250,
  className,
}: CustomElevationChartProps) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 48;
  const chartHeight = height;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };

  // 準備圖表數據
  const chartData = useMemo(() => {
    if (!statistics.trackPoints || statistics.trackPoints.length === 0) {
      return null;
    }

    // 過濾有海拔數據的點
    const pointsWithElevation = statistics.trackPoints.filter(
      (p) => p.altitude !== undefined
    );

    if (pointsWithElevation.length < 2) {
      return null;
    }

    // 計算距離
    const distances: number[] = [0];
    let totalDistance = 0;

    for (let i = 1; i < pointsWithElevation.length; i++) {
      const prev = pointsWithElevation[i - 1];
      const curr = pointsWithElevation[i];

      const distance = calculateDistance(
        prev.lat,
        prev.lon,
        curr.lat,
        curr.lon
      );

      totalDistance += distance;
      distances.push(totalDistance / 1000); // 轉換為公里
    }

    // 獲取海拔數據
    const elevations = pointsWithElevation.map((p) => p.altitude || 0);

    // 採樣數據（最多 30 個點以保持圖表清晰）
    const sampleRate = Math.ceil(pointsWithElevation.length / 30);
    const sampledIndices: number[] = [];

    for (let i = 0; i < pointsWithElevation.length; i += sampleRate) {
      sampledIndices.push(i);
    }

    // 確保包含最後一個點
    if (sampledIndices[sampledIndices.length - 1] !== pointsWithElevation.length - 1) {
      sampledIndices.push(pointsWithElevation.length - 1);
    }

    return {
      distances,
      elevations,
      sampledIndices,
      totalDistance: distances[distances.length - 1],
    };
  }, [statistics.trackPoints]);

  if (!chartData) {
    return (
      <View className={`bg-surface rounded-xl p-4 ${className || ''}`}>
        <Text className="text-muted text-center">無海拔數據</Text>
      </View>
    );
  }

  const minElevation = Math.min(...chartData.elevations);
  const maxElevation = Math.max(...chartData.elevations);
  const elevationRange = maxElevation - minElevation;

  // 計算地形難度
  const getTerrainDifficulty = (): string => {
    const avgGradient = (statistics.totalElevationGain / statistics.totalDistance) * 100;

    if (avgGradient > 5) return '非常陡峭';
    if (avgGradient > 3) return '陡峭';
    if (avgGradient > 1) return '中等';
    if (avgGradient > 0.5) return '平緩';
    return '平坦';
  };

  const getTerrainColor = (): string => {
    const avgGradient = (statistics.totalElevationGain / statistics.totalDistance) * 100;

    if (avgGradient > 5) return '#EF4444'; // error
    if (avgGradient > 3) return '#F59E0B'; // warning
    if (avgGradient > 1) return '#0a7ea4'; // primary
    return '#22C55E'; // success
  };

  // 生成 SVG 路徑
  const generatePath = (): string => {
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    let path = '';

    chartData.sampledIndices.forEach((index, i) => {
      const distance = chartData.distances[index];
      const elevation = chartData.elevations[index];

      const x = padding.left + (distance / chartData.totalDistance) * innerWidth;
      const y =
        padding.top +
        innerHeight -
        ((elevation - minElevation) / elevationRange) * innerHeight;

      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });

    return path;
  };

  // 生成 Y 軸標籤
  const yAxisLabels = useMemo(() => {
    const labels = [];
    const step = Math.ceil(elevationRange / 4 / 10) * 10; // 四個刻度

    for (let i = 0; i <= 4; i++) {
      labels.push(Math.round(minElevation + i * step));
    }

    return labels;
  }, [minElevation, elevationRange]);

  // 生成 X 軸標籤
  const xAxisLabels = useMemo(() => {
    const labels = [];
    const step = Math.ceil(chartData.totalDistance / 4);

    for (let i = 0; i <= 4; i++) {
      labels.push((i * step).toFixed(1));
    }

    return labels;
  }, [chartData.totalDistance]);

  return (
    <View className={`bg-surface rounded-xl p-4 ${className || ''}`}>
      {/* 標題 */}
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-semibold text-foreground">海拔高度變化</Text>
        <Text className="text-sm font-semibold" style={{ color: getTerrainColor() }}>
          {getTerrainDifficulty()}
        </Text>
      </View>

      {/* 海拔統計 */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1 bg-background rounded-lg p-2">
          <Text className="text-muted text-xs mb-1">最高點</Text>
          <Text className="text-foreground font-bold text-base">
            {Math.round(maxElevation)} m
          </Text>
        </View>

        <View className="flex-1 bg-background rounded-lg p-2">
          <Text className="text-muted text-xs mb-1">最低點</Text>
          <Text className="text-foreground font-bold text-base">
            {Math.round(minElevation)} m
          </Text>
        </View>

        <View className="flex-1 bg-background rounded-lg p-2">
          <Text className="text-muted text-xs mb-1">高度差</Text>
          <Text className="text-foreground font-bold text-base">
            {Math.round(elevationRange)} m
          </Text>
        </View>
      </View>

      {/* 圖表容器 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
        <View className="bg-background rounded-lg overflow-hidden">
          <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            {/* 背景網格 */}
            {yAxisLabels.map((_, i) => {
              const y =
                padding.top +
                ((chartHeight - padding.top - padding.bottom) / (yAxisLabels.length - 1)) * i;
              return (
                <line
                  key={`grid-y-${i}`}
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="rgba(107, 114, 128, 0.2)"
                  strokeDasharray="4"
                  strokeWidth="1"
                />
              );
            })}

            {/* Y 軸 */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={chartHeight - padding.bottom}
              stroke="rgba(107, 114, 128, 0.5)"
              strokeWidth="1"
            />

            {/* X 軸 */}
            <line
              x1={padding.left}
              y1={chartHeight - padding.bottom}
              x2={chartWidth - padding.right}
              y2={chartHeight - padding.bottom}
              stroke="rgba(107, 114, 128, 0.5)"
              strokeWidth="1"
            />

            {/* Y 軸標籤 */}
            {yAxisLabels.map((label, i) => {
              const y =
                padding.top +
                ((chartHeight - padding.top - padding.bottom) / (yAxisLabels.length - 1)) * i;
              return (
                <text
                  key={`y-label-${i}`}
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="rgba(107, 114, 128, 0.7)"
                >
                  {label}
                </text>
              );
            })}

            {/* X 軸標籤 */}
            {xAxisLabels.map((label, i) => {
              const x =
                padding.left +
                ((chartWidth - padding.left - padding.right) / (xAxisLabels.length - 1)) * i;
              return (
                <text
                  key={`x-label-${i}`}
                  x={x}
                  y={chartHeight - padding.bottom + 20}
                  textAnchor="middle"
                  fontSize="10"
                  fill="rgba(107, 114, 128, 0.7)"
                >
                  {label}
                </text>
              );
            })}

            {/* 高度曲線 */}
            <path
              d={generatePath()}
              fill="none"
              stroke={getTerrainColor()}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 曲線下方填充 */}
            <defs>
              <linearGradient id="elevationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={getTerrainColor()} stopOpacity="0.3" />
                <stop offset="100%" stopColor={getTerrainColor()} stopOpacity="0.05" />
              </linearGradient>
            </defs>

            <path
              d={generatePath() + ` L ${chartWidth - padding.right} ${chartHeight - padding.bottom} L ${padding.left} ${chartHeight - padding.bottom} Z`}
              fill="url(#elevationGradient)"
            />

            {/* 數據點 */}
            {chartData.sampledIndices.map((index, i) => {
              const distance = chartData.distances[index];
              const elevation = chartData.elevations[index];
              const innerWidth = chartWidth - padding.left - padding.right;
              const innerHeight = chartHeight - padding.top - padding.bottom;

              const x = padding.left + (distance / chartData.totalDistance) * innerWidth;
              const y =
                padding.top +
                innerHeight -
                ((elevation - minElevation) / elevationRange) * innerHeight;

              return (
                <circle
                  key={`point-${i}`}
                  cx={x}
                  cy={y}
                  r="3"
                  fill={getTerrainColor()}
                  opacity={selectedPoint === index ? 1 : 0.6}
                />
              );
            })}
          </svg>
        </View>
      </ScrollView>

      {/* 選中點信息 */}
      {selectedPoint !== null && (
        <View className="bg-primary/10 rounded-lg p-3 mb-3 border border-primary/20">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-muted text-xs mb-1">距離起點</Text>
              <Text className="text-foreground font-bold">
                {chartData.distances[selectedPoint].toFixed(2)} km
              </Text>
            </View>

            <View>
              <Text className="text-muted text-xs mb-1">海拔高度</Text>
              <Text className="text-foreground font-bold">
                {Math.round(chartData.elevations[selectedPoint])} m
              </Text>
            </View>

            <Pressable
              onPress={() => setSelectedPoint(null)}
              className="active:opacity-70"
            >
              <Text className="text-primary text-lg">✕</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 坡度信息 */}
      <View className="bg-background rounded-lg p-3">
        <Text className="text-muted text-xs mb-2">坡度統計</Text>

        <View className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-muted text-sm">平均坡度</Text>
            <Text className="text-foreground font-semibold">
              {((statistics.totalElevationGain / statistics.totalDistance) * 100).toFixed(2)}%
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-muted text-sm">總爬升</Text>
            <Text className="text-foreground font-semibold">
              {Math.round(statistics.totalElevationGain)} m
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-muted text-sm">總下降</Text>
            <Text className="text-foreground font-semibold">
              {Math.round(statistics.totalElevationLoss)} m
            </Text>
          </View>
        </View>
      </View>

      {/* 提示文本 */}
      <Text className="text-muted text-xs mt-3 text-center">
        點擊圖表查看詳細信息
      </Text>
    </View>
  );
}

/**
 * 計算兩點間距離（Haversine 公式）
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // 地球半徑（公尺）
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
}
