import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";
import type { AnalysisDataSource } from "@/lib/activity-sensor-estimates";
import { buildActivityChartAxis, type ActivityChartAxisBasis } from "@/lib/activity-chart-axis";

export type ActivityChartMetric = "speed" | "power" | "heartRate" | "cadence";

export interface SpeedDataPoint {
  index: number;
  speed: number;
  power?: number;
  heartRate?: number;
  cadence?: number;
  timestamp: number;
  distanceKm?: number;
  gradePct?: number;
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
  currentIndex?: number;
  markers?: KeyMarker[];
  onMarkerPress?: (marker: KeyMarker) => void;
  height?: number;
  sources: Record<ActivityChartMetric, AnalysisDataSource>;
  confidence?: "low" | "medium" | "high";
  confidenceFactors?: string[];
}

const METRICS: { key: ActivityChartMetric; label: string; unit: string; color: string }[] = [
  { key: "speed", label: "速度", unit: "km/h", color: "#35D3B2" },
  { key: "power", label: "功率", unit: "W", color: "#FF9F0A" },
  { key: "heartRate", label: "心率", unit: "bpm", color: "#FF5A5F" },
  { key: "cadence", label: "踏頻", unit: "rpm", color: "#A78BFA" },
];

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

function metricForMarker(marker: KeyMarker): ActivityChartMetric {
  if (marker.type === "maxPower") return "power";
  if (marker.type === "maxHeartRate") return "heartRate";
  return "speed";
}

function formatTime(timestamp: number, fallbackIndex: number): string {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : `取樣點 ${fallbackIndex + 1}`;
}

