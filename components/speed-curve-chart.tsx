import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useColors } from "@/hooks/use-colors";

export interface SpeedDataPoint {
  index: number;
  speed: number;
  power?: number;
  heartRate?: number;
  timestamp: number;
}

export interface KeyMarker {
  type: "maxSpeed" | "maxPower" | "maxHeartRate" | "minSpeed";
  index: number;
  value: number;
  label: string;
  color: string;
}

export interface SpeedCurveChartProps {
  data: SpeedDataPoint[];
  currentIndex: number;
  markers?: KeyMarker[];
  onMarkerPress?: (marker: KeyMarker) => void;
  height?: number;
  showPower?: boolean;
  showHeartRate?: boolean;
}

/**
 * 速度曲線圖組件
 * 顯示整個騎乘過程的速度變化，支持標記關鍵點
 */
export function SpeedCurveChart({
  data,
  currentIndex,
  markers = [],
  onMarkerPress,
  height = 120,
  showPower = false,
  showHeartRate = false,
}: SpeedCurveChartProps) {
  const colors = useColors();

  // 計算圖表數據
  const chartData = useMemo(() => {
    if (data.length === 0) return { speeds: [], powers: [], heartRates: [], maxSpeed: 0, maxPower: 0, maxHR: 0 };

    const speeds = data.map((d) => d.speed);
    const powers = data.map((d) => d.power || 0);
    const heartRates = data.map((d) => d.heartRate || 0);

    const maxSpeed = Math.max(...speeds, 1);
    const maxPower = Math.max(...powers, 1);
    const maxHR = Math.max(...heartRates, 1);

    return { speeds, powers, heartRates, maxSpeed, maxPower, maxHR };
  }, [data]);

  // 計算 SVG 路徑
  const generatePath = (values: number[], max: number, yOffset: number, yHeight: number) => {
    if (values.length === 0) return "";

    const xStep = 100 / (values.length - 1 || 1);
    const points = values.map((val, idx) => {
      const x = (idx / (values.length - 1 || 1)) * 100;
      const y = yOffset + yHeight - (val / max) * yHeight;
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  };

  const speedPath = generatePath(chartData.speeds, chartData.maxSpeed, 0, height * 0.8);
  const powerPath = showPower ? generatePath(chartData.powers, chartData.maxPower, 0, height * 0.8) : "";
  const hrPath = showHeartRate ? generatePath(chartData.heartRates, chartData.maxHR, 0, height * 0.8) : "";

  // 計算當前位置指示器
  const currentX = (currentIndex / (data.length - 1 || 1)) * 100;
  const currentY = height * 0.8 - (chartData.speeds[currentIndex] / chartData.maxSpeed) * height * 0.8;

  return (
    <View style={{ marginVertical: 8 }}>
      {/* 圖表標題 */}
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>
        速度曲線 ({chartData.maxSpeed.toFixed(1)} km/h)
      </Text>

      {/* SVG 圖表 */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: 8,
          marginBottom: 8,
          height: height + 16,
        }}
      >
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 100 ${height}`}
          style={{ overflow: "visible" }}
        >
          {/* 背景網格 */}
          <defs>
            <pattern
              id="grid"
              width="20"
              height={height / 4}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M 20 0 L 0 0 0 ${height / 4}`}
                fill="none"
                stroke={colors.border}
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100" height={height} fill={`url(#grid)`} />

          {/* 速度曲線 */}
          <path
            d={speedPath}
            fill="none"
            stroke={colors.primary}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />

          {/* 功率曲線（可選） */}
          {showPower && powerPath && (
            <path
              d={powerPath}
              fill="none"
              stroke="#FF9500"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              opacity="0.6"
            />
          )}

          {/* 心率曲線（可選） */}
          {showHeartRate && hrPath && (
            <path
              d={hrPath}
              fill="none"
              stroke="#EF4444"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              opacity="0.6"
            />
          )}

          {/* 關鍵點標記 */}
          {markers.map((marker) => {
            const markerX = (marker.index / (data.length - 1 || 1)) * 100;
            const markerValue = marker.type === "maxSpeed" 
              ? chartData.speeds[marker.index]
              : marker.type === "maxPower"
              ? chartData.powers[marker.index]
              : chartData.heartRates[marker.index];
            const markerY = height * 0.8 - (markerValue / chartData.maxSpeed) * height * 0.8;

            return (
              <g key={`marker-${marker.type}`}>
                {/* 標記圓點 */}
                <circle
                  cx={markerX}
                  cy={markerY}
                  r="2"
                  fill={marker.color}
                  stroke="#fff"
                  strokeWidth="0.5"
                />
                {/* 標記標籤 */}
                <text
                  x={markerX}
                  y={markerY - 6}
                  textAnchor="middle"
                  fontSize="8"
                  fill={marker.color}
                  fontWeight="bold"
                >
                  {marker.label}
                </text>
              </g>
            );
          })}

          {/* 當前位置指示器 */}
          <line
            x1={currentX}
            y1="0"
            x2={currentX}
            y2={height}
            stroke={colors.primary}
            strokeWidth="1"
            strokeDasharray="2,2"
            opacity="0.5"
          />
          <circle
            cx={currentX}
            cy={currentY}
            r="2.5"
            fill={colors.primary}
            stroke="#fff"
            strokeWidth="1"
          />
        </svg>
      </View>

      {/* 圖例 */}
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 12,
              height: 2,
              backgroundColor: colors.primary,
              borderRadius: 1,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.muted }}>速度</Text>
        </View>
        {showPower && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 12,
                height: 2,
                backgroundColor: "#FF9500",
                borderRadius: 1,
              }}
            />
            <Text style={{ fontSize: 11, color: colors.muted }}>功率</Text>
          </View>
        )}
        {showHeartRate && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 12,
                height: 2,
                backgroundColor: "#EF4444",
                borderRadius: 1,
              }}
            />
            <Text style={{ fontSize: 11, color: colors.muted }}>心率</Text>
          </View>
        )}
      </View>

      {/* 關鍵點列表 */}
      {markers.length > 0 && (
        <View style={{ marginTop: 8, gap: 4 }}>
          {markers.map((marker) => (
            <Pressable
              key={`marker-item-${marker.type}`}
              onPress={() => onMarkerPress?.(marker)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 8,
                paddingVertical: 6,
                backgroundColor: marker.color + "20",
                borderRadius: 6,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: marker.color,
                  marginRight: 8,
                }}
              />
              <Text style={{ fontSize: 12, color: colors.foreground, flex: 1 }}>
                {marker.label}
              </Text>
              <Text style={{ fontSize: 12, color: marker.color, fontWeight: "600" }}>
                {marker.value.toFixed(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
