import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { LocationPoint } from "@/lib/ride-context";
import { buildElevationSamples, downsampleElevationSamples } from "@/lib/activity-analysis-data";

export function ActivityElevationChart({ route }: { route: LocationPoint[] }) {
  const [width, setWidth] = useState(0);
  const [selectedRatio, setSelectedRatio] = useState<number | null>(null);
  const samples = useMemo(() => downsampleElevationSamples(buildElevationSamples(route)), [route]);
  const chartHeight = 168;
  const padding = { top: 16, right: 12, bottom: 24, left: 34 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const minElevation = samples.length ? Math.min(...samples.map((sample) => sample.elevationM)) : 0;
  const maxElevation = samples.length ? Math.max(...samples.map((sample) => sample.elevationM)) : 0;
  const elevationRange = Math.max(1, maxElevation - minElevation);
  const distanceTotal = samples.at(-1)?.distanceKm ?? 0;
  const selectedIndex = selectedRatio === null ? null : Math.min(samples.length - 1, Math.max(0, Math.round(selectedRatio * (samples.length - 1))));
  const selected = selectedIndex === null ? null : samples[selectedIndex];

  if (samples.length < 2) {
    return <Text style={styles.empty}>此活動沒有足夠的 GPS 海拔資料可繪製海拔曲線。</Text>;
  }

  const pointAt = (sample: typeof samples[number], index: number) => {
    const x = padding.left + (index / Math.max(1, samples.length - 1)) * plotWidth;
    const y = padding.top + plotHeight - ((sample.elevationM - minElevation) / elevationRange) * plotHeight;
    return { x, y };
  };
  const linePath = samples.map((sample, index) => {
    const point = pointAt(sample, index);
    return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
  }).join(" ");
  const first = pointAt(samples[0], 0);
  const last = pointAt(samples[samples.length - 1], samples.length - 1);
  const filledPath = `${linePath} L ${last.x} ${padding.top + plotHeight} L ${first.x} ${padding.top + plotHeight} Z`;

  return (
    <View style={styles.card} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.header}>
        <Text style={styles.title}>海拔</Text>
        <Text style={styles.range}>{Math.round(minElevation)}–{Math.round(maxElevation)} m</Text>
      </View>
      {width > 0 && <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => setSelectedRatio(Math.max(0, Math.min(1, (event.nativeEvent.locationX - padding.left) / plotWidth)))}
        onResponderMove={(event) => setSelectedRatio(Math.max(0, Math.min(1, (event.nativeEvent.locationX - padding.left) / plotWidth)))}
        onResponderRelease={() => setSelectedRatio(null)}
      >
        <Svg width={width} height={chartHeight}>
          <Rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} fill="rgba(255,255,255,0.02)" />
          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + plotHeight - ratio * plotHeight;
            return <Line key={ratio} x1={padding.left} x2={padding.left + plotWidth} y1={y} y2={y} stroke="rgba(255,255,255,0.14)" strokeWidth={StyleSheet.hairlineWidth} />;
          })}
          <Path d={filledPath} fill="rgba(148,163,184,0.48)" />
          <Path d={linePath} fill="none" stroke="#CBD5E1" strokeWidth={2} />
          {selected && selectedIndex !== null && (() => {
            const point = pointAt(selected, selectedIndex);
            return <>
              <Line x1={point.x} x2={point.x} y1={padding.top} y2={padding.top + plotHeight} stroke="#60A5FA" strokeWidth={1} />
              <Circle cx={point.x} cy={point.y} r={4} fill="#60A5FA" stroke="#fff" strokeWidth={1.5} />
            </>;
          })()}
          <SvgText x={4} y={padding.top + 4} fill="rgba(255,255,255,0.55)" fontSize={10}>{Math.round(maxElevation)}</SvgText>
          <SvgText x={4} y={padding.top + plotHeight} fill="rgba(255,255,255,0.55)" fontSize={10}>{Math.round(minElevation)}</SvgText>
          <SvgText x={padding.left} y={chartHeight - 4} fill="rgba(255,255,255,0.55)" fontSize={10}>0 km</SvgText>
          <SvgText x={padding.left + plotWidth - 30} y={chartHeight - 4} fill="rgba(255,255,255,0.55)" fontSize={10}>{distanceTotal.toFixed(1)} km</SvgText>
        </Svg>
      </View>}
      <Text style={styles.readout}>{selected ? `${selected.distanceKm.toFixed(2)} km · ${Math.round(selected.elevationM)} m${selected.grade === undefined ? "" : ` · ${selected.grade.toFixed(1)}%`}` : "拖曳曲線查看距離、海拔與坡度"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.1)", padding: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  range: { color: "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: "700" },
  readout: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 7, textAlign: "center" },
  empty: { color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 18, marginTop: 14 },
});