/** Strava 風格單一指標曲線：四項資料頁籤、時間／距離基準及來源透明標示。 */
export function SpeedCurveChart({
  data,
  currentIndex = 0,
  markers = [],
  onMarkerPress,
  height = 166,
  sources,
  confidence = "low",
  confidenceFactors = [],
}: SpeedCurveChartProps) {
  const colors = useColors();
  const [activeMetric, setActiveMetric] = useState<ActivityChartMetric>("speed");
  const [axisBasis, setAxisBasis] = useState<ActivityChartAxisBasis>("time");
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    setSelectedIndex(clamp(currentIndex, 0, Math.max(0, data.length - 1)));
  }, [currentIndex, data.length]);

  const metric = METRICS.find((item) => item.key === activeMetric) ?? METRICS[0];
  const values = useMemo(() => data.map((point) => {
    if (activeMetric === "speed") return Math.max(0, point.speed ?? 0);
    if (activeMetric === "power") return Math.max(0, point.power ?? 0);
    if (activeMetric === "heartRate") return Math.max(0, point.heartRate ?? 0);
    return Math.max(0, point.cadence ?? 0);
  }), [activeMetric, data]);
  const axis = useMemo(() => buildActivityChartAxis(data, axisBasis), [axisBasis, data]);
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 1);
  const range = Math.max(1, maximum - minimum);
  const plotTop = 14;
  const plotBottom = height - 28;
  const plotHeight = Math.max(1, plotBottom - plotTop);
  const plotLeft = 5;
  const plotRight = 95;
  const pointPosition = (value: number, index: number) => ({
    x: plotLeft + (axis.ratios[index] ?? index / Math.max(1, values.length - 1)) * (plotRight - plotLeft),
    y: plotBottom - ((value - minimum) / range) * plotHeight,
  });
  const path = values.map((value, index) => {
    const position = pointPosition(value, index);
    return `${index === 0 ? "M" : "L"} ${position.x} ${position.y}`;
  }).join(" ");
  const selected = data[selectedIndex];
  const selectedValue = values[selectedIndex] ?? 0;
  const selectedPosition = pointPosition(selectedValue, selectedIndex);
  const sourceLabel = sources[activeMetric] === "measured" ? "實測" : "本機估算";
  const sourceColor = sources[activeMetric] === "measured" ? "#34D399" : "#FBBF24";
  const confidenceLabels = { low: "信心：低", medium: "信心：中", high: "信心：高" };
  const confidenceColors = { low: "#FBBF24", medium: "#60A5FA", high: "#34D399" };
  const visibleMarkers = markers.filter((marker) => metricForMarker(marker) === activeMetric);

  const selectAt = (locationX: number) => {
    if (containerWidth <= 0 || data.length === 0) return;
    const target = clamp(locationX / containerWidth, 0, 1);
    const nearest = axis.ratios.reduce((bestIndex, ratio, index) => (
      Math.abs(ratio - target) < Math.abs((axis.ratios[bestIndex] ?? 0) - target) ? index : bestIndex
    ), 0);
    setSelectedIndex(nearest);
  };

  if (data.length < 2) {
    return <Text style={[styles.empty, { color: colors.muted }]}>此活動沒有足夠的取樣資料可繪製分析曲線。</Text>;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.tabRow}>
        {METRICS.map((item) => {
          const selectedTab = item.key === activeMetric;
          return (
            <Pressable key={item.key} onPress={() => setActiveMetric(item.key)} style={[styles.tab, { borderColor: selectedTab ? item.color : colors.border, backgroundColor: selectedTab ? `${item.color}20` : colors.surface }]}>
              <Text style={[styles.tabText, { color: selectedTab ? item.color : colors.muted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.axisRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        {(["time", "distance"] as ActivityChartAxisBasis[]).map((basis) => {
          const selectedBasis = axisBasis === basis;
          return <Pressable key={basis} onPress={() => setAxisBasis(basis)} style={[styles.axisTab, selectedBasis && { backgroundColor: colors.primary }]}>
            <Text style={[styles.axisText, { color: selectedBasis ? colors.onAccent : colors.muted }]}>{basis === "time" ? "時間" : "距離"}</Text>
          </Pressable>;
        })}
      </View>

      <View style={styles.metricHeader}>
        <View>
          <Text style={[styles.metricTitle, { color: colors.foreground }]}>{metric.label}</Text>
          <Text style={[styles.metricRange, { color: colors.muted }]}>範圍 {minimum.toFixed(0)}–{maximum.toFixed(0)} {metric.unit}</Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={[styles.sourceBadge, { borderColor: `${sourceColor}77`, backgroundColor: `${sourceColor}18` }]}>
            <View style={[styles.sourceDot, { backgroundColor: sourceColor }]} />
            <Text style={[styles.sourceText, { color: sourceColor }]}>{sourceLabel}</Text>
          </View>
          {sources[activeMetric] === "estimated" && (
            <View style={[styles.sourceBadge, { borderColor: `${confidenceColors[confidence]}77`, backgroundColor: `${confidenceColors[confidence]}18` }]}>
              <Text style={[styles.sourceText, { color: confidenceColors[confidence] }]}>{confidenceLabels[confidence]}</Text>
            </View>
          )}
        </View>
      </View>

      <View
        onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => selectAt(event.nativeEvent.locationX)}
        onResponderMove={(event) => selectAt(event.nativeEvent.locationX)}
        style={[styles.chartFrame, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`}>
          {[0, 0.5, 1].map((ratio) => {
            const y = plotBottom - ratio * plotHeight;
            return <Line key={ratio} x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke={colors.border} strokeWidth="0.5" opacity={0.8} />;
          })}
          <Rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotHeight} fill="transparent" />
          <Path d={path} fill="none" stroke={metric.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {visibleMarkers.map((marker) => {
            const markerValue = values[marker.index] ?? 0;
            const markerPosition = pointPosition(markerValue, marker.index);
            return <Circle key={marker.type} cx={markerPosition.x} cy={markerPosition.y} r="2.8" fill={marker.color} stroke="#fff" strokeWidth="0.8" onPress={() => onMarkerPress?.(marker)} />;
          })}
          <Line x1={selectedPosition.x} x2={selectedPosition.x} y1={plotTop} y2={plotBottom} stroke={metric.color} strokeWidth="1" strokeDasharray="2,2" opacity={0.8} />
          <Circle cx={selectedPosition.x} cy={selectedPosition.y} r="3.2" fill={metric.color} stroke="#fff" strokeWidth="1" />
          <SvgText x={plotLeft} y={height - 8} fill={colors.muted} fontSize={8}>{axis.startLabel}</SvgText>
          <SvgText x={plotRight - 18} y={height - 8} fill={colors.muted} fontSize={8}>{axis.endLabel}</SvgText>
        </Svg>
      </View>

      {selected && (
        <View style={[styles.readout, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.readoutValue, { color: metric.color }]}>{selectedValue.toFixed(0)} <Text style={styles.readoutUnit}>{metric.unit}</Text></Text>
          <Text style={[styles.readoutMeta, { color: colors.muted }]}>{formatTime(selected.timestamp, selectedIndex)} · {selected.distanceKm?.toFixed(2) ?? "--"} km · 坡度 {(selected.gradePct ?? 0).toFixed(1)}%</Text>
        </View>
      )}
      {sources[activeMetric] === "estimated" && <Text style={[styles.estimateNote, { color: colors.muted }]}>信心依可用資料與本機校正次數決定。影響因素：{confidenceFactors.join("、") || "GPS 速度與坡度"}。僅供趨勢回顧，不等同外接感測器量測。</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  empty: { fontSize: 12, lineHeight: 18, marginTop: 14 },
  tabRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
  tab: { flex: 1, minHeight: 36, borderRadius: 9, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  tabText: { fontSize: 12, fontWeight: "800" },
  axisRow: { alignSelf: "flex-start", flexDirection: "row", borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, padding: 2, marginBottom: 12 },
  axisTab: { minWidth: 56, minHeight: 30, borderRadius: 7, justifyContent: "center", alignItems: "center", paddingHorizontal: 9 },
  axisText: { fontSize: 11, fontWeight: "800" },
  metricHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  metricTitle: { fontSize: 15, fontWeight: "800" },
  metricRange: { fontSize: 11, marginTop: 2 },
  badgeRow: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 5 },
  sourceBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourceText: { fontSize: 10, fontWeight: "800" },
  chartFrame: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 7, paddingTop: 6 },
  readout: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 9, marginTop: 8 },
  readoutValue: { fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] },
  readoutUnit: { fontSize: 10, fontWeight: "700" },
  readoutMeta: { flex: 1, fontSize: 10, textAlign: "right", lineHeight: 14 },
  estimateNote: { fontSize: 10, lineHeight: 15, marginTop: 7 },
});
