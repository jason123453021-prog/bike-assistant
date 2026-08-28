import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import type { LocationPoint } from "@/lib/ride-context";
import {
  buildElevationSamples,
  downsampleElevationSamples,
} from "@/lib/activity-analysis-data";
import { useColors } from "@/hooks/use-colors";
import { useTranslation } from "react-i18next";

export function ActivityElevationChart({ route }: { route: LocationPoint[] }) {
  const colors = useColors();
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [selectedRatio, setSelectedRatio] = useState<number | null>(null);
  const samples = useMemo(
    () => downsampleElevationSamples(buildElevationSamples(route)),
    [route],
  );
  const chartHeight = 168;
  const padding = { top: 16, right: 12, bottom: 24, left: 34 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const minElevation = samples.length
    ? Math.min(...samples.map((sample) => sample.elevationM))
    : 0;
  const maxElevation = samples.length
    ? Math.max(...samples.map((sample) => sample.elevationM))
    : 0;
  const elevationRange = Math.max(1, maxElevation - minElevation);
  const distanceTotal = samples.at(-1)?.distanceKm ?? 0;
  const selectedIndex =
    selectedRatio === null
      ? null
      : Math.min(
          samples.length - 1,
          Math.max(0, Math.round(selectedRatio * (samples.length - 1))),
        );
  const selected = selectedIndex === null ? null : samples[selectedIndex];

  if (samples.length < 2) {
    return (
      <Text style={[styles.empty, { color: colors.muted }]}>
        {t("audit.elevationChartEmpty")}
      </Text>
    );
  }

  const pointAt = (sample: (typeof samples)[number], index: number) => {
    const x =
      padding.left + (index / Math.max(1, samples.length - 1)) * plotWidth;
    const y =
      padding.top +
      plotHeight -
      ((sample.elevationM - minElevation) / elevationRange) * plotHeight;
    return { x, y };
  };
  const linePath = samples
    .map((sample, index) => {
      const point = pointAt(sample, index);
      return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
    })
    .join(" ");
  const first = pointAt(samples[0], 0);
  const last = pointAt(samples[samples.length - 1], samples.length - 1);
  const filledPath = `${linePath} L ${last.x} ${padding.top + plotHeight} L ${first.x} ${padding.top + plotHeight} Z`;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t("audit.elevation")}
        </Text>
        <Text style={[styles.range, { color: colors.muted }]}>
          {Math.round(minElevation)}–{Math.round(maxElevation)} m
        </Text>
      </View>
      {width > 0 && (
        <View
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) =>
            setSelectedRatio(
              Math.max(
                0,
                Math.min(
                  1,
                  (event.nativeEvent.locationX - padding.left) / plotWidth,
                ),
              ),
            )
          }
          onResponderMove={(event) =>
            setSelectedRatio(
              Math.max(
                0,
                Math.min(
                  1,
                  (event.nativeEvent.locationX - padding.left) / plotWidth,
                ),
              ),
            )
          }
          onResponderRelease={() => setSelectedRatio(null)}
        >
          <Svg width={width} height={chartHeight}>
            <Rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotHeight}
              fill={colors.surfaceInset}
            />
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + plotHeight - ratio * plotHeight;
              return (
                <Line
                  key={ratio}
                  x1={padding.left}
                  x2={padding.left + plotWidth}
                  y1={y}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              );
            })}
            <Path d={filledPath} fill={`${colors.accent}35`} />
            <Path
              d={linePath}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2.5}
            />
            {selected &&
              selectedIndex !== null &&
              (() => {
                const point = pointAt(selected, selectedIndex);
                return (
                  <>
                    <Line
                      x1={point.x}
                      x2={point.x}
                      y1={padding.top}
                      y2={padding.top + plotHeight}
                      stroke={colors.accent}
                      strokeWidth={1}
                    />
                    <Circle
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      fill={colors.accent}
                      stroke={colors.surface}
                      strokeWidth={2}
                    />
                  </>
                );
              })()}
            <SvgText
              x={4}
              y={padding.top + 4}
              fill={colors.muted}
              fontSize={11}
            >
              {Math.round(maxElevation)}
            </SvgText>
            <SvgText
              x={4}
              y={padding.top + plotHeight}
              fill={colors.muted}
              fontSize={11}
            >
              {Math.round(minElevation)}
            </SvgText>
            <SvgText
              x={padding.left}
              y={chartHeight - 4}
              fill={colors.muted}
              fontSize={11}
            >
              0 km
            </SvgText>
            <SvgText
              x={padding.left + plotWidth - 34}
              y={chartHeight - 4}
              fill={colors.muted}
              fontSize={11}
            >
              {distanceTotal.toFixed(1)} km
            </SvgText>
          </Svg>
        </View>
      )}
      <Text style={[styles.readout, { color: colors.muted }]}>
        {selected
          ? t("audit.elevationReadout", {
              distance: selected.distanceKm.toFixed(2),
              elevation: Math.round(selected.elevationM),
              grade:
                selected.grade === undefined
                  ? ""
                  : ` · ${selected.grade.toFixed(1)}%`,
            })
          : t("audit.elevationChartHint")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, borderRadius: 14, borderWidth: 1, padding: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: "800" },
  range: { fontSize: 13, fontWeight: "700" },
  readout: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 9,
    textAlign: "center",
  },
  empty: { fontSize: 14, lineHeight: 20, fontWeight: "500", marginTop: 14 },
});
